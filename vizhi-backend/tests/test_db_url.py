"""DATABASE_URL normalization for asyncpg (app.db.session.normalized_url)."""

import pytest

from app.db.session import normalized_url


def test_neon_string_pasted_as_is():
    url, connect_args = normalized_url(
        "postgresql://u:p@ep-x-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    )
    assert url.drivername == "postgresql+asyncpg"
    assert "sslmode" not in url.query and "channel_binding" not in url.query
    assert connect_args == {"ssl": "require"}


def test_postgres_scheme_is_accepted():
    url, _ = normalized_url("postgres://u:p@h.neon.tech/db")
    assert url.drivername == "postgresql+asyncpg"


def test_localhost_without_sslmode_has_no_ssl():
    url, connect_args = normalized_url("postgresql+asyncpg://u:p@localhost:5432/vizhi")
    assert connect_args == {}
    assert url.host == "localhost"


def test_explicit_ssl_param_is_kept():
    url, connect_args = normalized_url("postgresql+asyncpg://u:p@h.neon.tech/db?ssl=require")
    assert url.query["ssl"] == "require"
    assert connect_args == {}


def test_sslmode_disable_means_no_ssl():
    _, connect_args = normalized_url("postgresql://u:p@h.example.com/db?sslmode=disable")
    assert connect_args == {}


def test_non_postgres_url_is_rejected():
    with pytest.raises(RuntimeError, match="PostgreSQL"):
        normalized_url("sqlite+aiosqlite:///./vizhi.db")
