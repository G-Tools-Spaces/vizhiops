"""Add optional per-model pricing to catalog_models.

When input_price/output_price (USD per 1K tokens) are set on a catalog
model, cost estimation uses them instead of the provider's blended rates —
making per-query cost and budget enforcement accurate per model.

Revision ID: g1b2c3d4e5f6
Revises: f9a0b1c2d3e4
Create Date: 2026-10-11
"""

from alembic import op
import sqlalchemy as sa

revision = "g1b2c3d4e5f6"
down_revision = "f9a0b1c2d3e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("catalog_models", sa.Column("input_price", sa.Float(), nullable=True))
    op.add_column("catalog_models", sa.Column("output_price", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("catalog_models", "output_price")
    op.drop_column("catalog_models", "input_price")
