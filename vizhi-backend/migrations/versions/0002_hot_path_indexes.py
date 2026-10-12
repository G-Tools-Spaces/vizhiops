"""Indexes for the queries that run on every /v1/chat/completions call

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-12 00:00:00.000000+00:00

* ix_queries_agent_ts               budget check: SUM over a token's queries
                                    since budget_reset_at (services/budget.py)
* ix_responses_query_id             budget-check join, and the agent-queue poll
                                    that waits for a response row (api/chat.py)
* ix_model_connections_model_status usage/stats update after each reply
                                    (services/persistence.py)

Each is created only if it does not already exist, so a database that got
them by hand converges cleanly.
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '0002'
down_revision: str | None = '0001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

INDEXES: list[tuple[str, str, list[str]]] = [
    ('ix_queries_agent_ts', 'queries', ['agent_id', 'timestamp']),
    ('ix_responses_query_id', 'responses', ['query_id']),
    ('ix_model_connections_model_status', 'model_connections', ['model_name', 'status']),
]


def upgrade() -> None:
    for name, table, columns in INDEXES:
        op.create_index(name, table, columns, unique=False, if_not_exists=True)


def downgrade() -> None:
    for name, table, _ in reversed(INDEXES):
        op.drop_index(name, table_name=table, if_exists=True)
