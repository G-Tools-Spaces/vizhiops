"""Adapter for providers added in the admin console (nebius, groq, …).

Nothing provider-specific lives here: the switchboard resolves the provider's
key, base URL and adapter (OpenAI / Anthropic / Gemini / Azure OpenAI) from
``catalog_providers`` at call time, exactly as for the built-ins — so adding
or rotating a provider in the admin UI needs no .env change or restart.
"""

from __future__ import annotations

from typing import AsyncGenerator

from app.providers.base import BaseProvider, ProviderResponse
from app.providers.final_call import (
    chat_completion as final_chat_completion,
    chat_completion_stream as final_chat_completion_stream,
)


class DynamicProvider(BaseProvider):
    """Serves any provider whose settings live in ``catalog_providers``."""

    def __init__(self, provider_id: str) -> None:
        self.provider_name = provider_id

    async def chat_completion(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 1.0,
        max_tokens: int | None = None,
        **kwargs,
    ) -> ProviderResponse:
        return await final_chat_completion(
            provider_name=self.provider_name,
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )

    async def chat_completion_stream(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 1.0,
        max_tokens: int | None = None,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        async for chunk in final_chat_completion_stream(
            provider_name=self.provider_name,
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        ):
            yield chunk
