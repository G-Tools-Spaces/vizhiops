"""Provider settings from the admin console, and the per-API-style adapters.

Every provider — built-in or admin-added — takes its key / base URL / adapter
from ``catalog_providers`` first and .env second; each adapter must build the
URL its SDK would and translate the response to the OpenAI shape.
"""

from __future__ import annotations

import json

import httpx
import pytest

from app.providers import adapters, final_call, provider_config
from app.providers.http_client import close_http_client
from app.services import router as router_module

OPENAI_BODY = {
    "model": "meta-llama/Llama-3.3-70B-Instruct",
    "choices": [{"message": {"content": "hi"}, "finish_reason": "stop"}],
    "usage": {"prompt_tokens": 3, "completion_tokens": 1},
}
MESSAGES = [{"role": "system", "content": "be brief"}, {"role": "user", "content": "hi"}]


@pytest.fixture
def catalog(monkeypatch):
    """In-memory stand-in for catalog_providers: id → (api_key, base_url, adapter)."""
    rows: dict[str, tuple[str | None, str | None, str | None]] = {}

    async def fake_row(provider_id: str):
        return rows.get(provider_id)

    monkeypatch.setattr(provider_config, "_catalog_row", fake_row)
    monkeypatch.setattr(router_module, "_is_catalog_provider", lambda pid: _async(pid in rows))
    return rows


async def _async(value):
    return value


@pytest.fixture
def upstream(monkeypatch):
    """Capture outgoing requests; reply with ``upstream.body`` (JSON) or SSE lines."""
    seen: list[httpx.Request] = []
    state = {"body": OPENAI_BODY, "sse": None}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if state["sse"] is not None:
            text = "".join(f"data: {json.dumps(e)}\n\n" for e in state["sse"])
            return httpx.Response(200, text=text, headers={"content-type": "text/event-stream"})
        return httpx.Response(200, json=state["body"])

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(adapters, "get_http_client", lambda: client)
    seen_state = type("Upstream", (), {})()
    seen_state.requests = seen
    seen_state.state = state
    return seen_state


async def _call(provider: str, model: str = "m", **kwargs):
    return await final_call._dispatch_call(
        backend=provider,
        provider_name=provider,
        model=model,
        messages=MESSAGES,
        temperature=0.0,
        max_tokens=8,
        **kwargs,
    )


# ── Admin-added OpenAI-compatible providers ──────────────────────────────


@pytest.mark.parametrize(
    "base_url",
    [
        "https://api.example-nebius.com/v1",
        "https://api.example-nebius.com/v1/",
        "https://api.example-nebius.com",
    ],
)
async def test_openai_compatible_url(catalog, upstream, base_url):
    catalog["nebius"] = ("sk-test", base_url, None)
    result = await _call("nebius", "meta-llama/Llama-3.3-70B-Instruct")
    request = upstream.requests[0]
    assert str(request.url) == "https://api.example-nebius.com/v1/chat/completions"
    assert request.headers["authorization"] == "Bearer sk-test"
    assert result.provider == "nebius"
    assert result.content == "hi"


async def test_versioned_base_path_is_kept(catalog, upstream):
    # Gemini's OpenAI shim, Zhipu's /v4 …: the OpenAI SDK appends
    # /chat/completions to the base as given.
    catalog["shim"] = ("k", "https://generativelanguage.googleapis.com/v1beta/openai/", None)
    await _call("shim")
    assert str(upstream.requests[0].url) == (
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    )


async def test_missing_key_is_a_clear_non_retryable_error(catalog, upstream):
    catalog["nebius"] = (None, "https://api.example-nebius.com/v1", None)
    with pytest.raises(RuntimeError, match="not configured.*admin console") as exc:
        await _call("nebius")
    assert router_module._is_non_retryable(exc.value)
    assert upstream.requests == []


# ── Built-ins take their key from the admin console ──────────────────────


