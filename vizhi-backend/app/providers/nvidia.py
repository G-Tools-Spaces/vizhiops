"""NVIDIA NIM provider adapter (build.nvidia.com).

NVIDIA NIM exposes an OpenAI-compatible endpoint at
``https://integrate.api.nvidia.com/v1``.  Model ids are namespaced, e.g.
``meta/llama-3.3-70b-instruct`` or ``nvidia/llama-3.1-nemotron-70b-instruct``.
"""

from __future__ import annotations

from typing import AsyncGenerator

from app.providers.base import BaseProvider, ProviderResponse
from app.providers.final_call import (
    chat_completion as final_chat_completion,
    chat_completion_stream as final_chat_completion_stream,
)


class NvidiaProvider(BaseProvider):
    provider_name = "nvidia"

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