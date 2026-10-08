"""Admin CRUD for the DB-backed model catalog.

These endpoints power the vizhi-admin console. Everything here requires an
authenticated user with ``role == "admin"`` (see ``require_admin``). Writes
take effect immediately: ``GET /v1/models/registry`` reads the same tables,
so the main console reflects changes on its next fetch — no redeploy.
"""

from __future__ import annotations

import asyncio
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.user_auth import require_admin
from app.config.settings import settings
from app.db.session import get_db
from app.models.db_models import CatalogModelRow, CatalogProviderRow, UserRow

router = APIRouter(
    prefix="/v1/admin/catalog",
    tags=["admin-catalog"],
    dependencies=[Depends(require_admin)],
)

_PROVIDER_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


# ── Schemas ──────────────────────────────────────────────────────────────


class ProviderCreateRequest(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=128)
    sort_order: int = 0
    enabled: bool = True


class ProviderUpdateRequest(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=128)
    sort_order: int | None = None
    enabled: bool | None = None


class ModelCreateRequest(BaseModel):
    id: str = Field(min_length=1, max_length=256)
    label: str = Field(min_length=1, max_length=128)
    sort_order: int = 0
    enabled: bool = True


class ModelUpdateRequest(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=128)
    sort_order: int | None = None
    enabled: bool | None = None


# ── Serializers ──────────────────────────────────────────────────────────


def _model_dict(row: CatalogModelRow) -> dict:
    return {
        "id": row.id,
        "provider_id": row.provider_id,
        "label": row.label,
        "sort_order": row.sort_order,
        "enabled": bool(row.enabled),
    }


def _provider_dict(row: CatalogProviderRow, models: list[CatalogModelRow]) -> dict:
    return {
        "id": row.id,
        "label": row.label,
        "sort_order": row.sort_order,
        "enabled": bool(row.enabled),
        "models": [_model_dict(m) for m in models],
    }


# ── Helpers ──────────────────────────────────────────────────────────────


