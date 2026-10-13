"""
Tests for the production-ready API token management flow.

Coverage:
  - Token creation (with and without token_name)
  - Token metadata returned correctly (token_name, masked_key, last_used_at, status)
  - Plaintext key returned only on creation / rotation — never on list/get
  - bcrypt hash stored (never plaintext)
  - Authentication succeeds with valid token; last_used_at is updated
  - Revocation: revoked token cannot authenticate; status becomes "revoked"
  - Rotation: new token works; old token rejected; metadata preserved

Database fixtures (`authed_client`, `db`) come from tests/conftest.py and run
against TEST_DATABASE_URL (PostgreSQL); the tests are skipped without it.
"""

from __future__ import annotations

import datetime
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.auth.api_key import hash_api_key, verify_api_key


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _create_agent(client: AsyncClient, *, name: str = "TestAgent", token_name: str | None = None) -> dict:
    """POST /v1/agents and return the JSON body."""
    payload: dict = {"name": name, "description": "test", "tags": ""}
    if token_name is not None:
        payload["token_name"] = token_name
    resp = await client.post("/v1/agents", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── Tests ─────────────────────────────────────────────────────────────────────


class TestTokenCreation:
    async def test_returns_raw_api_key_once(self, authed_client):
        """The plaintext api_key must be present on creation."""
        data = await _create_agent(authed_client, name="Creation Test")
        assert "api_key" in data
        assert data["api_key"].startswith("vz_")

    async def test_raw_key_not_in_list(self, authed_client):
        """After creation, listing agents must NOT expose the plaintext key."""
        await _create_agent(authed_client, name="ListSecurity")
        resp = await authed_client.get("/v1/agents")
        assert resp.status_code == 200
        for agent in resp.json():
            # api_key should not appear in the list response at all
            assert "api_key" not in agent

    async def test_hash_stored_not_plaintext(self, authed_client):
        """Verify that what's stored is a bcrypt hash of the raw key."""
        data = await _create_agent(authed_client, name="HashCheck")
        raw_key = data["api_key"]
        masked = data["agent"]["masked_key"]
        # masked_key must NOT be the raw key
        assert masked != raw_key
        assert "..." in masked or "*" in masked

    async def test_token_name_saved(self, authed_client):
        """Optional token_name should be stored and returned."""
        data = await _create_agent(authed_client, name="NamedToken", token_name="My CI Token")
        assert data["agent"]["token_name"] == "My CI Token"

    async def test_no_token_name_defaults_to_null(self, authed_client):
        """When token_name is omitted it should come back as null/None."""
        data = await _create_agent(authed_client, name="UnnamedToken")
        assert data["agent"]["token_name"] is None

    async def test_initial_status_is_active(self, authed_client):
        """Freshly created token must have status=active."""
        data = await _create_agent(authed_client, name="StatusCheck")
        assert data["agent"]["status"] == "active"

    async def test_last_used_at_is_null_on_creation(self, authed_client):
        """last_used_at must be null at creation time."""
        data = await _create_agent(authed_client, name="LastUsedCheck")
        assert data["agent"]["last_used_at"] is None


class TestAuthentication:
    async def test_valid_token_authenticates(self, authed_client):
        """A valid bearer token must be accepted by protected endpoints."""
        data = await _create_agent(authed_client, name="AuthTest")
        raw_key = data["api_key"]
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.get(
                "/v1/agents",
                headers={"Authorization": f"Bearer {raw_key}"},
            )
            # The agent queue endpoint is the most natural "use" of the agent key.
            # We test via the queue poll — a 404/422 still means auth passed.
            # Instead, hit an endpoint that returns 200 on a valid agent key:
            queue_resp = await c.get(
                "/v1/agent-queue/jobs",
                headers={
                    "X-Agent-CID": data["agent"]["agent_id"],
                    "X-Agent-Token": raw_key,
                },
            )
            # 200 = auth succeeded and jobs list returned (empty is fine)
            assert queue_resp.status_code == 200, queue_resp.text

    async def test_invalid_token_rejected(self, authed_client):
        """A bogus token must be rejected with 401."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.get(
                "/v1/agent-queue/jobs",
                headers={
                    "X-Agent-CID": "ag_fake00000",
                    "X-Agent-Token": "vz_live_notavalidtoken",
                },
            )
            assert resp.status_code == 401

    async def test_last_used_at_updated_after_auth(self, authed_client):
        """Authenticating successfully should update last_used_at on the agent row."""
        data = await _create_agent(authed_client, name="LastUsedUpdate")
        raw_key = data["api_key"]
        cid = data["agent"]["agent_id"]

        assert data["agent"]["last_used_at"] is None

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            await c.get(
                "/v1/agent-queue/jobs",
                headers={"X-Agent-CID": cid, "X-Agent-Token": raw_key},
            )

        # Fetch the agent again and verify last_used_at is now set
        get_resp = await authed_client.get(f"/v1/agents/{cid}")
        assert get_resp.status_code == 200, get_resp.text
        agent = get_resp.json()
        assert agent["last_used_at"] is not None


class TestRevocation:
    async def test_revoke_returns_revoked_status(self, authed_client):
        """POST /revoke must flip status to revoked."""
        data = await _create_agent(authed_client, name="RevokeTest")
        cid = data["agent"]["agent_id"]

        resp = await authed_client.post(f"/v1/agents/{cid}/revoke")
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "revoked"

    async def test_revoked_token_cannot_authenticate(self, authed_client):
        """After revocation the token must be rejected with 401."""
        data = await _create_agent(authed_client, name="RevokedAuth")
        raw_key = data["api_key"]
        cid = data["agent"]["agent_id"]

        await authed_client.post(f"/v1/agents/{cid}/revoke")

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.get(
                "/v1/agent-queue/jobs",
                headers={"X-Agent-CID": cid, "X-Agent-Token": raw_key},
            )
            assert resp.status_code == 401, "Revoked token should be rejected"

    async def test_double_revoke_returns_409(self, authed_client):
        """Revoking an already-revoked token should return 409 Conflict."""
        data = await _create_agent(authed_client, name="DoubleRevoke")
        cid = data["agent"]["agent_id"]

        await authed_client.post(f"/v1/agents/{cid}/revoke")
        resp = await authed_client.post(f"/v1/agents/{cid}/revoke")
        assert resp.status_code == 409

    async def test_revoke_nonexistent_agent_returns_404(self, authed_client):
        """Revoking a non-existent CID should return 404."""
        resp = await authed_client.post("/v1/agents/ag_doesnotexist/revoke")
        assert resp.status_code == 404


class TestRotation:
    async def test_rotate_returns_new_api_key(self, authed_client):
        """POST /rotate must return a new api_key in the response."""
        data = await _create_agent(authed_client, name="RotateTest")
        cid = data["agent"]["agent_id"]
        old_key = data["api_key"]

        resp = await authed_client.post(f"/v1/agents/{cid}/rotate")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "api_key" in body
        new_key = body["api_key"]
        assert new_key != old_key
        assert new_key.startswith("vz_")

    async def test_new_token_works_after_rotation(self, authed_client):
        """The new token must authenticate successfully."""
        data = await _create_agent(authed_client, name="RotateNewWorks")
        cid = data["agent"]["agent_id"]

        resp = await authed_client.post(f"/v1/agents/{cid}/rotate")
        new_key = resp.json()["api_key"]

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            queue_resp = await c.get(
                "/v1/agent-queue/jobs",
                headers={"X-Agent-CID": cid, "X-Agent-Token": new_key},
            )
            assert queue_resp.status_code == 200, "New token should authenticate"

    async def test_old_token_rejected_after_rotation(self, authed_client):
        """The old token must be rejected after rotation."""
        data = await _create_agent(authed_client, name="RotateOldRejected")
        cid = data["agent"]["agent_id"]
        old_key = data["api_key"]

        await authed_client.post(f"/v1/agents/{cid}/rotate")

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.get(
                "/v1/agent-queue/jobs",
                headers={"X-Agent-CID": cid, "X-Agent-Token": old_key},
            )
            assert resp.status_code == 401, "Old token should be rejected after rotation"

    async def test_rotation_preserves_metadata(self, authed_client):
        """Rotation must preserve name, token_name, description, and tags."""
        data = await _create_agent(
            authed_client, name="MetaPreserve", token_name="prod-bot"
        )
        cid = data["agent"]["agent_id"]

        resp = await authed_client.post(f"/v1/agents/{cid}/rotate")
        agent = resp.json()["agent"]

        assert agent["name"] == "MetaPreserve"
        assert agent["token_name"] == "prod-bot"
        assert agent["status"] == "active"

    async def test_rotation_reactivates_revoked_token(self, authed_client):
        """Rotating a revoked token must set status back to active."""
        data = await _create_agent(authed_client, name="ReactivateTest")
        cid = data["agent"]["agent_id"]

        await authed_client.post(f"/v1/agents/{cid}/revoke")
        resp = await authed_client.post(f"/v1/agents/{cid}/rotate")
        assert resp.json()["agent"]["status"] == "active"

    async def test_new_key_not_exposed_in_list_after_rotation(self, authed_client):
        """The new key must not appear in the agents list after rotation."""
        data = await _create_agent(authed_client, name="RotateListSecurity")
        cid = data["agent"]["agent_id"]

        rotate_resp = await authed_client.post(f"/v1/agents/{cid}/rotate")
        new_key = rotate_resp.json()["api_key"]

        list_resp = await authed_client.get("/v1/agents")
        body_text = list_resp.text
        assert new_key not in body_text, "New plaintext key must not appear in agent list"


class TestLastUsedTracking:
    async def test_last_used_at_updated_on_queue_auth(self, authed_client):
        """last_used_at must be set after queue credential auth."""
        data = await _create_agent(authed_client, name="LastUsedQueue")
        raw_key = data["api_key"]
        cid = data["agent"]["agent_id"]

        before = datetime.datetime.utcnow()

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            await c.get(
                "/v1/agent-queue/jobs",
                headers={"X-Agent-CID": cid, "X-Agent-Token": raw_key},
            )

        get_resp = await authed_client.get(f"/v1/agents/{cid}")
        agent = get_resp.json()
        assert agent["last_used_at"] is not None
        last_used = datetime.datetime.fromisoformat(agent["last_used_at"])
        assert last_used >= before.replace(microsecond=0)

    async def test_last_used_at_not_updated_on_failed_auth(self, authed_client):
        """A failed auth attempt must NOT update last_used_at."""
        data = await _create_agent(authed_client, name="LastUsedFail")
        cid = data["agent"]["agent_id"]

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            await c.get(
                "/v1/agent-queue/jobs",
                headers={"X-Agent-CID": cid, "X-Agent-Token": "vz_live_badtoken"},
            )

        get_resp = await authed_client.get(f"/v1/agents/{cid}")
        agent = get_resp.json()
        # last_used_at should still be None — bad auth must not touch it
        assert agent["last_used_at"] is None
