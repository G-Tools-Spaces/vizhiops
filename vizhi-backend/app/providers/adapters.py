"""Wire-format adapters: one per upstream API style.

Each adapter takes a :class:`ProviderConfig` (key + base URL, from the admin
console or .env) and speaks that API's native protocol, returning a
:class:`ProviderResponse` / OpenAI-compatible SSE lines so the gateway is the
same whatever the upstream.

  openai        OpenAI Chat Completions — anything the OpenAI SDK talks to
                (OpenAI, NVIDIA NIM, HuggingFace, Nebius, Groq, Together,
                Fireworks, DeepSeek, Qwen/DashScope, Ollama, vLLM, …).
                Base URL as the OpenAI SDK takes it: ".../v1".
  anthropic     Anthropic Messages API (Anthropic, and Anthropic-compatible
                endpoints). Base URL as the Anthropic SDK takes it.
  gemini        Google Gemini generateContent API (google-genai).
                Base URL: "https://generativelanguage.googleapis.com/v1beta".
  azure-openai  Azure OpenAI: OpenAI wire format with an ``api-key`` header.
                Base URL: "https://<resource>.openai.azure.com/openai/v1", or a
                deployment URL with ``?api-version=…``.
"""

from __future__ import annotations

import json
import time
import uuid
from typing import Any, AsyncGenerator
from urllib.parse import urlsplit, urlunsplit

from app.providers.base import ProviderResponse
from app.providers.http_client import get_http_client
from app.providers.provider_config import ProviderConfig


# ── URL helpers ──────────────────────────────────────────────────────────


def _join(base: str, path: str, *, default_prefix: str = "") -> str:
    """Append ``path`` to ``base``, keeping any query string (Azure api-version).

    ``default_prefix`` is added when the base URL has no path at all, so
    "https://api.example.com" and "https://api.example.com/v1" both work.
    """
    parts = urlsplit(base.strip())
    base_path = parts.path.rstrip("/")
    if not base_path and default_prefix:
        base_path = default_prefix
    return urlunsplit((parts.scheme, parts.netloc, f"{base_path}{path}", parts.query, ""))


def _openai_url(cfg: ProviderConfig, path: str) -> str:
    prefix = "/openai/v1" if cfg.adapter == "azure-openai" else "/v1"
    return _join(cfg.base_url, path, default_prefix=prefix)


def _anthropic_url(cfg: ProviderConfig, path: str) -> str:
    # The Anthropic SDK appends "/v1/messages" to its base URL; accept a base
    # entered with a trailing /v1 too.
    parts = urlsplit(cfg.base_url.strip())
    base_path = parts.path.rstrip("/").removesuffix("/v1")
    return urlunsplit((parts.scheme, parts.netloc, f"{base_path}/v1{path}", parts.query, ""))


def _gemini_url(cfg: ProviderConfig, path: str) -> str:
    return _join(cfg.base_url, path, default_prefix="/v1beta")


def _http_error(resp_status: int, reason: str, provider: str, model: str, body: str) -> RuntimeError:
    return RuntimeError(f"{resp_status} {reason} from {provider} for model '{model}': {body}")


def _chunk(chunk_id: str, model: str, delta: dict, finish_reason: str | None, usage: dict | None = None) -> str:
    event: dict[str, Any] = {
        "id": chunk_id,
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": model,
        "choices": [{"index": 0, "delta": delta, "finish_reason": finish_reason}],
    }
    if usage is not None:
        event["usage"] = usage
    return "data: " + json.dumps(event)


def _usage(prompt: int, completion: int) -> dict:
    return {"prompt_tokens": prompt, "completion_tokens": completion, "total_tokens": prompt + completion}


