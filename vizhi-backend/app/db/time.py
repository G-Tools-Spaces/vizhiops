"""UTC clock for values that reach the database.

Every ``DateTime`` column in :mod:`app.models.db_models` is declared without
``timezone=True``, which maps to ``TIMESTAMP WITHOUT TIME ZONE`` on PostgreSQL.
asyncpg refuses to bind a timezone-aware ``datetime`` to that type and fails the
whole statement with ``DataError: can't subtract offset-naive and offset-aware
datetimes``. SQLite is more forgiving — it silently drops the offset — which is
why aware values went unnoticed until the Supabase switch.

So every datetime handed to the ORM, whether as a column value or as a query
parameter, must be naive. The convention is naive UTC, which is what the SQLite
rows already contain.
"""

from __future__ import annotations

import datetime as _dt


def utcnow() -> _dt.datetime:
    """Current UTC time, naive — ready to store in a ``DateTime`` column."""
    return _dt.datetime.now(_dt.timezone.utc).replace(tzinfo=None)


def as_naive_utc(value: _dt.datetime | None) -> _dt.datetime | None:
    """Normalise a datetime before it is compared against a ``DateTime`` column.

    Aware values are converted to UTC and stripped of their offset; naive values
    are assumed to be UTC already and returned unchanged.
    """
    if value is None or value.tzinfo is None:
        return value
    return value.astimezone(_dt.timezone.utc).replace(tzinfo=None)