async def test_builtin_uses_console_key_and_default_base_url(catalog, upstream, monkeypatch):
    monkeypatch.setattr(provider_config.settings, "nvidia_api_key", "")
    monkeypatch.setattr(provider_config.settings, "nvidia_base_url", "")
    catalog["nvidia"] = ("nvapi-from-admin", None, None)
    await _call("nvidia", "meta/llama-3.3-70b-instruct")
    request = upstream.requests[0]
    assert str(request.url) == "https://integrate.api.nvidia.com/v1/chat/completions"
    assert request.headers["authorization"] == "Bearer nvapi-from-admin"


async def test_console_key_wins_over_env(catalog, upstream, monkeypatch):
    monkeypatch.setattr(provider_config.settings, "nvidia_api_key", "nvapi-from-env")
    catalog["nvidia"] = ("nvapi-from-admin", None, None)
    await _call("nvidia")
    assert upstream.requests[0].headers["authorization"] == "Bearer nvapi-from-admin"


async def test_env_key_still_works_without_console_key(catalog, upstream, monkeypatch):
    monkeypatch.setattr(provider_config.settings, "nvidia_api_key", "nvapi-from-env")
    catalog["nvidia"] = (None, None, None)  # seeded row, no credentials
    await _call("nvidia")
    assert upstream.requests[0].headers["authorization"] == "Bearer nvapi-from-env"


async def test_builtin_without_any_key_points_at_admin_console(catalog, upstream, monkeypatch):
    monkeypatch.setattr(provider_config.settings, "nvidia_api_key", "")
    with pytest.raises(RuntimeError, match="vizhi-admin"):
        await _call("nvidia")


async def test_alias_row_serves_builtin(catalog, upstream, monkeypatch):
    # The catalog seeds Anthropic as "claude"; models are "anthropic/…".
    monkeypatch.setattr(provider_config.settings, "anthropic_api_key", "")
    catalog["claude"] = ("sk-ant-admin", None, None)
    upstream.state["body"] = {
        "model": "claude-sonnet-4",
        "content": [{"type": "text", "text": "hello"}],
        "usage": {"input_tokens": 5, "output_tokens": 2},
        "stop_reason": "end_turn",
    }
    result = await _call("anthropic", "claude-sonnet-4")
    request = upstream.requests[0]
    assert str(request.url) == "https://api.anthropic.com/v1/messages"
    assert request.headers["x-api-key"] == "sk-ant-admin"
    assert result.content == "hello"
    assert (result.input_tokens, result.output_tokens) == (5, 2)


# ── Routing ──────────────────────────────────────────────────────────────


async def test_console_provider_named_like_legacy_alias_is_not_hijacked(catalog, upstream):
    # "deepseek/…" used to be forced to HuggingFace even when the admin had
    # added the real DeepSeek API under that id.
    catalog["deepseek"] = ("sk-ds", "https://api.deepseek.com", None)
    provider, model = await router_module.ProviderRouter().resolve("deepseek/deepseek-chat")
    assert (provider.provider_name, model) == ("deepseek", "deepseek-chat")
    await provider.chat_completion(model=model, messages=MESSAGES)
    assert str(upstream.requests[0].url) == "https://api.deepseek.com/v1/chat/completions"


async def test_legacy_alias_without_console_provider_uses_huggingface(catalog, upstream, monkeypatch):
    monkeypatch.setattr(provider_config.settings, "hf_token", "hf_env")
    monkeypatch.setattr(provider_config.settings, "huggingface_api_key", "")
    await _call("deepseek", "deepseek-ai/DeepSeek-R1")
    request = upstream.requests[0]
    assert str(request.url) == "https://router.huggingface.co/v1/chat/completions"
    assert request.headers["authorization"] == "Bearer hf_env"


# ── Adapters chosen in the console ───────────────────────────────────────


