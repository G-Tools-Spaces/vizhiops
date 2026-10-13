"""The verified-key cache in app.auth.api_key.

bcrypt must run at most once per (key, hash); revocation and rotation must
still take effect on the next request; the chat gateway must authenticate a
model token end to end and log the reply in the background.

Needs TEST_DATABASE_URL (see tests/conftest.py); skipped otherwise.
"""

from __future__ import annotations

import asyncio
import uuid
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.auth import api_key as api_key_module
from app.auth.api_key import (
    _find_active_row,
    _verify_row,
    clear_key_cache,
    generate_api_key,
    hash_api_key,
    mask_api_key,
)
from app.api import chat as chat_module
from app.main import app
from app.models.db_models import AgentRow, ModelConnectionRow, ResponseRow
from app.providers.base import ProviderResponse
from app.services.router import FallbackResult


@pytest.fixture
def bcrypt_calls(monkeypatch):
    """Count real bcrypt verifications."""
    calls: list[int] = []
    real = api_key_module.verify_api_key

    def counting(raw: str, hashed: str) -> bool:
        calls.append(1)
        return real(raw, hashed)

    monkeypatch.setattr(api_key_module, "verify_api_key", counting)
    clear_key_cache()
    yield calls
    clear_key_cache()


async def _new_agent(db, raw_key: str) -> AgentRow:
    row = AgentRow(
        id=f"a_{uuid.uuid4().hex[:8]}",
        agent_id=f"ag_{uuid.uuid4().hex[:8]}",
        name="cache-test",
        description="",
        api_key_hash=hash_api_key(raw_key),
        masked_key=mask_api_key(raw_key),
        tags="[]",
        status="active",
    )
    async with db() as session:
        session.add(row)
        await session.commit()
    return row


async def _new_model_token(
    db, raw_key: str, model_name: str = "openai/gpt-4o-mini", **extra
) -> ModelConnectionRow:
    row = ModelConnectionRow(
        id=f"mc_{uuid.uuid4().hex[:8]}",
        provider="openai",
        model_name=model_name,
        api_key_hash=hash_api_key(raw_key),
        masked_key=mask_api_key(raw_key),
        status="active",
        **extra,
    )
    async with db() as session:
        session.add(row)
        await session.commit()
    return row


class TestFindActiveRow:
    async def test_second_lookup_skips_bcrypt(self, db, bcrypt_calls):
        raw = generate_api_key()
        created = await _new_agent(db, raw)

        async with db() as session:
            found = await _find_active_row(session, raw, AgentRow)
        assert found is not None and found.id == created.id
        first = len(bcrypt_calls)
        assert first >= 1

        async with db() as session:
            again = await _find_active_row(session, raw, AgentRow)
        assert again is not None and again.id == created.id
        assert len(bcrypt_calls) == first, "cache hit must not run bcrypt"

    async def test_wrong_key_is_not_found(self, db, bcrypt_calls):
        await _new_agent(db, generate_api_key())
        async with db() as session:
            assert await _find_active_row(session, generate_api_key(), AgentRow) is None

    async def test_revoked_row_is_rejected_after_cache_hit(self, db, bcrypt_calls):
        raw = generate_api_key()
        created = await _new_agent(db, raw)
        async with db() as session:
            assert await _find_active_row(session, raw, AgentRow) is not None

        async with db() as session:
            row = await session.get(AgentRow, created.id)
            row.status = "revoked"
            await session.commit()

        async with db() as session:
            assert await _find_active_row(session, raw, AgentRow) is None

    async def test_rotated_hash_invalidates_old_key(self, db, bcrypt_calls):
        old_raw = generate_api_key()
        created = await _new_agent(db, old_raw)
        async with db() as session:
            assert await _find_active_row(session, old_raw, AgentRow) is not None

        new_raw = generate_api_key()
        async with db() as session:
            row = await session.get(AgentRow, created.id)
            row.api_key_hash = hash_api_key(new_raw)
            await session.commit()

        async with db() as session:
            assert await _find_active_row(session, old_raw, AgentRow) is None
            found = await _find_active_row(session, new_raw, AgentRow)
        assert found is not None and found.id == created.id

    async def test_cache_is_per_table(self, db, bcrypt_calls):
        raw = generate_api_key()
        await _new_model_token(db, raw)
        async with db() as session:
            assert await _find_active_row(session, raw, ModelConnectionRow) is not None
            assert await _find_active_row(session, raw, AgentRow) is None


class TestVerifyRow:
    async def test_single_row_verify_uses_cache(self, db, bcrypt_calls):
        raw = generate_api_key()
        created = await _new_agent(db, raw)
        async with db() as session:
            row = await session.get(AgentRow, created.id)
            assert await _verify_row(raw, row) is True
            n = len(bcrypt_calls)
            assert n == 1
            assert await _verify_row(raw, row) is True
            assert len(bcrypt_calls) == n
            assert await _verify_row(generate_api_key(), row) is False


class TestChatGatewayWithModelToken:
    async def test_roundtrip_logs_in_background_and_caches_auth(self, db, bcrypt_calls, monkeypatch):
        raw = generate_api_key()
        # Usage stats are credited by model name, so give this token its own.
        model_name = f"openai/gpt-test-{uuid.uuid4().hex[:6]}"
        token = await _new_model_token(db, raw, model_name, budget_usd=5.0)  # a budget forces the SUM query

        ok = ProviderResponse(
            content="Hello from the test!",
            input_tokens=10,
            output_tokens=20,
            model=model_name,
            provider="openai",
            latency_ms=42,
            raw_response={"choices": [{"message": {"content": "Hello from the test!"}}]},
        )
        monkeypatch.setattr(
            chat_module.provider_router,
            "chat_with_fallback",
            AsyncMock(
                return_value=FallbackResult(
                    response=ok, final_provider="openai", final_model=model_name, used_fallback=False
                )
            ),
        )

        body = {"messages": [{"role": "user", "content": "hi"}]}
        headers = {"Authorization": f"Bearer {raw}"}
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            first = await c.post("/v1/chat/completions", json=body, headers=headers)
            assert first.status_code == 200, first.text
            after_first = len(bcrypt_calls)
            assert after_first >= 1

            second = await c.post("/v1/chat/completions", json=body, headers=headers)
            assert second.status_code == 200, second.text
            assert len(bcrypt_calls) == after_first, "second call must not bcrypt again"

            bad = await c.post("/v1/chat/completions", json=body, headers={"Authorization": "Bearer vz_live_nope"})
            assert bad.status_code == 401

        data = first.json()
        assert data["choices"][0]["message"]["content"] == "Hello from the test!"
        assert data["usage"]["total_tokens"] == 30
        query_id = data["vizhi_metadata"]["query_id"]

        if chat_module._background_tasks:
            await asyncio.gather(*chat_module._background_tasks)

        async with db() as session:
            rows = (await session.execute(select(ResponseRow).where(ResponseRow.query_id == query_id))).scalars().all()
            assert len(rows) == 1
            assert rows[0].status_code == 200
            assert rows[0].input_tokens == 10 and rows[0].output_tokens == 20
            mc = await session.get(ModelConnectionRow, token.id)
            assert mc.last_used_at is not None
            assert mc.usage_count == 2
            assert mc.total_tokens_consumed == 60
