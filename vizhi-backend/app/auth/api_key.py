"""API-key authentication dependency for FastAPI."""

from __future__ import annotations

import asyncio
import hashlib
import secrets
import uuid
from typing import Any

import bcrypt
from dataclasses import dataclass, field
from fastapi import Depends, Header, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.db.session import get_db
from app.db.time import utcnow
from app.models.db_models import AgentRow, ModelConnectionRow

_api_key_header = APIKeyHeader(name="Authorization", auto_error=False)


def generate_api_key() -> str:
    """Generate a new Vizhi API key with the configured prefix."""
    token = secrets.token_hex(24)
    return f"{settings.api_key_prefix}{token}"


def hash_api_key(raw_key: str) -> str:
    """Create a bcrypt hash of an API key for safe storage."""
    return bcrypt.hashpw(raw_key.encode(), bcrypt.gensalt()).decode()


def verify_api_key(raw_key: str, hashed: str) -> bool:
    """Verify a raw API key against its bcrypt hash."""
    return bcrypt.checkpw(raw_key.encode(), hashed.encode())


def mask_api_key(raw_key: str) -> str:
    """Return a masked version for display: ``vz_live_a1b2...f3e4``."""
    prefix = settings.api_key_prefix
    body = raw_key.removeprefix(prefix)
    if len(body) <= 8:
        return f"{prefix}{'*' * len(body)}"
    return f"{prefix}{body[:4]}...{body[-4:]}"


def _fast_hash(raw_key: str) -> str:
    """SHA-256 fingerprint for fast DB lookup before bcrypt verify."""
    return hashlib.sha256(raw_key.encode()).hexdigest()


# ── Verified-key cache ───────────────────────────────────────────────────
#
# bcrypt at cost 12 takes ~200 ms on a laptop core and seconds on a small
# cloud instance, and the token tables have no fingerprint column, so a scan
# verifies the key against every active row. The gateway pays that on every
# call. This cache remembers which row a raw key matched:
#
#     sha256(raw_key) -> (table, primary key, bcrypt hash that matched)
#
# A hit still reads the row by primary key and only counts when the row is
# active and its hash is unchanged, so revoking or rotating a token takes
# effect on the very next request exactly as before. Only the bcrypt work is
# skipped. In-memory, per process; nothing is persisted.

_KEY_CACHE: dict[str, tuple[str, str, str]] = {}
_KEY_CACHE_MAX = 10_000


async def _verify_async(raw_key: str, hashed: str) -> bool:
    """bcrypt.checkpw off the event loop, so a slow hash does not stall
    every other request and open stream on the server."""
    return await asyncio.to_thread(verify_api_key, raw_key, hashed)


def _remember(raw_key: str, row: AgentRow | ModelConnectionRow) -> None:
    if len(_KEY_CACHE) >= _KEY_CACHE_MAX:
        _KEY_CACHE.clear()
    _KEY_CACHE[_fast_hash(raw_key)] = (row.__tablename__, row.id, row.api_key_hash)


def _forget(raw_key: str) -> None:
    _KEY_CACHE.pop(_fast_hash(raw_key), None)


def clear_key_cache() -> None:
    """Drop every cached verification (tests)."""
    _KEY_CACHE.clear()


async def _row_matching_cached_key(
    db: AsyncSession, raw_key: str, model: type[AgentRow] | type[ModelConnectionRow]
) -> AgentRow | ModelConnectionRow | None:
    """The cached row for this key if it is still active with the same hash."""
    hit = _KEY_CACHE.get(_fast_hash(raw_key))
    if hit is None or hit[0] != model.__tablename__:
        return None
    _, pk, hashed = hit
    row = await db.get(model, pk)
    if row is not None and row.status == "active" and row.api_key_hash == hashed:
        return row
    _forget(raw_key)
    return None


async def _verify_row(raw_key: str, row: AgentRow | ModelConnectionRow) -> bool:
    """Verify a key against one specific row, using the cache when it already
    proved this key against this row's current hash."""
    hit = _KEY_CACHE.get(_fast_hash(raw_key))
    if hit == (row.__tablename__, row.id, row.api_key_hash):
        return True
    if await _verify_async(raw_key, row.api_key_hash):
        _remember(raw_key, row)
        return True
    return False


async def _find_active_row(
    db: AsyncSession, raw_key: str, model: type[AgentRow] | type[ModelConnectionRow]
) -> AgentRow | ModelConnectionRow | None:
    """The active row whose hash matches `raw_key`: cache first, then the
    scan, most recently used tokens first so a live key is found early."""
    row = await _row_matching_cached_key(db, raw_key, model)
    if row is not None:
        return row
    result = await db.execute(
        select(model)
        .where(model.status == "active")
        .order_by(model.last_used_at.desc().nulls_last())
    )
    for candidate in result.scalars().all():
        if await _verify_async(raw_key, candidate.api_key_hash):
            _remember(raw_key, candidate)
            return candidate
    return None