async def _get_provider(db: AsyncSession, provider_id: str) -> CatalogProviderRow:
    result = await db.execute(
        select(CatalogProviderRow).where(CatalogProviderRow.id == provider_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Provider not found")
    return row


async def _get_model(db: AsyncSession, model_id: str) -> CatalogModelRow:
    result = await db.execute(
        select(CatalogModelRow).where(CatalogModelRow.id == model_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Model not found")
    return row


# ── Provider endpoints ───────────────────────────────────────────────────


@router.get("/providers")
async def list_providers(
    admin: UserRow = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """List ALL providers (including disabled) with their models."""
    providers_result = await db.execute(
        select(CatalogProviderRow).order_by(
            CatalogProviderRow.sort_order, CatalogProviderRow.id
        )
    )
    providers = providers_result.scalars().all()

    models_result = await db.execute(
        select(CatalogModelRow).order_by(
            CatalogModelRow.sort_order, CatalogModelRow.id
        )
    )
    models_by_provider: dict[str, list[CatalogModelRow]] = {}
    for model in models_result.scalars().all():
        models_by_provider.setdefault(model.provider_id, []).append(model)

    return [
        _provider_dict(p, models_by_provider.get(p.id, [])) for p in providers
    ]


@router.post("/providers", status_code=status.HTTP_201_CREATED)
async def create_provider(
    body: ProviderCreateRequest,
    admin: UserRow = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    provider_id = body.id.strip().lower()
    if not _PROVIDER_ID_RE.match(provider_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provider id must be lowercase letters, digits and dashes (e.g. 'openai')",
        )

    existing = await db.execute(
        select(CatalogProviderRow.id).where(CatalogProviderRow.id == provider_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Provider id already exists")

    row = CatalogProviderRow(
        id=provider_id,
        label=body.label.strip(),
        sort_order=body.sort_order,
        enabled=1 if body.enabled else 0,
    )
    db.add(row)
    await db.flush()
    return _provider_dict(row, [])


@router.patch("/providers/{provider_id}")
async def update_provider(
    provider_id: str,
    body: ProviderUpdateRequest,
    admin: UserRow = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await _get_provider(db, provider_id)
    if body.label is not None:
        row.label = body.label.strip()
    if body.sort_order is not None:
        row.sort_order = body.sort_order
    if body.enabled is not None:
        row.enabled = 1 if body.enabled else 0
    await db.flush()

    models_result = await db.execute(
        select(CatalogModelRow)
        .where(CatalogModelRow.provider_id == row.id)
        .order_by(CatalogModelRow.sort_order, CatalogModelRow.id)
    )
    return _provider_dict(row, list(models_result.scalars().all()))


@router.delete("/providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(
    provider_id: str,
    admin: UserRow = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    row = await _get_provider(db, provider_id)
    # Delete children explicitly (SQLite FK cascades are not guaranteed).
    models_result = await db.execute(
        select(CatalogModelRow).where(CatalogModelRow.provider_id == provider_id)
    )
    for model in models_result.scalars().all():
        await db.delete(model)
    await db.delete(row)
    await db.flush()


# ── Model endpoints ──────────────────────────────────────────────────────


@router.post("/providers/{provider_id}/models", status_code=status.HTTP_201_CREATED)
async def create_model(
    provider_id: str,
    body: ModelCreateRequest,
    admin: UserRow = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await _get_provider(db, provider_id)

    model_id = body.id.strip()
    if not model_id.startswith(f"{provider_id}/"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Model id must start with '{provider_id}/' (e.g. '{provider_id}/my-model')",
        )

    existing = await db.execute(
        select(CatalogModelRow.id).where(CatalogModelRow.id == model_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Model id already exists")

    row = CatalogModelRow(
        id=model_id,
        provider_id=provider_id,
        label=body.label.strip(),
        sort_order=body.sort_order,
        enabled=1 if body.enabled else 0,
    )
    db.add(row)
    await db.flush()
    return _model_dict(row)


# Model ids contain slashes (e.g. "openai/gpt-4o") — hence the path converter.
@router.patch("/models/{model_id:path}")
async def update_model(
    model_id: str,
    body: ModelUpdateRequest,
    admin: UserRow = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await _get_model(db, model_id)
    if body.label is not None:
        row.label = body.label.strip()
    if body.sort_order is not None:
        row.sort_order = body.sort_order
    if body.enabled is not None:
        row.enabled = 1 if body.enabled else 0
    await db.flush()
    return _model_dict(row)


@router.delete("/models/{model_id:path}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(
    model_id: str,
    admin: UserRow = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    row = await _get_model(db, model_id)
    await db.delete(row)
    await db.flush()


# ── NVIDIA NIM sync ──────────────────────────────────────────────────────
# Fetches live models from build.nvidia.com and upserts them into the catalog
# under the "nvidia" provider. Falls back to a curated list when the key is
# missing or the API is unreachable.


_NVIDIA_FALLBACK_MODELS: list[tuple[str, str]] = [
    ("openai/gpt-oss-20b", "GPT-OSS 20B"),
    ("google/gemma-4-31b-it", "Gemma 4 31B IT"),
    ("nvidia/nemotron-3-super-120b-a12b", "Nemotron 3 Super 120B"),
    ("nvidia/nemotron-3-ultra-550b-a55b", "Nemotron 3 Ultra 550B"),
    ("nvidia/nemotron-3.5-lightning-30b-a3b", "Nemotron 3.5 Lightning 30B"),
]

# The NVIDIA /v1/models endpoint lists every platform model, including
# embedding / vision / safety / translation models that are not chat-capable.
_NVIDIA_NON_CHAT_KEYWORDS = (
    "embed", "retriever", "vision", "vlm", "vila", "neva", "kosmos", "deplot",
    "nvclip", "safety", "guard", "nemoguard", "translate", "riva", "parse",
    "detector", "calibration", "reward", "diffusion",
)


async def _fetch_nvidia_models() -> tuple[list[tuple[str, str]], str]:
    """Return ``[(nim_model_id, label), ...]`` and the source ("live"/"fallback")."""
    if not settings.nvidia_api_key:
        return _NVIDIA_FALLBACK_MODELS, "fallback"

    base = settings.nvidia_base_url.rstrip("/").removesuffix("/v1")
    url = f"{base}/v1/models"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                url,
                headers={"Authorization": f"Bearer {settings.nvidia_api_key}"},
            )
        resp.raise_for_status()
        data = resp.json()
        models = [
            (item["id"], item["id"])
            for item in data.get("data", [])
            if item.get("id")
        ]
        if not models:
            return _NVIDIA_FALLBACK_MODELS, "fallback"
        return models, "live"
    except Exception:  # noqa: BLE001 - fall back gracefully
        return _NVIDIA_FALLBACK_MODELS, "fallback"


async def _verify_nvidia_chat_model(model_id: str) -> bool:
    """Return True if the model answers a minimal chat completion.

    The NVIDIA account may only have access to a subset of the models listed
    by ``/v1/models`` (others return 404 "Function not found for account"), so
    we probe each candidate before adding it to the catalog.
    """
    base = settings.nvidia_base_url.rstrip("/").removesuffix("/v1")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{base}/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.nvidia_api_key}"},
                json={
                    "model": model_id,
                    "messages": [{"role": "user", "content": "hi"}],
                    "max_tokens": 1,
                },
            )
        return resp.status_code == 200
    except Exception:  # noqa: BLE001 - treat as unavailable
        return False


@router.post("/sync-nvidia")
async def sync_nvidia_models(
    admin: UserRow = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Fetch NVIDIA NIM models and upsert them into the catalog."""
    provider = await db.get(CatalogProviderRow, "nvidia")
    if not provider:
        provider = CatalogProviderRow(
            id="nvidia",
            label="NVIDIA NIM (build.nvidia.com)",
            sort_order=50,
            enabled=1,
        )
        db.add(provider)
        await db.flush()

    models, source = await _fetch_nvidia_models()

    # Keep only chat-capable models, then probe each one so we don't add
    # models the account can't actually call.
    chat_models = [
        (mid, label)
        for mid, label in models
        if not any(k in mid.lower() for k in _NVIDIA_NON_CHAT_KEYWORDS)
    ]
    if chat_models:
        checks = await asyncio.gather(
            *[_verify_nvidia_chat_model(mid) for mid, _ in chat_models]
        )
        models = [m for m, ok in zip(chat_models, checks) if ok]

    existing_result = await db.execute(
        select(CatalogModelRow.id).where(CatalogModelRow.provider_id == "nvidia")
    )
    existing = set(existing_result.scalars().all())

    created = 0
    for order, (nim_id, label) in enumerate(models):
        model_id = f"nvidia/{nim_id}"
        if model_id in existing:
            continue
        db.add(
            CatalogModelRow(
                id=model_id,
                provider_id="nvidia",
                label=label,
                sort_order=order,
                enabled=1,
            )
        )
        created += 1

    await db.flush()
    return {"source": source, "created": created, "total": len(models)}


# ── HuggingFace sync ─────────────────────────────────────────────────────
# The HF router's model list changes over time (old models are retired), so
# the catalog can drift. This fetches the live list and upserts it.


async def _fetch_hf_models() -> tuple[list[tuple[str, str]], str]:
    """Return ``[(hf_model_id, label), ...]`` and the source ("live"/"fallback")."""
    hf_key = settings.huggingface_api_key or settings.hf_token
    if not hf_key:
        return [], "fallback"

    base = settings.huggingface_base_url.rstrip("/").removesuffix("/v1")
    url = f"{base}/v1/models"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                url,
                headers={"Authorization": f"Bearer {hf_key}"},
            )
        resp.raise_for_status()
        data = resp.json()
        models = [
            (item["id"], item["id"])
            for item in data.get("data", [])
            if item.get("id")
        ]
        return models, "live"
    except Exception:  # noqa: BLE001 - fall back gracefully
        return [], "fallback"


@router.post("/sync-huggingface")
async def sync_huggingface_models(
    admin: UserRow = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Fetch live HuggingFace models and upsert them into the catalog."""
    provider = await db.get(CatalogProviderRow, "huggingface")
    if not provider:
        provider = CatalogProviderRow(
            id="huggingface",
            label="🤗 Open Models (Free via HuggingFace)",
            sort_order=40,
            enabled=1,
        )
        db.add(provider)
        await db.flush()

    models, source = await _fetch_hf_models()

    existing_result = await db.execute(
        select(CatalogModelRow.id).where(CatalogModelRow.provider_id == "huggingface")
    )
    existing = set(existing_result.scalars().all())

    created = 0
    for order, (hf_id, label) in enumerate(models):
        model_id = f"huggingface/{hf_id}"
        if model_id in existing:
            continue
        db.add(
            CatalogModelRow(
                id=model_id,
                provider_id="huggingface",
                label=label,
                sort_order=order,
                enabled=1,
            )
        )
        created += 1

    await db.flush()
    return {"source": source, "created": created, "total": len(models)}