def _text(content: Any) -> str:
    """Flatten OpenAI message content (string or list of parts) to text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(p.get("text", "") for p in content if isinstance(p, dict))
    return "" if content is None else str(content)


# ── OpenAI Chat Completions (and Azure OpenAI) ───────────────────────────


def _openai_headers(cfg: ProviderConfig) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if cfg.api_key:
        if cfg.adapter == "azure-openai":
            headers["api-key"] = cfg.api_key
        else:
            headers["Authorization"] = f"Bearer {cfg.api_key}"
    return headers


def _uses_max_completion_tokens(cfg: ProviderConfig) -> bool:
    # OpenAI's own API (and Azure) rejects `max_tokens` on reasoning models
    # (o1/o3/o4, gpt-5…) and accepts `max_completion_tokens` on all models.
    # Third-party OpenAI-compatible servers mostly only know `max_tokens`.
    host = urlsplit(cfg.base_url).netloc.lower()
    return cfg.adapter == "azure-openai" or host == "api.openai.com"


def _openai_payload(
    cfg: ProviderConfig, model: str, messages: list[dict], temperature: float, max_tokens: int | None, *, stream: bool
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "stream": stream,
    }
    if max_tokens is not None:
        payload["max_completion_tokens" if _uses_max_completion_tokens(cfg) else "max_tokens"] = max_tokens
    if stream:
        # Ask for token usage in the final chunk; without it streamed calls
        # log 0 tokens / $0 and budget enforcement never accumulates spend.
        payload["stream_options"] = {"include_usage": True}
    return payload


async def openai_chat(
    cfg: ProviderConfig, *, model: str, messages: list[dict], temperature: float, max_tokens: int | None
) -> ProviderResponse:
    start = time.perf_counter_ns()
    resp = await get_http_client().post(
        _openai_url(cfg, "/chat/completions"),
        json=_openai_payload(cfg, model, messages, temperature, max_tokens, stream=False),
        headers=_openai_headers(cfg),
    )
    latency = (time.perf_counter_ns() - start) // 1_000_000
    if resp.is_error:
        raise _http_error(resp.status_code, resp.reason_phrase, cfg.name, model, resp.text)

    data = resp.json()
    choice = data["choices"][0]
    usage = data.get("usage") or {}
    return ProviderResponse(
        content=choice.get("message", {}).get("content") or "",
        input_tokens=usage.get("prompt_tokens", 0),
        output_tokens=usage.get("completion_tokens", 0),
        model=data.get("model", model),
        provider=cfg.name,
        raw_response=data,
        latency_ms=latency,
        finish_reason=choice.get("finish_reason") or "stop",
    )


async def openai_stream(
    cfg: ProviderConfig, *, model: str, messages: list[dict], temperature: float, max_tokens: int | None
) -> AsyncGenerator[str, None]:
    async with get_http_client().stream(
        "POST",
        _openai_url(cfg, "/chat/completions"),
        json=_openai_payload(cfg, model, messages, temperature, max_tokens, stream=True),
        headers=_openai_headers(cfg),
    ) as resp:
        if resp.is_error:
            body = await resp.aread()
            raise _http_error(resp.status_code, resp.reason_phrase, cfg.name, model, body.decode(errors="replace"))
        async for raw_line in resp.aiter_lines():
            line = raw_line.strip()
            if line:
                yield line


# ── Anthropic Messages API ───────────────────────────────────────────────


def _anthropic_headers(cfg: ProviderConfig) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "x-api-key": cfg.api_key,
        "anthropic-version": "2023-06-01",
    }


def _anthropic_payload(
    model: str, messages: list[dict], temperature: float, max_tokens: int | None, *, stream: bool
) -> dict[str, Any]:
    """Convert OpenAI-style messages to an Anthropic Messages API payload."""
    system_parts: list[str] = []
    anthropic_messages: list[dict] = []
    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "system":
            system_parts.append(_text(content))
        elif role in ("user", "assistant"):
            anthropic_messages.append({"role": role, "content": content})

    payload: dict[str, Any] = {
        "model": model,
        "messages": anthropic_messages,
        "max_tokens": max_tokens or 1024,
        # Anthropic's range is 0–1; OpenAI clients may send up to 2.
        "temperature": min(temperature, 1.0),
    }
    if system_parts:
        payload["system"] = "\n".join(system_parts)
    if stream:
        payload["stream"] = True
    return payload


async def anthropic_chat(
    cfg: ProviderConfig, *, model: str, messages: list[dict], temperature: float, max_tokens: int | None
) -> ProviderResponse:
    start = time.perf_counter_ns()
    resp = await get_http_client().post(
        _anthropic_url(cfg, "/messages"),
        json=_anthropic_payload(model, messages, temperature, max_tokens, stream=False),
        headers=_anthropic_headers(cfg),
    )
    latency = (time.perf_counter_ns() - start) // 1_000_000
    if resp.is_error:
        raise _http_error(resp.status_code, resp.reason_phrase, cfg.name, model, resp.text)

    data = resp.json()
    usage = data.get("usage") or {}
    return ProviderResponse(
        content="".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"),
        input_tokens=usage.get("input_tokens", 0),
        output_tokens=usage.get("output_tokens", 0),
        model=data.get("model", model),
        provider=cfg.name,
        raw_response=data,
        latency_ms=latency,
        finish_reason=data.get("stop_reason") or "stop",
    )


async def anthropic_stream(
    cfg: ProviderConfig, *, model: str, messages: list[dict], temperature: float, max_tokens: int | None
) -> AsyncGenerator[str, None]:
    """Convert Anthropic's SSE events to OpenAI-compatible SSE lines."""
    async with get_http_client().stream(
        "POST",
        _anthropic_url(cfg, "/messages"),
        json=_anthropic_payload(model, messages, temperature, max_tokens, stream=True),
        headers=_anthropic_headers(cfg),
    ) as resp:
        if resp.is_error:
            body = await resp.aread()
            raise _http_error(resp.status_code, resp.reason_phrase, cfg.name, model, body.decode(errors="replace"))

        chunk_id = f"anth_{uuid.uuid4().hex[:12]}"
        response_model = model
        input_tokens = output_tokens = 0

        async for raw_line in resp.aiter_lines():
            line = raw_line.strip()
            if not line.startswith("data: "):
                continue
            try:
                event = json.loads(line[6:])
            except json.JSONDecodeError:
                continue

            event_type = event.get("type", "")
            if event_type == "message_start":
                msg = event.get("message", {})
                response_model = msg.get("model", model)
                input_tokens = int((msg.get("usage") or {}).get("input_tokens", 0) or 0)
            elif event_type == "content_block_delta":
                token = event.get("delta", {}).get("text", "")
                if token:
                    yield _chunk(chunk_id, response_model, {"role": "assistant", "content": token}, None)
            elif event_type == "message_delta":
                output_tokens = int((event.get("usage") or {}).get("output_tokens", 0) or output_tokens)
                stop_reason = event.get("delta", {}).get("stop_reason")
                if stop_reason:
                    yield _chunk(chunk_id, response_model, {}, stop_reason, _usage(input_tokens, output_tokens))
            elif event_type == "message_stop":
                break
            elif event_type == "error":
                raise RuntimeError(f"anthropic stream error from {cfg.name}: {event.get('error')}")

        yield "data: [DONE]"