async def test_anthropic_adapter_for_compatible_endpoint(catalog, upstream):
    catalog["ds-anthropic"] = ("sk-ds", "https://api.deepseek.com/anthropic", "anthropic")
    upstream.state["body"] = {"content": [{"type": "text", "text": "ok"}], "usage": {}}
    await _call("ds-anthropic", "deepseek-chat")
    request = upstream.requests[0]
    assert str(request.url) == "https://api.deepseek.com/anthropic/v1/messages"
    payload = json.loads(request.content)
    assert payload["system"] == "be brief"
    assert payload["messages"] == [{"role": "user", "content": "hi"}]


async def test_gemini_adapter(catalog, upstream):
    catalog["my-gemini"] = ("AIza-key", "https://generativelanguage.googleapis.com/v1beta", "gemini")
    upstream.state["body"] = {
        "candidates": [
            {
                "content": {"parts": [{"text": "thinking…", "thought": True}, {"text": "pong"}]},
                "finishReason": "MAX_TOKENS",
            }
        ],
        "usageMetadata": {"promptTokenCount": 4, "candidatesTokenCount": 1},
        "modelVersion": "gemini-2.5-flash",
    }
    result = await _call("my-gemini", "gemini-2.5-flash")
    request = upstream.requests[0]
    assert str(request.url) == (
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    )
    assert request.headers["x-goog-api-key"] == "AIza-key"
    payload = json.loads(request.content)
    assert payload["systemInstruction"] == {"parts": [{"text": "be brief"}]}
    assert payload["contents"] == [{"role": "user", "parts": [{"text": "hi"}]}]
    assert payload["generationConfig"] == {"temperature": 0.0, "maxOutputTokens": 8}
    assert (result.content, result.finish_reason) == ("pong", "length")
    assert (result.input_tokens, result.output_tokens) == (4, 1)


async def test_gemini_stream_is_openai_sse(catalog, upstream):
    catalog["my-gemini"] = ("AIza-key", "https://generativelanguage.googleapis.com/v1beta", "gemini")
    upstream.state["sse"] = [
        {"candidates": [{"content": {"parts": [{"text": "po"}]}}]},
        {
            "candidates": [{"content": {"parts": [{"text": "ng"}]}, "finishReason": "STOP"}],
            "usageMetadata": {"promptTokenCount": 4, "candidatesTokenCount": 2},
        },
    ]
    lines = [
        chunk
        async for chunk in final_call._dispatch_stream(
            backend="my-gemini",
            provider_name="my-gemini",
            model="gemini-2.5-flash",
            messages=MESSAGES,
            temperature=0.0,
            max_tokens=None,
        )
    ]
    assert str(upstream.requests[0].url).endswith(":streamGenerateContent?alt=sse")
    assert lines[-1] == "data: [DONE]"
    events = [json.loads(line[6:]) for line in lines[:-1]]
    assert "".join(e["choices"][0]["delta"].get("content", "") for e in events) == "pong"
    assert events[-1]["choices"][0]["finish_reason"] == "stop"
    assert events[-1]["usage"]["total_tokens"] == 6


async def test_azure_openai_adapter(catalog, upstream):
    catalog["azure"] = (
        "az-key",
        "https://res.openai.azure.com/openai/deployments/gpt4o?api-version=2024-10-21",
        "azure-openai",
    )
    await _call("azure", "gpt-4o")
    request = upstream.requests[0]
    assert str(request.url) == (
        "https://res.openai.azure.com/openai/deployments/gpt4o/chat/completions?api-version=2024-10-21"
    )
    assert request.headers["api-key"] == "az-key"
    assert "authorization" not in request.headers
    assert json.loads(request.content)["max_completion_tokens"] == 8


async def test_openai_itself_gets_max_completion_tokens(catalog, upstream):
    catalog["openai"] = ("sk-admin", None, None)
    await _call("openai", "o4-mini")
    payload = json.loads(upstream.requests[0].content)
    assert payload["max_completion_tokens"] == 8 and "max_tokens" not in payload


async def test_unknown_adapter_is_rejected(catalog, upstream):
    catalog["weird"] = ("k", "https://x.example/v1", "soap")
    with pytest.raises(RuntimeError, match="unknown adapter"):
        await _call("weird")
    await close_http_client()
