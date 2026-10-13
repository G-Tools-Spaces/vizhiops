"""The shared outbound HTTP client (app.providers.http_client)."""

from __future__ import annotations

import httpx

from app.providers.http_client import DEFAULT_TIMEOUT, close_http_client, get_http_client


async def test_same_client_within_a_loop():
    a = get_http_client()
    b = get_http_client()
    assert a is b
    assert not a.is_closed
    await close_http_client()
    assert a.is_closed


async def test_new_client_after_close():
    a = get_http_client()
    await close_http_client()
    b = get_http_client()
    assert b is not a and not b.is_closed
    await close_http_client()


def test_connect_timeout_is_short_but_total_budget_unchanged():
    assert isinstance(DEFAULT_TIMEOUT, httpx.Timeout)
    assert DEFAULT_TIMEOUT.connect == 10.0
    assert DEFAULT_TIMEOUT.read == 120.0
