"""Add admin-managed provider credentials to catalog_providers.

Providers added via the admin console can now carry their own API key and
base URL, so the gateway can serve them without any .env configuration.

Revision ID: f9a0b1c2d3e4
Revises: e7f8a9b0c1d2
Create Date: 2026-10-11
"""

from alembic import op
import sqlalchemy as sa

revision = "f9a0b1c2d3e4"
down_revision = "e7f8a9b0c1d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("catalog_providers", sa.Column("api_key", sa.Text(), nullable=True))
    op.add_column("catalog_providers", sa.Column("base_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("catalog_providers", "base_url")
    op.drop_column("catalog_providers", "api_key")
