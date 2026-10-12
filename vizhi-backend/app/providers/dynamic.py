"""Admin-managed (DB-credentialed) OpenAI-compatible provider adapter.

A provider added in the admin console with an API key + base URL is served
by this adapter. Credentials are read from the catalog DB at call time, so
rotating a key in the admin UI takes effect on the very next request — no
restart, no .env change.
"""

from __future__ import annotations

from typing import AsyncGenerator

from app.providers.base import BaseProvider, ProviderResponse
from app.providers.final_call import (
    chat_completion as final_chat_completion,
    chat_completion_stream as final_chat_completion_stream,
)


class DynamicProvider(BaseProvider):
    """Serves any provider whose credentials live in ``catalog_providers``."""

    def __init__(self, provider_id: str) -> None:
        self.provider_name = provider_id
        self._provider_id = provider_id

    async def _credentials(self) -> tuple[str, str]:
        """Return ``(api_key, base_url)`` for this provider, fresh from the DB."""
        from sqlalchemy import select

        from app.db.session import async_session_factory
        from app.models.db_models import CatalogProviderRow

        async with async_session_factory() as db:
            row = (
                await db.execute(
                    select(CatalogProviderRow).where(
                        CatalogProviderRow.id == self._provider_id
                    )
                )
            ).scalar_one_or_none()

        if row is None or not row.api_key or not row.base_url:
            raise RuntimeError(
                f"Provider '{self._provider_id}' has no API key / base URL "
                "configured. Set them in the admin console."
            )
        return row.api_key, row.base_url

    async def chat_completion(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 1.0,
        max_tokens: int | None = None,
        **kwargs,
    ) -> ProviderResponse:
        api_key, base_url = await self._credentials()
        return await final_chat_completion(
            provider_name=self.provider_name,
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=api_key,
            base_url=base_url,
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
        api_key, base_url = await self._credentials()
        async for chunk in final_chat_completion_stream(
            provider_name=self.provider_name,
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=api_key,
            base_url=base_url,
            **kwargs,
        ):
            yield chunk