# ── Google Gemini generateContent API ────────────────────────────────────

_GEMINI_FINISH = {"STOP": "stop", "MAX_TOKENS": "length", "SAFETY": "content_filter", "RECITATION": "content_filter"}


def _gemini_headers(cfg: ProviderConfig) -> dict[str, str]:
    return {"Content-Type": "application/json", "x-goog-api-key": cfg.api_key}


def _gemini_model_path(model: str) -> str:
    return model if model.startswith("models/") else f"models/{model}"


def _gemini_payload(messages: list[dict], temperature: float, max_tokens: int | None) -> dict[str, Any]:
    system_parts: list[str] = []
    contents: list[dict] = []
    for msg in messages:
        role = msg.get("role", "")
        text = _text(msg.get("content", ""))
        if role == "system":
            system_parts.append(text)
        elif role in ("user", "assistant"):
            contents.append({"role": "model" if role == "assistant" else "user", "parts": [{"text": text}]})

    generation: dict[str, Any] = {"temperature": temperature}
    if max_tokens is not None:
        generation["maxOutputTokens"] = max_tokens
    payload: dict[str, Any] = {"contents": contents, "generationConfig": generation}
    if system_parts:
        payload["systemInstruction"] = {"parts": [{"text": "\n".join(system_parts)}]}
    return payload


