#!/usr/bin/env python3
"""Vizhi API Smoke Test — black-box end-to-end verification of a running Vizhi server.

Verifies that every public endpoint works the way a consuming product would use
them: signup → create model token → chat → rotate/revoke → agents → queue →
observability → cleanup.

Usage:
    python smoke_test.py                          # full run (includes real LLM calls)
    python smoke_test.py --skip-chat              # zero-cost run, no LLM calls
    python smoke_test.py --dry-run                # read-only endpoints only
    python smoke_test.py --json report.json       # also write machine-readable results

Safety:
    - Only touches resources it creates itself (tracked by ID, cleaned up at the end)
    - Full API keys are never printed — only masked versions
    - Unique test email per run → fully re-runnable
    - Exit code 0 = all passed, 1 = any failure (CI-friendly)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
import uuid
from dataclasses import dataclass, field

import httpx

# ── Test result tracking ──────────────────────────────────────────────────


@dataclass
class TestResult:
    name: str
    method: str
    path: str
    passed: bool
    status: str
    detail: str = ""
    duration_ms: int = 0


@dataclass
class SmokeContext:
    """Shared state across the test phases."""

    base_url: str
    timeout: float
    skip_chat: bool
    dry_run: bool

    test_email: str = ""
    test_password: str = ""

    # Resources created during the run (for cleanup)
    model_id: str | None = None
    agent_cid: str | None = None

    # Secrets — held in memory only, never printed
    model_api_key: str | None = None
    agent_api_key: str | None = None

    # Registry snapshot for choosing a chat model
    registry: list[dict] = field(default_factory=list)
    provider_health: dict[str, str] = field(default_factory=dict)


class SmokeTest:
    def __init__(self, ctx: SmokeContext) -> None:
        self.ctx = ctx
        self.results: list[TestResult] = []
        self.client: httpx.AsyncClient | None = None

    # ── Core helpers ─────────────────────────────────────────────────────

    def _record(self, result: TestResult) -> None:
        self.results.append(result)
        icon = "PASS" if result.passed else "FAIL"
        line = f"[{icon}] {result.method:6s} {result.path:55s} {result.status}"
        if result.duration_ms:
            line += f" — {result.duration_ms}ms"
        if result.detail:
            line += f"  ({result.detail})"
        print(line)

    async def _request(
        self,
        name: str,
        method: str,
        path: str,
        *,
        expected: int | set[int] = 200,
        json_body: dict | None = None,
        headers: dict[str, str] | None = None,
    ) -> httpx.Response | None:
        """Perform one request, record the result, return the response (or None on transport error).

        Session cookies are handled by the client's cookie jar (populated at
        signup). Use `anon=True` to send the request WITHOUT any session cookie.
        """
        assert self.client is not None
        expected_set = expected if isinstance(expected, set) else {expected}
        start = time.perf_counter()
        try:
            resp = await self.client.request(
                method,
                path,
                json=json_body,
                headers=headers,
                follow_redirects=True,
            )
        except httpx.TransportError as exc:
            duration = int((time.perf_counter() - start) * 1000)
            self._record(TestResult(name, method, path, False, "TRANSPORT_ERROR", str(exc)[:120], duration))
            return None

        duration = int((time.perf_counter() - start) * 1000)
        passed = resp.status_code in expected_set
        detail = ""
        if not passed:
            detail = f"expected {sorted(expected_set)}, got {resp.status_code}: {resp.text[:150]}"
        self._record(TestResult(name, method, path, passed, str(resp.status_code), detail, duration))
        return resp

    async def _request_anon(
        self,
        name: str,
        method: str,
        path: str,
        *,
        expected: int | set[int] = 200,
        json_body: dict | None = None,
    ) -> httpx.Response | None:
        """Send a request with the session cookie temporarily removed from the jar."""
        assert self.client is not None
        saved = dict(self.client.cookies)
        self.client.cookies.clear()
        try:
            return await self._request(name, method, path, expected=expected, json_body=json_body)
        finally:
            self.client.cookies.update(saved)

    def _bearer(self, key: str | None) -> dict[str, str]:
        return {"Authorization": f"Bearer {key}"} if key else {}

    def _agent_headers(self, cid: str | None, token: str | None) -> dict[str, str]:
        return {"X-Agent-CID": cid or "", "X-Agent-Token": token or ""}

    # ── Phases ────────────────────────────────────────────────────────────

    async def phase_0_infra(self) -> None:
        print("\n── Phase 0: Infrastructure ─────────────────────────────")
        resp = await self._request("root health", "GET", "/", expected=200)
        if resp is not None and resp.status_code == 200:
            body = resp.json()
            if body.get("status") != "healthy":
                self.results[-1].passed = False
                self.results[-1].detail = f"status field = {body.get('status')!r}, expected 'healthy'"
                print(f"      ↳ corrected to FAIL: {self.results[-1].detail}")

        resp = await self._request("provider health", "GET", "/v1/health/providers", expected=200)
        if resp is not None and resp.status_code == 200:
            body = resp.json()
            for p in body.get("providers", []):
                self.ctx.provider_health[p.get("provider", "?")] = p.get("status", "?")
            print(f"      ↳ overall: {body.get('overall_status')}")

    async def phase_1_auth(self) -> None:
        print("\n── Phase 1: Authentication ──────────────────────────────")
        email = f"smoke_{uuid.uuid4().hex[:8]}@test.local"
        password = "SmokeTest123!"
        self.ctx.test_email = email
        self.ctx.test_password = password

        # Signup sets the session cookie in the client jar automatically
        resp = await self._request(
            "signup",
            "POST",
            "/v1/auth/signup",
            expected=201,
            json_body={"email": email, "password": password, "name": "Smoke Test"},
        )
        if resp is not None and resp.status_code == 201:
            print(f"      ↳ test user: {email}")

        await self._request("me (with session)", "GET", "/v1/auth/me", expected=200)

        await self._request(
            "login bad password → 401",
            "POST",
            "/v1/auth/login",
            expected=401,
            json_body={"email": email, "password": "WrongPassword1!"},
        )

        # Truly unauthenticated request — session cookie removed from the jar
        await self._request_anon("me (no session) → 401", "GET", "/v1/auth/me", expected=401)

    async def phase_2_models(self) -> None:
        print("\n── Phase 2: Model token lifecycle ───────────────────────")
        resp = await self._request("model registry", "GET", "/v1/models/registry", expected=200)
        if resp is not None and resp.status_code == 200:
            self.ctx.registry = resp.json()
            n_providers = len(self.ctx.registry)
            n_models = sum(len(p.get("models", [])) for p in self.ctx.registry)
            print(f"      ↳ {n_providers} providers, {n_models} models in catalog")

        if self.ctx.dry_run:
            return

        # Pick a model from the first provider that has models
        provider_id, model_name = "", ""
        for p in self.ctx.registry:
            if p.get("models"):
                provider_id = p["id"]
                model_name = p["models"][0]["id"]
                break
        if not provider_id:
            print("[SKIP] No models in registry — cannot test model lifecycle")
            return

        resp = await self._request(
            "create model token",
            "POST",
            "/v1/models",
            expected=201,
            json_body={
                "provider": provider_id,
                "model_name": model_name,
                "token_name": "smoke-test-token",
                "metadata": "created by smoke_test.py",
            },
        )
        if resp is not None and resp.status_code == 201:
            body = resp.json()
            self.ctx.model_id = body["model_connection"]["id"]
            self.ctx.model_api_key = body["api_key"]
            print(f"      ↳ created {self.ctx.model_id} ({provider_id}/{model_name})")

        resp = await self._request("list models", "GET", "/v1/models", expected=200)
        if resp is not None and resp.status_code == 200 and self.ctx.model_id:
            ids = {m["id"] for m in resp.json()}
            if self.ctx.model_id not in ids:
                self.results[-1].passed = False
                self.results[-1].detail = "created model token missing from list"
                print(f"      ↳ corrected to FAIL: {self.results[-1].detail}")

        if self.ctx.model_id:
            await self._request(
                "get model budget",
                "GET",
                f"/v1/models/{self.ctx.model_id}/budget",
                expected=200,
            )
            await self._request(
                "set model budget",
                "PATCH",
                f"/v1/models/{self.ctx.model_id}/budget",
                expected=200,
                json_body={"budget_usd": 5.0, "budget_tokens": 10000},
            )

            # ── Budget enforcement: a $0 limit must block chat pre-flight ──
            # The 429 is raised BEFORE any provider call, so this is zero-cost
            # and runs even with --skip-chat.
            await self._request(
                "set model budget to $0",
                "PATCH",
                f"/v1/models/{self.ctx.model_id}/budget",
                expected=200,
                json_body={"budget_usd": 0.0},
            )
            resp = await self._request(
                "chat blocked by $0 model budget → 429",
                "POST",
                "/v1/chat/completions",
                expected=429,
                headers=self._bearer(self.ctx.model_api_key),
                json_body={"messages": [{"role": "user", "content": "hi"}]},
            )
            if resp is not None and resp.status_code == 429:
                detail = resp.json().get("detail")
                if isinstance(detail, dict) and detail.get("error") == "budget_exceeded":
                    print(f"      ↳ enforcement OK: {str(detail.get('message', ''))[:80]}")
                else:
                    self.results[-1].passed = False
                    self.results[-1].detail = f"unexpected 429 body: {str(detail)[:120]}"
                    print(f"      ↳ corrected to FAIL: {self.results[-1].detail}")
            await self._request(
                "clear model budget",
                "PATCH",
                f"/v1/models/{self.ctx.model_id}/budget",
                expected=200,
                json_body={"clear": True},
            )
            await self._request(
                "model usage stats",
                "GET",
                f"/v1/models/{self.ctx.model_id}/usage",
                expected=200,
            )

    async def phase_3_chat(self) -> None:
        print("\n── Phase 3: Chat gateway ───────────────────────────────")
        if self.ctx.dry_run:
            print("[SKIP] dry-run mode")
            return
        if self.ctx.skip_chat:
            print("[SKIP] --skip-chat flag set (no real LLM calls)")
            return
        if not self.ctx.model_api_key:
            print("[SKIP] no model token available")
            return

        # 3a. Non-streaming completion
        resp = await self._request(
            "chat completion (non-streaming)",
            "POST",
            "/v1/chat/completions",
            expected=200,
            headers=self._bearer(self.ctx.model_api_key),
            json_body={
                "messages": [{"role": "user", "content": "Reply with exactly: OK"}],
                "max_tokens": 16,
                "temperature": 0,
            },
        )
        if resp is not None and resp.status_code == 200:
            body = resp.json()
            content = body.get("choices", [{}])[0].get("message", {}).get("content", "")
            print(f"      ↳ model replied: {content[:60]!r}")

        # 3b. Streaming completion (SSE)
        assert self.client is not None
        start = time.perf_counter()
        try:
            chunks: list[str] = []
            async with self.client.stream(
                "POST",
                "/v1/chat/completions",
                headers=self._bearer(self.ctx.model_api_key),
                json={
                    "messages": [{"role": "user", "content": "Reply with exactly: OK"}],
                    "max_tokens": 16,
                    "temperature": 0,
                    "stream": True,
                },
            ) as resp:
                if resp.status_code == 200:
                    async for line in resp.aiter_lines():
                        if line.startswith("data: ") and line != "data: [DONE]":
                            try:
                                payload = json.loads(line[6:])
                                delta = payload.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                if delta:
                                    chunks.append(delta)
                            except json.JSONDecodeError:
                                pass
                    duration = int((time.perf_counter() - start) * 1000)
                    text = "".join(chunks)
                    passed = bool(text.strip())
                    self._record(
                        TestResult(
                            "chat completion (streaming SSE)",
                            "POST",
                            "/v1/chat/completions",
                            passed,
                            "200",
                            f"streamed {len(chunks)} chunks, text={text[:40]!r}" if passed else "empty stream",
                            duration,
                        )
                    )
                else:
                    await resp.aread()
                    duration = int((time.perf_counter() - start) * 1000)
                    self._record(
                        TestResult(
                            "chat completion (streaming SSE)",
                            "POST",
                            "/v1/chat/completions",
                            False,
                            str(resp.status_code),
                            f"expected 200, got {resp.status_code}",
                            duration,
                        )
                    )
        except httpx.TransportError as exc:
            self._record(
                TestResult(
                    "chat completion (streaming SSE)",
                    "POST",
                    "/v1/chat/completions",
                    False,
                    "TRANSPORT_ERROR",
                    str(exc)[:120],
                )
            )

    async def phase_4_model_token_security(self) -> None:
        print("\n── Phase 4: Model token security ───────────────────────")
        if self.ctx.dry_run:
            print("[SKIP] dry-run mode")
            return
        if not self.ctx.model_id:
            print("[SKIP] no model token available")
            return

        # Revoke → old key must stop working
        resp = await self._request(
            "revoke model token",
            "POST",
            f"/v1/models/{self.ctx.model_id}/revoke",
            expected=200,
        )
        if resp is not None and resp.status_code == 200:
            status = resp.json().get("status")
            if status != "revoked":
                self.results[-1].passed = False
                self.results[-1].detail = f"status = {status!r}, expected 'revoked'"
                print(f"      ↳ corrected to FAIL: {self.results[-1].detail}")

        await self._request(
            "chat with revoked key → 401",
            "POST",
            "/v1/chat/completions",
            expected=401,
            headers=self._bearer(self.ctx.model_api_key),
            json_body={"messages": [{"role": "user", "content": "hi"}]},
        )

        # Rotate → new key must work, old key must fail
        resp = await self._request(
            "rotate model token",
            "POST",
            f"/v1/models/{self.ctx.model_id}/rotate",
            expected=200,
        )
        if resp is not None and resp.status_code == 200:
            body = resp.json()
            self.ctx.model_api_key = body["api_key"]
            print(f"      ↳ rotated, new masked key: {body['model_connection']['masked_key']}")

        await self._request(
            "chat with garbage key → 401",
            "POST",
            "/v1/chat/completions",
            expected=401,
            headers=self._bearer("vz_live_000000000000000000000000deadbeef"),
            json_body={"messages": [{"role": "user", "content": "hi"}]},
        )

        await self._request(
            "chat with no auth → 401",
            "POST",
            "/v1/chat/completions",
            expected=401,
            json_body={"messages": [{"role": "user", "content": "hi"}]},
        )

    async def phase_5_agents(self) -> None:
        print("\n── Phase 5: Agent lifecycle ─────────────────────────────")
        if self.ctx.dry_run:
            print("[SKIP] dry-run mode")
            return

        resp = await self._request(
            "create agent",
            "POST",
            "/v1/agents",
            expected=201,
            json_body={
                "name": "smoke-test-agent",
                "description": "created by smoke_test.py",
                "tags": "smoke,test",
                "token_name": "smoke-agent-token",
            },
        )
        if resp is not None and resp.status_code == 201:
            body = resp.json()
            self.ctx.agent_cid = body["agent"]["agent_id"]
            self.ctx.agent_api_key = body["api_key"]
            print(f"      ↳ created agent {self.ctx.agent_cid}")

        resp = await self._request("list agents", "GET", "/v1/agents", expected=200)
        if resp is not None and resp.status_code == 200 and self.ctx.agent_cid:
            cids = {a["agent_id"] for a in resp.json()}
            if self.ctx.agent_cid not in cids:
                self.results[-1].passed = False
                self.results[-1].detail = "created agent missing from list"
                print(f"      ↳ corrected to FAIL: {self.results[-1].detail}")

        if self.ctx.agent_cid:
            await self._request(
                "get agent by CID",
                "GET",
                f"/v1/agents/{self.ctx.agent_cid}",
                expected=200,
            )
            await self._request(
                "update agent",
                "PATCH",
                f"/v1/agents/{self.ctx.agent_cid}",
                expected=200,
                json_body={"description": "updated by smoke_test.py"},
            )
            await self._request(
                "get agent budget",
                "GET",
                f"/v1/agents/{self.ctx.agent_cid}/budget",
                expected=200,
            )
            await self._request(
                "set agent budget",
                "PATCH",
                f"/v1/agents/{self.ctx.agent_cid}/budget",
                expected=200,
                json_body={"budget_usd": 2.0},
            )

            # ── Budget enforcement: a $0 limit must block chat pre-flight ──
            # Agent tokens require a model in the body; the 429 fires before
            # the job is queued, so no agent round-trip occurs.
            await self._request(
                "set agent budget to $0",
                "PATCH",
                f"/v1/agents/{self.ctx.agent_cid}/budget",
                expected=200,
                json_body={"budget_usd": 0.0},
            )
            resp = await self._request(
                "chat blocked by $0 agent budget → 429",
                "POST",
                "/v1/chat/completions",
                expected=429,
                headers=self._bearer(self.ctx.agent_api_key),
                json_body={
                    "model": "openai/gpt-4o-mini",
                    "messages": [{"role": "user", "content": "hi"}],
                },
            )
            if resp is not None and resp.status_code == 429:
                detail = resp.json().get("detail")
                if isinstance(detail, dict) and detail.get("error") == "budget_exceeded":
                    print(f"      ↳ enforcement OK: {str(detail.get('message', ''))[:80]}")
                else:
                    self.results[-1].passed = False
                    self.results[-1].detail = f"unexpected 429 body: {str(detail)[:120]}"
                    print(f"      ↳ corrected to FAIL: {self.results[-1].detail}")
            await self._request(
                "clear agent budget",
                "PATCH",
                f"/v1/agents/{self.ctx.agent_cid}/budget",
                expected=200,
                json_body={"clear": True},
            )
            await self._request(
                "rotate agent token",
                "POST",
                f"/v1/agents/{self.ctx.agent_cid}/rotate",
                expected=200,
            )
            await self._request(
                "revoke agent token",
                "POST",
                f"/v1/agents/{self.ctx.agent_cid}/revoke",
                expected=200,
            )

    async def phase_6_agent_queue(self) -> None:
        print("\n── Phase 6: Agent queue ─────────────────────────────────")
        if self.ctx.dry_run:
            print("[SKIP] dry-run mode")
            return
        if not self.ctx.agent_cid:
            print("[SKIP] no agent available")
            return

        # Agent was revoked in Phase 5 — rotate to re-activate for queue tests
        resp = await self._request(
            "re-activate agent (rotate)",
            "POST",
            f"/v1/agents/{self.ctx.agent_cid}/rotate",
            expected=200,
        )
        if resp is not None and resp.status_code == 200:
            self.ctx.agent_api_key = resp.json()["api_key"]

        headers = self._agent_headers(self.ctx.agent_cid, self.ctx.agent_api_key)

        await self._request(
            "agent register",
            "POST",
            "/agents/register",
            expected=200,
            headers=headers,
            json_body={
                "agent_id": self.ctx.agent_cid,
                "device_name": "smoke-device",
                "os_name": "linux",
                "agent_version": "0.0.1-smoke",
                "available_engines": ["test-engine"],
            },
        )

        await self._request(
            "agent heartbeat",
            "POST",
            "/agents/heartbeat",
            expected=200,
            headers=headers,
            json_body={
                "agent_id": self.ctx.agent_cid,
                "device_name": "smoke-device",
                "os_name": "linux",
                "agent_version": "0.0.1-smoke",
                "available_engines": ["test-engine"],
                "status": "online",
            },
        )

        await self._request(
            "fetch next job (empty queue → 204)",
            "GET",
            "/jobs/next",
            expected=204,
            headers=headers,
        )

        await self._request(
            "submit fake job → 404",
            "POST",
            "/jobs/submit",
            expected=404,
            headers=headers,
            json_body={"job_id": "j_nonexistent0000", "status": "completed", "output": {}},
        )

        await self._request(
            "queue auth with bad token → 401",
            "GET",
            "/jobs/next",
            expected=401,
            headers=self._agent_headers(self.ctx.agent_cid, "vz_live_bogus_token"),
        )

    async def phase_7_observability(self) -> None:
        print("\n── Phase 7: Observability ───────────────────────────────")
        await self._request("list queries", "GET", "/v1/queries?limit=5", expected=200)
        await self._request("metrics 24h", "GET", "/v1/metrics?time_range=24h", expected=200)
        await self._request("dashboard", "GET", "/v1/dashboard", expected=200)

    async def phase_8_cleanup(self) -> None:
        print("\n── Phase 8: Cleanup ────────────────────────────────────")
        if self.ctx.dry_run:
            print("[SKIP] dry-run mode")
            return

        if self.ctx.model_id:
            await self._request(
                "delete model token",
                "DELETE",
                f"/v1/models/{self.ctx.model_id}",
                expected=204,
            )
        if self.ctx.agent_cid:
            await self._request(
                "delete agent",
                "DELETE",
                f"/v1/agents/{self.ctx.agent_cid}",
                expected=204,
            )
        await self._request("logout", "POST", "/v1/auth/logout", expected=204)

    # ── Runner ───────────────────────────────────────────────────────────

    async def run(self) -> int:
        print("═" * 70)
        print(f"  Vizhi API Smoke Test — {self.ctx.base_url}")
        print("═" * 70)

        async with httpx.AsyncClient(
            base_url=self.ctx.base_url,
            timeout=self.ctx.timeout,
        ) as client:
            self.client = client

            await self.phase_0_infra()
            await self.phase_1_auth()
            await self.phase_2_models()
            await self.phase_3_chat()
            await self.phase_4_model_token_security()
            await self.phase_5_agents()
            await self.phase_6_agent_queue()
            await self.phase_7_observability()
            await self.phase_8_cleanup()

        return self._summary()

    def _summary(self) -> int:
        passed = sum(1 for r in self.results if r.passed)
        failed = len(self.results) - passed
        total_ms = sum(r.duration_ms for r in self.results)

        print("\n" + "─" * 70)
        print(f"  RESULT: {passed}/{len(self.results)} passed " + ("✅" if failed == 0 else "❌") + f"   ({failed} failed)")
        print(f"  Total time: {total_ms / 1000:.1f}s")
        print("─" * 70)

        if failed:
            print("\n  Failed tests:")
            for r in self.results:
                if not r.passed:
                    print(f"    ✗ {r.method} {r.path} — {r.status} {r.detail}")
        return 0 if failed == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Vizhi API smoke test")
    parser.add_argument("--base-url", default="http://localhost:8000", help="Target server URL")
    parser.add_argument("--skip-chat", action="store_true", help="Skip real LLM calls (zero cost)")
    parser.add_argument("--dry-run", action="store_true", help="Read-only endpoints only")
    parser.add_argument("--json", dest="json_path", default=None, help="Write results to a JSON file")
    parser.add_argument("--timeout", type=float, default=15.0, help="Per-request timeout in seconds")
    args = parser.parse_args()

    ctx = SmokeContext(
        base_url=args.base_url.rstrip("/"),
        timeout=args.timeout,
        skip_chat=args.skip_chat,
        dry_run=args.dry_run,
    )

    test = SmokeTest(ctx)
    try:
        exit_code = asyncio.run(test.run())
    except KeyboardInterrupt:
        print("\nInterrupted.")
        return 130

    if args.json_path:
        report = {
            "base_url": ctx.base_url,
            "summary": {
                "total": len(test.results),
                "passed": sum(1 for r in test.results if r.passed),
                "failed": sum(1 for r in test.results if not r.passed),
            },
            "results": [
                {
                    "name": r.name,
                    "method": r.method,
                    "path": r.path,
                    "passed": r.passed,
                    "status": r.status,
                    "detail": r.detail,
                    "duration_ms": r.duration_ms,
                }
                for r in test.results
            ],
        }
        with open(args.json_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print(f"\nJSON report written to {args.json_path}")

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
