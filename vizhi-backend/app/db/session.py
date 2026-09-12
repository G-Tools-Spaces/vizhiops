"""Async SQLAlchemy session factory — one database for every read and write.

``DATABASE_URL`` is the single source of truth:

* local development → ``sqlite+aiosqlite:///./vizhi.db``
* production        → ``postgresql+asyncpg://...`` (Supabase)

There is no local/remote split, no background sync and no hydration: the API
reads and writes the same database it is pointed at.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config.settings import settings

_is_sqlite = settings.database_url.startswith("sqlite")


def _engine_kwargs() -> dict:
    """Driver-specific engine options for SQLite vs PostgreSQL."""
    if _is_sqlite:
        # SQLite requires `check_same_thread=False` for async usage.
        return {"connect_args": {"check_same_thread": False}}

    connect_args: dict = {}
    # The Supabase connection pooler requires SSL — without this the TLS
    # handshake times out silently on asyncpg.
    if "pooler.supabase.com" in settings.database_url:
        connect_args["ssl"] = "require"

    return {
        "connect_args": connect_args,
        "pool_size": settings.db_pool_size,
        "max_overflow": settings.db_max_overflow,
        "pool_recycle": settings.db_pool_recycle,
        "pool_pre_ping": True,
    }


engine = create_async_engine(settings.database_url, echo=False, **_engine_kwargs())

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
