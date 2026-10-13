"""Central inference switchboard for all provider adapters.

For every call the provider's connection settings are resolved by
:mod:`app.providers.provider_config` — the admin console's key / base URL /
adapter first, the legacy .env values as a fallback for built-ins — and the
request is sent with the adapter for that provider's API style
(:mod:`app.providers.adapters`: OpenAI, Anthropic, Gemini, Azure OpenAI).

INFERENCE_BACKEND:
  "auto" (default) — each provider is served by its own settings.
  "custom,huggingface" — legacy override: try these providers in order for
  every request, whatever provider the model names.
"""

from __future__ import annotations

from typing import Any, AsyncGenerator

from app.config.settings import settings
from app.providers import adapters
from app.providers.base import ProviderResponse
from app.providers.provider_config import canonical, resolve_provider_config


# ── HuggingFace open-model pool (used when routing to HF) ─────────────────────

_HF_MODEL_POOL: list[str] = [
    "meta-llama/Llama-3.1-8B-Instruct",
    "meta-llama/Llama-3.2-3B-Instruct",
    "mistralai/Mistral-7B-Instruct-v0.3",
    "mistralai/Mixtral-8x7B-Instruct-v0.1",
    "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
    "Qwen/Qwen2.5-7B-Instruct",
    "Qwen/Qwen2.5-3B-Instruct",
    "Qwen/Qwen2.5-Coder-7B-Instruct",
]


# ── Public API ────────────────────────────────────────────────────────────────

async def chat_completion(
    *,
    provider_name: str,
    model: str,
    messages: list[dict],
    temperature: float = 1.0,
    max_tokens: int | None = None,
    **kwargs: Any,
) -> ProviderResponse:
    """Route a non-streaming chat completion to the provider's adapter."""
    overrides = _override_backends()
    if not overrides:
        return await _dispatch_call(
            backend=provider_name,
            provider_name=provider_name,
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )

    errors: list[str] = []
    for backend in overrides:
        try:
            return await _dispatch_call(
                backend=backend,
                provider_name=provider_name,
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs,
            )
        except Exception as exc:
            errors.append(f"{backend}: {exc}")
    raise RuntimeError("; ".join(errors) or "All configured backends failed")


async def chat_completion_stream(
    *,
    provider_name: str,
    model: str,
    messages: list[dict],
    temperature: float = 1.0,
    max_tokens: int | None = None,
    **kwargs: Any,
) -> AsyncGenerator[str, None]:
    """Stream a chat completion as OpenAI-compatible SSE lines.

    Yields raw ``data: {...}`` strings (without trailing newlines).
    Terminates with ``data: [DONE]``.
    """
    overrides = _override_backends()
    if not overrides:
        async for chunk in _dispatch_stream(
            backend=provider_name,
            provider_name=provider_name,
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        ):
            yield chunk
        return

    errors: list[str] = []
    for backend in overrides:
        try:
            async for chunk in _dispatch_stream(
                backend=backend,
                provider_name=provider_name,
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs,
            ):
                yield chunk
            return
        except Exception as exc:
            errors.append(f"{backend}: {exc}")
    raise RuntimeError("; ".join(errors) or "All configured backends failed (stream)")


# ── Internal dispatchers ──────────────────────────────────────────────────────
# ``backend`` is the provider whose settings serve the call: the routed
# provider itself, or an INFERENCE_BACKEND override entry.

async def _dispatch_call(
    *,
    backend: str,
    provider_name: str,
    model: str,
    messages: list[dict],
    temperature: float,
    max_tokens: int | None,
    **kwargs: Any,
) -> ProviderResponse:
    cfg = await resolve_provider_config(
        backend, api_key=kwargs.get("api_key"), base_url=kwargs.get("base_url")
    )
    return await adapters.chat(
        cfg,
        model=_upstream_model(cfg.name, model),
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )


async def _dispatch_stream(
    *,
    backend: str,
    provider_name: str,
    model: str,
    messages: list[dict],
    temperature: float,
    max_tokens: int | None,
    **kwargs: Any,
) -> AsyncGenerator[str, None]:
    cfg = await resolve_provider_config(
        backend, api_key=kwargs.get("api_key"), base_url=kwargs.get("base_url")
    )
    async for chunk in adapters.stream(
        cfg,
        model=_upstream_model(cfg.name, model),
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    ):
        yield chunk


# ── Helpers ───────────────────────────────────────────────────────────────────

def _override_backends() -> list[str]:
    override = settings.inference_backend.strip().lower()
    if not override or override == "auto":
        return []
    return [b.strip() for b in override.split(",") if b.strip()]


def _upstream_model(backend: str, model: str) -> str:
    """HuggingFace only serves HF repo ids; anything else gets a pool model."""
    if canonical(backend) == "huggingface":
        return _pick_hf_model(model)
    return model


def _pick_hf_model(requested_model: str) -> str:
    """For HuggingFace routing, use requested model if it looks like an HF path,
    otherwise pick the first model from the pool."""
    if "/" in requested_model and not requested_model.startswith("gpt") and not requested_model.startswith("claude"):
        return requested_model
    return _HF_MODEL_POOL[0]
