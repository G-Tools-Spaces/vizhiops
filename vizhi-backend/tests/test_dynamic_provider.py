"""Admin-managed (catalog) providers: the chat URL built from a stored base URL.

Admins enter the base URL with or without the /v1 suffix; both must reach
`{host}/v1/chat/completions`, never `/v1/v1/...`.
"""

from __future__ import annotations

import httpx
import pytest

from app.providers import final_call
from app.providers.http_client import close_http_client

OK_BODY = {
    "model": "meta-llama/Llama-3.3-70B-Instruct",
    "choices": [{"message": {"content": "hi"}, "finish_reason": "stop"}],
    "usage": {"prompt_tokens": 3, "completion_tokens": 1},
}


@pytest.fixture
def captured(monkeypatch):
    urls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        urls.append(str(request.url))
        return httpx.Response(200, json=OK_BODY)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(final_call, "get_http_client", lambda: client)
    yield urls


@pytest.mark.parametrize(
    "base_url",
    [
        "https://api.example-nebius.com/v1",
        "https://api.example-nebius.com/v1/",
        "https://api.example-nebius.com",
    ],
)
async def test_dynamic_call_url(captured, base_url):
    result = await final_call._dispatch_call(
        backend="dynamic",
        provider_name="nebius",
        model="meta-llama/Llama-3.3-70B-Instruct",
        messages=[{"role": "user", "content": "hi"}],
        temperature=0.0,
        max_tokens=8,
        api_key="sk-test",
        base_url=base_url,
    )
    assert captured == ["https://api.example-nebius.com/v1/chat/completions"]
    assert result.provider == "nebius"
    assert result.content == "hi"


async def test_dynamic_without_credentials_is_a_clear_error(captured):
    with pytest.raises(RuntimeError, match="admin console"):
        await final_call._dispatch_call(
            backend="dynamic",
            provider_name="nebius",
            model="m",
            messages=[],
            temperature=0.0,
            max_tokens=None,
            api_key="",
            base_url="",
        )
    assert captured == []


async def test_unknown_provider_routes_to_dynamic_backend():
    assert final_call._provider_to_backend("nebius") == "dynamic"
    await close_http_client()
