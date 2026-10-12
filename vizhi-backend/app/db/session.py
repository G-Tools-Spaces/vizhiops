"""Async SQLAlchemy session factory — one PostgreSQL database (Neon).

``DATABASE_URL`` is the single source of truth. A Neon connection string can
be pasted as-is: the driver prefix is forced to ``postgresql+asyncpg`` and the
libpq-only query parameters (``sslmode``, ``channel_binding``) are translated
into asyncpg's ``ssl`` connect argument, which asyncpg would otherwise reject
as unknown keywords.

The schema is managed by Alembic (``alembic upgrade head``); the application
never creates tables itself.
"""

from __future__ import annotations

from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config.settings import settings

_LIBPQ_ONLY_PARAMS = ("sslmode", "channel_binding")


def normalized_url(raw: str | None = None) -> tuple[URL, dict]:
    """The asyncpg URL and connect_args for ``raw`` (default: settings)."""
    url = make_url(raw or settings.database_url)
    # Neon's console offers both `postgresql://` and `postgres://` forms.
    if url.drivername.split("+", 1)[0] not in ("postgresql", "postgres"):
        raise RuntimeError(
            "DATABASE_URL must be a PostgreSQL URL (postgresql+asyncpg://...); "
            f"got driver '{url.drivername}'"
        )
    url = url.set(drivername="postgresql+asyncpg")

    query = dict(url.query)
    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)
    url = url.set(query=query)

    connect_args: dict = {}
    if "ssl" not in query:
        if sslmode and sslmode != "disable":
            connect_args["ssl"] = "require"
        elif sslmode is None and url.host not in (None, "localhost", "127.0.0.1"):
            # A hosted database without an explicit mode: Neon and Supabase
            # both require TLS and time out silently without it.
            connect_args["ssl"] = "require"
    return url, connect_args


def engine_options() -> dict:
    """Pool settings shared by the app engine and Alembic."""
    return {
        "pool_size": settings.db_pool_size,
        "max_overflow": settings.db_max_overflow,
        "pool_recycle": settings.db_pool_recycle,
        "pool_pre_ping": True,
    }


_url, _connect_args = normalized_url()

engine = create_async_engine(_url, echo=False, connect_args=_connect_args, **engine_options())

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:  # type: ignore[misc]
    """FastAPI dependency that yields a database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