@dataclass(frozen=True)
class ChatCredential:
    """Authenticated credential used by the chat gateway."""

    principal_id: str
    token_type: str
    model_name: str | None = None
    user_id: str | None = None
    # The token row auth loaded, so the budget check need not fetch it again.
    row: Any = field(default=None, compare=False, repr=False)


@dataclass(frozen=True)
class AgentQueueCredential:
    """Authenticated credential used by the on-site agent queue."""

    agent_id: str
    agent_name: str
    user_id: str | None = None


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    raw_key = authorization.removeprefix("Bearer ").strip()
    if not raw_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format",
        )
    return raw_key


async def _touch_last_used(db: AsyncSession, row: AgentRow | ModelConnectionRow) -> None:
    """Update last_used_at timestamp on any token row. Session commit is handled by the dependency."""
    row.last_used_at = utcnow()
    await db.flush()


# Back-compat alias used by agent queue auth paths
async def _touch_agent_last_used(db: AsyncSession, agent: AgentRow) -> None:
    await _touch_last_used(db, agent)


async def resolve_agent(
    authorization: str | None = Security(_api_key_header),
    db: AsyncSession = Depends(get_db),
) -> AgentRow:
    """FastAPI dependency – validates the API key and returns the Agent.

    Expects header::

        Authorization: Bearer vz_live_xxxxxxxx
    """
    raw_key = _extract_bearer_token(authorization)

    agent = await _find_active_row(db, raw_key, AgentRow)
    if agent is not None:
        await _touch_agent_last_used(db, agent)
        return agent

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid API key",
    )


async def resolve_chat_credential(
    authorization: str | None = Security(_api_key_header),
    db: AsyncSession = Depends(get_db),
) -> ChatCredential:
    """Validate a chat token.

    Model tokens are preferred for chat calls because they are already bound to
    a specific provider/model. Agent tokens are accepted as a compatibility path
    and must still provide a model in the request body.
    """
    raw_key = _extract_bearer_token(authorization)

    model_connection = await _find_active_row(db, raw_key, ModelConnectionRow)
    if model_connection is not None:
        await _touch_last_used(db, model_connection)
        return ChatCredential(
            principal_id=model_connection.id,
            token_type="model",
            model_name=model_connection.model_name,
            user_id=model_connection.user_id,
            row=model_connection,
        )

    agent = await _find_active_row(db, raw_key, AgentRow)
    if agent is not None:
        await _touch_agent_last_used(db, agent)
        return ChatCredential(
            principal_id=agent.agent_id,
            token_type="agent",
            user_id=agent.user_id,
            row=agent,
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid API key",
    )


async def resolve_gateway_credential(
    authorization: str | None = Security(_api_key_header),
    x_agent_cid: str | None = Header(default=None, alias="X-Agent-CID"),
    x_agent_token: str | None = Header(default=None, alias="X-Agent-Token"),
    db: AsyncSession = Depends(get_db),
) -> ChatCredential:
    """Resolve either a model token or an explicit agent queue credential."""
    if x_agent_cid or x_agent_token:
        if not x_agent_cid or not x_agent_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Both X-Agent-CID and X-Agent-Token are required",
            )
        result = await db.execute(
            select(AgentRow).where(
                AgentRow.agent_id == x_agent_cid,
                AgentRow.status == "active",
            )
        )
        agent = result.scalars().first()
        if not agent or not await _verify_row(x_agent_token, agent):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid agent credentials",
            )
        return ChatCredential(
            principal_id=agent.agent_id,
            token_type="agent",
            user_id=agent.user_id,
            row=agent,
        )

    return await resolve_chat_credential(authorization, db)


async def resolve_agent_queue_credential(
    x_agent_cid: str | None = Header(default=None, alias="X-Agent-CID"),
    x_agent_token: str | None = Header(default=None, alias="X-Agent-Token"),
    db: AsyncSession = Depends(get_db),
) -> AgentQueueCredential:
    """Resolve the authenticated agent that is fetching or submitting jobs."""
    return await verify_agent_queue_credentials(
        db,
        agent_cid=x_agent_cid,
        agent_token=x_agent_token,
    )


async def verify_agent_queue_credentials(
    db: AsyncSession,
    *,
    agent_cid: str | None,
    agent_token: str | None,
) -> AgentQueueCredential:
    if not agent_cid or not agent_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Both X-Agent-CID and X-Agent-Token are required",
        )

    result = await db.execute(
        select(AgentRow).where(
            AgentRow.agent_id == agent_cid,
            AgentRow.status == "active",
        )
    )
    agent = result.scalars().first()
    if not agent or not await _verify_row(agent_token, agent):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid agent credentials",
        )
    await _touch_agent_last_used(db, agent)
    return AgentQueueCredential(
        agent_id=agent.agent_id,
        agent_name=agent.name,
        user_id=agent.user_id,
    )


async def optional_agent(
    authorization: str | None = Security(_api_key_header),
    db: AsyncSession = Depends(get_db),
) -> AgentRow | None:
    """Like ``resolve_agent`` but returns ``None`` instead of raising."""
    if not authorization:
        return None
    try:
        return await resolve_agent(authorization, db)
    except HTTPException:
        return None
