"""Database initialization — schema is managed by Alembic migrations.

On startup the backend runs ``alembic upgrade head`` against the configured
``DATABASE_URL``, so Supabase (production) and SQLite (local) always converge
on the same schema — whichever database you point at, it is migrated to the
latest revision automatically.

Databases created before Alembic existed (tables present, no
``alembic_version``) are adopted by stamping them at head first.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from app.config.settings import settings
from app.db.session import engine

logger = logging.getLogger("vizhi.db")

_BACKEND_ROOT = Path(__file__).resolve().parents[2]


def _alembic_config() -> Config:
    cfg = Config(str(_BACKEND_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(_BACKEND_ROOT / "alembic"))
    return cfg


def _stamp_head() -> None:
    command.stamp(_alembic_config(), "head")


def _upgrade_head() -> None:
    command.upgrade(_alembic_config(), "head")


async def _sync_sqlite_agents_schema(conn) -> None:
    """Remove stale dev columns left behind by create_all-only schema changes."""
    result = await conn.execute(text("PRAGMA table_info(agents)"))
    columns = {row[1] for row in result.fetchall()}
    stale_columns = {"owner", "preferred_model"} & columns
    if not stale_columns:
        return

    await conn.exec_driver_sql("PRAGMA foreign_keys=OFF")
    await conn.exec_driver_sql(
        """
        CREATE TABLE agents_new (
            id TEXT NOT NULL,
            user_id TEXT,
            agent_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            api_key_hash TEXT NOT NULL,
            masked_key TEXT NOT NULL,
            tags TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY (id),
            UNIQUE (agent_id)
        )
        """
    )
    await conn.exec_driver_sql(
        """
        INSERT INTO agents_new (
            id,
            user_id,
            agent_id,
            name,
            description,
            api_key_hash,
            masked_key,
            tags,
            status,
            created_at,
            updated_at
        )
        SELECT
            id,
            user_id,
            agent_id,
            name,
            description,
            api_key_hash,
            masked_key,
            tags,
            status,
            created_at,
            updated_at
        FROM agents
        """
    )
    await conn.exec_driver_sql("DROP TABLE agents")
    await conn.exec_driver_sql("ALTER TABLE agents_new RENAME TO agents")
    await conn.exec_driver_sql("PRAGMA foreign_keys=ON")


async def _ensure_sqlite_column(
    conn,
    *,
    table_name: str,
    column_name: str,
    column_definition: str,
) -> None:
    result = await conn.execute(text(f"PRAGMA table_info({table_name})"))
    columns = {row[1] for row in result.fetchall()}
    if column_name in columns:
        return
    await conn.exec_driver_sql(
        f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}"
    )


async def init_db() -> None:
    """Migrate the configured database to the latest schema revision."""

    logger.info("Initializing database...")

    # Adopt pre-Alembic databases: tables exist but no migration history —
    # stamp them at head instead of trying to re-create everything.
    async with engine.begin() as conn:
        tables = set(await conn.run_sync(lambda c: inspect(c).get_table_names()))
    if tables and "alembic_version" not in tables:
        logger.info("Existing database without Alembic history — stamping at head")
        await asyncio.to_thread(_stamp_head)

    # Fresh databases get every table here; managed ones get new migrations.
    # (Runs in a thread: alembic's async env.py calls asyncio.run() itself.)
    await asyncio.to_thread(_upgrade_head)

    # Legacy repairs for old SQLite dev databases (no-op on fresh schemas).
    if settings.database_url.startswith("sqlite"):
        async with engine.begin() as conn:
            await _ensure_sqlite_column(
                conn,
                table_name="agents",
                column_name="user_id",
                column_definition="TEXT",
            )
            await _ensure_sqlite_column(
                conn,
                table_name="model_connections",
                column_name="user_id",
                column_definition="TEXT",
            )
            await _ensure_sqlite_column(
                conn,
                table_name="queries",
                column_name="user_id",
                column_definition="TEXT",
            )
            await _ensure_sqlite_column(
                conn,
                table_name="agents",
                column_name="token_name",
                column_definition="TEXT",
            )
            await _ensure_sqlite_column(
                conn,
                table_name="agents",
                column_name="last_used_at",
                column_definition="DATETIME",
            )
            await _ensure_sqlite_column(
                conn,
                table_name="model_connections",
                column_name="token_name",
                column_definition="TEXT",
            )
            await _sync_sqlite_agents_schema(conn)
    logger.info("✅ Database ready")