def _gemini_parse(data: dict) -> tuple[str, str | None, int, int]:
    """``(text, finish_reason, prompt_tokens, completion_tokens)`` of one response."""
    candidates = data.get("candidates") or [{}]
    candidate = candidates[0]
    parts = (candidate.get("content") or {}).get("parts") or []
    # Thinking models return their reasoning as parts flagged `thought`.
    text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
    raw_finish = candidate.get("finishReason")
    finish = _GEMINI_FINISH.get(raw_finish, raw_finish.lower()) if raw_finish else None
    usage = data.get("usageMetadata") or {}
    return text, finish, usage.get("promptTokenCount", 0), usage.get("candidatesTokenCount", 0)


async def gemini_chat(
    cfg: ProviderConfig, *, model: str, messages: list[dict], temperature: float, max_tokens: int | None
) -> ProviderResponse:
    start = time.perf_counter_ns()
    resp = await get_http_client().post(
        _gemini_url(cfg, f"/{_gemini_model_path(model)}:generateContent"),
        json=_gemini_payload(messages, temperature, max_tokens),
        headers=_gemini_headers(cfg),
    )
    latency = (time.perf_counter_ns() - start) // 1_000_000
    if resp.is_error:
        raise _http_error(resp.status_code, resp.reason_phrase, cfg.name, model, resp.text)

    data = resp.json()
    text, finish, prompt_tokens, completion_tokens = _gemini_parse(data)
    return ProviderResponse(
        content=text,
        input_tokens=prompt_tokens,
        output_tokens=completion_tokens,
        model=data.get("modelVersion", model),
        provider=cfg.name,
        raw_response=data,
        latency_ms=latency,
        finish_reason=finish or "stop",
    )


async def gemini_stream(
    cfg: ProviderConfig, *, model: str, messages: list[dict], temperature: float, max_tokens: int | None
) -> AsyncGenerator[str, None]:
    url = _gemini_url(cfg, f"/{_gemini_model_path(model)}:streamGenerateContent")
    url += ("&" if "?" in url else "?") + "alt=sse"
    async with get_http_client().stream(
        "POST", url, json=_gemini_payload(messages, temperature, max_tokens), headers=_gemini_headers(cfg)
    ) as resp:
        if resp.is_error:
            body = await resp.aread()
            raise _http_error(resp.status_code, resp.reason_phrase, cfg.name, model, body.decode(errors="replace"))

        chunk_id = f"gem_{uuid.uuid4().hex[:12]}"
        response_model = model
        finish: str | None = None
        prompt_tokens = completion_tokens = 0

        async for raw_line in resp.aiter_lines():
            line = raw_line.strip()
            if not line.startswith("data: "):
                continue
            try:
                event = json.loads(line[6:])
            except json.JSONDecodeError:
                continue
            response_model = event.get("modelVersion", response_model)
            text, chunk_finish, p_tokens, c_tokens = _gemini_parse(event)
            prompt_tokens = p_tokens or prompt_tokens
            completion_tokens = c_tokens or completion_tokens
            finish = chunk_finish or finish
            if text:
                yield _chunk(chunk_id, response_model, {"role": "assistant", "content": text}, None)

        yield _chunk(chunk_id, response_model, {}, finish or "stop", _usage(prompt_tokens, completion_tokens))
        yield "data: [DONE]"


# ── Registry ─────────────────────────────────────────────────────────────

_CHAT = {
    "openai": openai_chat,
    "azure-openai": openai_chat,
    "anthropic": anthropic_chat,
    "gemini": gemini_chat,
}
_STREAM = {
    "openai": openai_stream,
    "azure-openai": openai_stream,
    "anthropic": anthropic_stream,
    "gemini": gemini_stream,
}


async def chat(cfg: ProviderConfig, **kwargs: Any) -> ProviderResponse:
    return await _CHAT[cfg.adapter](cfg, **kwargs)


def stream(cfg: ProviderConfig, **kwargs: Any) -> AsyncGenerator[str, None]:
    return _STREAM[cfg.adapter](cfg, **kwargs)


def models_request(cfg: ProviderConfig) -> tuple[str, dict[str, str]]:
    """``(url, headers)`` of the cheap model-list endpoint, for health probes."""
    if cfg.adapter == "anthropic":
        return _anthropic_url(cfg, "/models"), _anthropic_headers(cfg)
    if cfg.adapter == "gemini":
        return _gemini_url(cfg, "/models"), _gemini_headers(cfg)
    return _openai_url(cfg, "/models"), _openai_headers(cfg)
