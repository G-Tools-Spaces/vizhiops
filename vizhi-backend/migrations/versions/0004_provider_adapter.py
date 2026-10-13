"""catalog_providers.adapter: which API style the gateway speaks per provider

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-13 00:00:00.000000+00:00

Lets an admin pick, per provider, the wire format the gateway uses:
"openai" (OpenAI SDK / Chat Completions), "anthropic" (Messages API),
"gemini" (generateContent) or "azure-openai". NULL keeps today's behaviour:
a built-in uses its own format, anything else is OpenAI-compatible — so
existing rows need no backfill.

Converges like 0001/0003: the column is only added when missing.
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '0004'
down_revision: str | None = '0003'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {c['name'] for c in inspector.get_columns('catalog_providers')}
    if 'adapter' not in columns:
        op.add_column('catalog_providers', sa.Column('adapter', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('catalog_providers', 'adapter')
