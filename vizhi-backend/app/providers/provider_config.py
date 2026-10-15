"""Per-provider connection settings: which adapter, which key, which base URL.

Every provider — built-in (openai, nvidia, …) or added in the admin console
(nebius, groq, …) — is resolved the same way, at call time:

1. The provider's row in ``catalog_providers`` (set in vizhi-admin): its
   ``api_key``, ``base_url`` and ``adapter``.
2. For built-ins only, the legacy ``.env`` key / base URL as a fallback, so
   existing deployments keep working until the key is moved to the console.
3. For built-ins only, the provider's public default base URL — so for
   NVIDIA, OpenAI, … pasting just the API key in the console is enough.

Rows are cached for a few seconds: a key saved in the admin console is live
on the gateway within ``_CACHE_TTL_SECONDS``, without a restart or redeploy.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Callable

from app.config.settings import settings

# Wire formats the gateway can speak. The admin console offers exactly these.
ADAPTERS = ("openai", "anthropic", "gemini", "azure-openai")


@dataclass(frozen=True)
class ProviderConfig:
    name: str       # provider id as routed, e.g. "nebius"
    adapter: str    # one of ADAPTERS
    api_key: str
    base_url: str


@dataclass(frozen=True)
class _Builtin:
    adapter: str
    default_base_url: str
    env_key: Callable[[], str]
    env_base_url: Callable[[], str] = lambda: ""
    key_required: bool = True


_BUILTINS: dict[str, _Builtin] = {
    "openai": _Builtin("openai", "https://api.openai.com/v1", lambda: settings.openai_api_key),
    "anthropic": _Builtin("anthropic", "https://api.anthropic.com", lambda: settings.anthropic_api_key),
    "gemini": _Builtin(
        "gemini", "https://generativelanguage.googleapis.com/v1beta", lambda: settings.gemini_api_key
    ),
    "qwen": _Builtin(
        "openai", "https://dashscope.aliyuncs.com/compatible-mode/v1", lambda: settings.qwen_api_key
    ),
    "huggingface": _Builtin(
        "openai",
        "https://router.huggingface.co/v1",
        lambda: settings.huggingface_api_key or settings.hf_token,
        lambda: settings.huggingface_base_url,
    ),
    "nvidia": _Builtin(
        "openai",
        "https://integrate.api.nvidia.com/v1",
        lambda: settings.nvidia_api_key,
        lambda: settings.nvidia_base_url,
    ),
    "local": _Builtin(
        "openai", "http://localhost:11434", lambda: "", lambda: settings.ollama_base_url, key_required=False
    ),
    # INFERENCE_BACKEND=custom override target.
    "custom": _Builtin(
        "openai",
        "",
        lambda: settings.custom_inference_api_key,
        lambda: settings.custom_inference_base_url,
        key_required=False,
    ),
}

# Other names for the same built-in. The catalog seeds Anthropic as "claude",
# so a key saved on that row serves "anthropic/…" models too.
_ALIASES: dict[str, str] = {
    "claude": "anthropic",
    "google": "gemini",
    "dashscope": "qwen",
    "hf": "huggingface",
    "nim": "nvidia",
    "ollama": "local",
    "vllm": "local",
    "tgi": "local",
}

# Legacy model prefixes that HuggingFace serves when no provider of that name
# has been configured. A console provider with the same id (e.g. the real
# DeepSeek API added as "deepseek") takes precedence.
LEGACY_HF_PREFIXES = ("llama", "mistral", "deepseek")


def canonical(name: str) -> str:
    """Built-in id for an alias (``claude`` → ``anthropic``); otherwise ``name``."""
    name = name.lower()
    return _ALIASES.get(name, name)


def builtin_ids() -> tuple[str, ...]:
    return tuple(_BUILTINS)


def _catalog_ids(name: str) -> list[str]:
    """Catalog rows that may hold credentials for ``name``, most specific first."""
    base = canonical(name)
    ids = [name.lower()]
    for candidate in [base, *(alias for alias, target in _ALIASES.items() if target == base)]:
        if candidate not in ids:
            ids.append(candidate)
    return ids


# ── Catalog row cache ────────────────────────────────────────────────────

_CACHE_TTL_SECONDS = 15.0
_row_cache: dict[str, tuple[float, tuple[str | None, str | None, str | None] | None]] = {}


async def _catalog_row(provider_id: str) -> tuple[str | None, str | None, str | None] | None:
    """``(api_key, base_url, adapter)`` for a catalog provider, or None if absent."""
    now = time.monotonic()
    cached = _row_cache.get(provider_id)
    if cached is not None and cached[0] > now:
        return cached[1]

    from sqlalchemy import select

    from app.db.session import async_session_factory
    from app.models.db_models import CatalogProviderRow

    try:
        async with async_session_factory() as db:
            row = (
                await db.execute(
                    select(
                        CatalogProviderRow.api_key,
                        CatalogProviderRow.base_url,
                        CatalogProviderRow.adapter,
                    ).where(CatalogProviderRow.id == provider_id)
                )
            ).one_or_none()
    except Exception:
        # DB unavailable — fall back to .env for built-ins, never cache.
        return None

    value = (row[0], row[1], row[2]) if row is not None else None
    _row_cache[provider_id] = (now + _CACHE_TTL_SECONDS, value)
    return value


def clear_cache() -> None:
    _row_cache.clear()


# ── Resolution ───────────────────────────────────────────────────────────


async def resolve_provider_config(
    name: str,
    *,
    api_key: str | None = None,
    base_url: str | None = None,
) -> ProviderConfig:
    """Connection settings for provider ``name``.

    Explicit ``api_key`` / ``base_url`` win (used by tests and the local
    adapter). Raises ``RuntimeError`` with a "not configured" message — which
    the router treats as non-retryable — when no key can be found.
    """
    name = name.lower()
    builtin = _BUILTINS.get(canonical(name))

    row_key = row_base = row_adapter = None
    for catalog_id in _catalog_ids(name):
        row = await _catalog_row(catalog_id)
        if row is None:
            continue
        key, base, adapter = row
        row_key = row_key or key
        row_base = row_base or base
        row_adapter = row_adapter or adapter
        if row_key:
            break

    # Legacy "llama/…" style ids with no console provider of their own are
    # served by HuggingFace, as before.
    if builtin is None and not row_key and not row_base and name in LEGACY_HF_PREFIXES:
        hf = await resolve_provider_config("huggingface", api_key=api_key, base_url=base_url)
        return ProviderConfig(name=name, adapter=hf.adapter, api_key=hf.api_key, base_url=hf.base_url)

    adapter = row_adapter or (builtin.adapter if builtin else "openai")
    if adapter not in ADAPTERS:
        raise RuntimeError(
            f"Provider '{name}' has unknown adapter '{adapter}' — choose one of "
            f"{', '.join(ADAPTERS)} in the admin console."
        )

    key = api_key or row_key or (builtin.env_key() if builtin else "") or ""
    base = (
        base_url
        or row_base
        or (builtin.env_base_url() if builtin else "")
        or (builtin.default_base_url if builtin else "")
        or ""
    )

    key_required = builtin.key_required if builtin else True
    if (key_required and not key) or not base:
        missing = "API key" if not key else "base URL"
        raise RuntimeError(
            f"Provider '{name}' {missing} is not configured. Add it in the "
            "vizhi-admin console (Catalog → provider → Gateway credentials)."
        )

    return ProviderConfig(name=name, adapter=adapter, api_key=key, base_url=base)
