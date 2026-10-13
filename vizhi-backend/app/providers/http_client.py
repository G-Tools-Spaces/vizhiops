"""One shared HTTP client for every outbound provider call.

Every upstream call used to open its own ``httpx.AsyncClient``: a fresh TLS
context plus a new TCP+TLS handshake per request, paid twice per Ping chat
turn. One client per process keeps connections alive between calls, so the
second request to the same provider reuses an open socket.

The client is tied to the event loop it was created on. uvicorn runs one loop
for the life of the process; tests spin up a loop per test, so a stale client
from a finished loop is replaced instead of reused.
"""

from __future__ import annotations

import asyncio

import httpx

# Total budget stays at the 120 s the provider calls always had; the connect
# timeout is new so a hung provider fails over in seconds, not minutes.
DEFAULT_TIMEOUT = httpx.Timeout(120.0, connect=10.0)
_LIMITS = httpx.Limits(max_connections=50, max_keepalive_connections=20, keepalive_expiry=60.0)

_client: httpx.AsyncClient | None = None
_client_loop: asyncio.AbstractEventLoop | None = None


def get_http_client() -> httpx.AsyncClient:
    """The process-wide client, created lazily on the running loop."""
    global _client, _client_loop
    loop = asyncio.get_running_loop()
    if _client is None or _client.is_closed or _client_loop is not loop:
        _client = httpx.AsyncClient(timeout=DEFAULT_TIMEOUT, limits=_LIMITS)
        _client_loop = loop
    return _client


async def close_http_client() -> None:
    """Close the shared client (app shutdown)."""
    global _client, _client_loop
    client, _client, _client_loop = _client, None, None
    if client is not None and not client.is_closed:
        await client.aclose()
