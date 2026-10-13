"""Baseline schema: every table and column in app.models.db_models

Revision ID: 0001
Revises:
Create Date: 2026-10-12 00:00:00.000000+00:00

The first Alembic revision. Before it the schema came from create_all() at
startup plus ad-hoc ALTER TABLE scripts, so a live database may have any
subset of the columns below. This revision therefore converges rather than
assumes:

* a table that does not exist is created in full;
* a table that exists gets every column it is missing (nullable or with the
  model's default, so no backfill is needed);
* the unique constraints are added where no constraint covers the same
  columns.

Running it against an empty Neon database or against one that already has
the tables ends in the same place: the schema the models describe. Column
types and NOT NULL on pre-existing columns are left as they are.
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '0001'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# The schema, mirroring app/models/db_models.py at this revision. Kept here
# in full so the migration stays correct when the models move on.
metadata = sa.MetaData()

users = sa.Table(
    'users', metadata,
    sa.Column('id', sa.Text(), primary_key=True),
    sa.Column('email', sa.Text(), nullable=False),
    sa.Column('email_verified', sa.Integer(), server_default='0'),
    sa.Column('name', sa.Text(), server_default=''),
    sa.Column('avatar_url', sa.Text(), server_default=''),
    sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
)

auth_accounts = sa.Table(
    'auth_accounts', metadata,
    sa.Column('id', sa.Text(), primary_key=True),
    sa.Column('user_id', sa.Text(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
    sa.Column('provider', sa.Text(), nullable=False),
    sa.Column('provider_user_id', sa.Text(), nullable=True),
    sa.Column('password_hash', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
)

agents = sa.Table(
    'agents', metadata,
    sa.Column('id', sa.Text(), primary_key=True),
    sa.Column('user_id', sa.Text(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    sa.Column('agent_id', sa.Text(), nullable=False),
    sa.Column('name', sa.Text(), nullable=False),
    sa.Column('description', sa.Text(), server_default=''),
    sa.Column('token_name', sa.Text(), nullable=True),
    sa.Column('api_key_hash', sa.Text(), nullable=False),
    sa.Column('masked_key', sa.Text(), nullable=False),
    sa.Column('tags', sa.Text(), server_default='[]'),
    sa.Column('status', sa.Text(), server_default='active'),
    sa.Column('last_used_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    sa.Column('budget_usd', sa.Float(), nullable=True),
    sa.Column('budget_tokens', sa.Integer(), nullable=True),
    sa.Column('budget_reset_at', sa.Text(), nullable=True),
)

agent_runtime = sa.Table(
    'agent_runtime', metadata,
    sa.Column('agent_id', sa.Text(), primary_key=True),
    sa.Column('device_name', sa.Text(), server_default=''),
    sa.Column('os_name', sa.Text(), server_default=''),
    sa.Column('agent_version', sa.Text(), server_default=''),
    sa.Column('status', sa.Text(), server_default='offline'),
    sa.Column('last_heartbeat', sa.DateTime(), nullable=True),
    sa.Column('available_engines', sa.Text(), server_default='[]'),
    sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
)

model_connections = sa.Table(
    'model_connections', metadata,
    sa.Column('id', sa.Text(), primary_key=True),
    sa.Column('user_id', sa.Text(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    sa.Column('provider', sa.Text(), nullable=False),
    sa.Column('model_name', sa.Text(), nullable=False),
    sa.Column('token_name', sa.Text(), nullable=True),
    sa.Column('api_key_hash', sa.Text(), nullable=False),
    sa.Column('masked_key', sa.Text(), nullable=False),
    sa.Column('status', sa.Text(), server_default='active'),
    sa.Column('metadata', sa.Text(), nullable=True),
    sa.Column('usage_count', sa.Integer(), server_default='0'),
    sa.Column('last_used_at', sa.DateTime(), nullable=True),
    sa.Column('total_tokens_consumed', sa.Integer(), server_default='0'),
    sa.Column('total_cost', sa.Float(), server_default='0.0'),
    sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    sa.Column('budget_usd', sa.Float(), nullable=True),
    sa.Column('budget_tokens', sa.Integer(), nullable=True),
    sa.Column('budget_reset_at', sa.Text(), nullable=True),
)

queries = sa.Table(
    'queries', metadata,
    sa.Column('id', sa.Text(), primary_key=True),
    sa.Column('user_id', sa.Text(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    sa.Column('agent_id', sa.Text(), nullable=False),
    sa.Column('provider', sa.Text(), nullable=False),
    sa.Column('model', sa.Text(), nullable=False),
    sa.Column('sdk_type', sa.Text(), nullable=True),
    sa.Column('input_messages', sa.Text(), nullable=False),
    sa.Column('endpoint', sa.Text(), server_default='/v1/chat/completions'),
    sa.Column('timestamp', sa.DateTime(), server_default=sa.func.now()),
)

responses = sa.Table(
    'responses', metadata,
    sa.Column('id', sa.Text(), primary_key=True),
    sa.Column('query_id', sa.Text(), nullable=False),
    sa.Column('response', sa.Text(), nullable=True),
    sa.Column('latency_ms', sa.Integer(), server_default='0'),
    sa.Column('input_tokens', sa.Integer(), server_default='0'),
    sa.Column('output_tokens', sa.Integer(), server_default='0'),
    sa.Column('status_code', sa.Integer(), server_default='200'),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('estimated_cost', sa.Float(), server_default='0.0'),
    sa.Column('timestamp', sa.DateTime(), server_default=sa.func.now()),
)

agent_jobs = sa.Table(
    'agent_jobs', metadata,
    sa.Column('id', sa.Text(), primary_key=True),
    sa.Column('query_id', sa.Text(), nullable=False),
    sa.Column('user_id', sa.Text(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    sa.Column('agent_id', sa.Text(), nullable=True),
    sa.Column('provider', sa.Text(), nullable=False),
    sa.Column('model', sa.Text(), nullable=False),
    sa.Column('sdk_type', sa.Text(), nullable=True),
    sa.Column('endpoint', sa.Text(), server_default='/v1/chat/completions'),
    sa.Column('kind', sa.Text(), server_default='chat'),
    sa.Column('input_payload', sa.Text(), nullable=False),
    sa.Column('stream', sa.Integer(), server_default='0'),
    sa.Column('metadata', sa.Text(), server_default='{}'),
    sa.Column('status', sa.Text(), server_default='queued'),
    sa.Column('attempt_count', sa.Integer(), server_default='0'),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    sa.Column('claimed_at', sa.DateTime(), nullable=True),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
)

# (constraint name, table, columns)
UNIQUES: list[tuple[str, str, list[str]]] = [
    ('uq_users_email', 'users', ['email']),
    ('uq_auth_provider_user', 'auth_accounts', ['provider', 'provider_user_id']),
    ('uq_auth_user_provider', 'auth_accounts', ['user_id', 'provider']),
    ('uq_agents_agent_id', 'agents', ['agent_id']),
    ('uq_agent_jobs_query_id', 'agent_jobs', ['query_id']),
]


def _columns_covered_by_unique(inspector: sa.Inspector, table: str) -> set[frozenset[str]]:
    """Column sets already enforced unique, by constraint or unique index."""
    covered = {frozenset(c['column_names']) for c in inspector.get_unique_constraints(table)}
    covered |= {frozenset(i['column_names']) for i in inspector.get_indexes(table) if i.get('unique')}
    return covered


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    for table in metadata.sorted_tables:
        if table.name not in existing:
            table.create(bind)
            continue
        present = {c['name'] for c in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name not in present:
                op.add_column(table.name, column._copy())

    # Refresh after the DDL above so the unique check sees new tables too.
    inspector = sa.inspect(bind)
    for name, table, columns in UNIQUES:
        if frozenset(columns) not in _columns_covered_by_unique(inspector, table):
            op.create_unique_constraint(name, table, columns)


def downgrade() -> None:
    # The baseline has nothing to go back to: dropping the tables would
    # destroy every token and log. Downgrade is deliberately a no-op.
    pass
