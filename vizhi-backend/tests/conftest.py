"""Test fixtures.

The database tests run against a real PostgreSQL, the same engine that ships
(Neon in production): point TEST_DATABASE_URL at a throwaway database and the
suite brings its schema to head with Alembic, which also exercises the
migrations. Without TEST_DATABASE_URL those tests are skipped; the pure unit
tests (fallback routing, HTTP client) still run.

DATABASE_URL is set to the test database *before* the app is imported, so the
app's own engine is the test engine: no dependency override is needed, and
background writers that open their own session land in the same database.
"""

from __future__ import annotations

import os
import subprocess
import sys
import uuid
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

BACKEND_DIR = Path(__file__).resolve().parents[1]
TEST_DB = os.environ.get("TEST_DATABASE_URL")

os.environ["DATABASE_URL"] = TEST_DB or "postgresql+asyncpg://unused:unused@localhost:1/unused"

# Children first, so TRUNCATE ... CASCADE has nothing left to chase.
TABLES = [
    "agent_jobs",
    "responses",
    "queries",
    "model_connections",
    "agent_runtime",
    "agents",
    "auth_accounts",
    "users",
]


@pytest.fixture(scope="session")
def database() -> str:
    """The test database at Alembic head; skips the test when none is set."""
    if not TEST_DB:
        pytest.skip("TEST_DATABASE_URL is not set")
    env = {**os.environ, "DATABASE_URL": TEST_DB}
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        env=env,
        check=True,
    )
    return TEST_DB


@pytest_asyncio.fixture
async def db(database):
    """Empty tables and the app's session factory. The engine is disposed
    afterwards: asyncpg connections belong to the event loop they were
    opened on, and each test gets a loop of its own."""
    from app.db.session import async_session_factory, engine

    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {', '.join(TABLES)} CASCADE"))
    try:
        yield async_session_factory
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def seed_user(db):
    """A user with a password login. Returns (user_id, email, password)."""
    import bcrypt

    from app.models.db_models import AuthAccountRow, UserRow

    user_id = f"u_{uuid.uuid4().hex[:8]}"
    email = f"test_{uuid.uuid4().hex[:6]}@example.com"
    password = "TestPass123!"
    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    async with db() as session:
        session.add(UserRow(id=user_id, email=email, email_verified=1, name="Test User"))
        session.add(
            AuthAccountRow(
                id=f"aa_{uuid.uuid4().hex[:8]}",
                user_id=user_id,
                provider="password",
                password_hash=pw_hash,
            )
        )
        await session.commit()

    return user_id, email, password


@pytest_asyncio.fixture
async def authed_client(seed_user):
    """An AsyncClient that is already logged in to the dashboard."""
    from app.main import app

    _, email, password = seed_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/v1/auth/login", json={"email": email, "password": password})
        assert resp.status_code == 200, resp.text
        yield client
