"""replace NVIDIA catalog with verified working models

Revision ID: e7f8a9b0c1d2
Revises: d5e6f7a8b9c0
Create Date: 2026-10-08 16:20:00.000000

The originally-seeded NVIDIA models were end-of-life / not callable for this
account. This replaces them with a small set of models verified to answer a
chat completion.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, Sequence[str], None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_NVIDIA_MODELS: list[tuple[str, str]] = [
    ("openai/gpt-oss-20b", "GPT-OSS 20B"),
    ("google/gemma-4-31b-it", "Gemma 4 31B IT"),
    ("nvidia/nemotron-3-super-120b-a12b", "Nemotron 3 Super 120B"),
    ("nvidia/nemotron-3-ultra-550b-a55b", "Nemotron 3 Ultra 550B"),
    ("nvidia/nemotron-3.5-lightning-30b-a3b", "Nemotron 3.5 Lightning 30B"),
]


def upgrade() -> None:
    """Replace the NVIDIA provider's models with verified working ones."""
    op.execute("DELETE FROM catalog_models WHERE provider_id = 'nvidia'")

    models_table = sa.table(
        "catalog_models",
        sa.column("id", sa.Text),
        sa.column("provider_id", sa.Text),
        sa.column("label", sa.Text),
        sa.column("sort_order", sa.Integer),
        sa.column("enabled", sa.Integer),
    )
    op.bulk_insert(
        models_table,
        [
            {
                "id": f"nvidia/{nim_id}",
                "provider_id": "nvidia",
                "label": label,
                "sort_order": order,
                "enabled": 1,
            }
            for order, (nim_id, label) in enumerate(_NVIDIA_MODELS)
        ],
    )


def downgrade() -> None:
    """No-op."""
    pass