"""add NVIDIA NIM provider to the model catalog

Revision ID: c4a1b2e3f5d6
Revises: 977a6b130881
Create Date: 2026-10-08 15:45:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c4a1b2e3f5d6"
down_revision: Union[str, Sequence[str], None] = "977a6b130881"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Curated NVIDIA NIM models (build.nvidia.com). Model ids are prefixed with
# "nvidia/" so the router resolves them to the NVIDIA provider.
_NVIDIA_MODELS: list[tuple[str, str]] = [
    ("nvidia/meta/llama-3.3-70b-instruct", "Llama 3.3 70B Instruct"),
    ("nvidia/meta/llama-3.1-8b-instruct", "Llama 3.1 8B Instruct"),
    ("nvidia/nvidia/llama-3.1-nemotron-70b-instruct", "Llama 3.1 Nemotron 70B"),
    ("nvidia/deepseek-ai/deepseek-r1", "DeepSeek R1"),
    ("nvidia/mistralai/mistral-large-2-instruct", "Mistral Large 2"),
    ("nvidia/google/gemma-3-27b-it", "Gemma 3 27B IT"),
    ("nvidia/microsoft/phi-4-mini-instruct", "Phi-4 Mini Instruct"),
    ("nvidia/qwen/qwen3-235b-a22b", "Qwen3 235B A22B"),
]


def upgrade() -> None:
    """Add the NVIDIA provider and its curated models to the catalog."""
    providers_table = sa.table(
        "catalog_providers",
        sa.column("id", sa.Text),
        sa.column("label", sa.Text),
        sa.column("sort_order", sa.Integer),
        sa.column("enabled", sa.Integer),
    )
    models_table = sa.table(
        "catalog_models",
        sa.column("id", sa.Text),
        sa.column("provider_id", sa.Text),
        sa.column("label", sa.Text),
        sa.column("sort_order", sa.Integer),
        sa.column("enabled", sa.Integer),
    )

    op.bulk_insert(
        providers_table,
        [{"id": "nvidia", "label": "NVIDIA NIM (build.nvidia.com)", "sort_order": 50, "enabled": 1}],
    )
    op.bulk_insert(
        models_table,
        [
            {"id": mid, "provider_id": "nvidia", "label": label, "sort_order": order, "enabled": 1}
            for order, (mid, label) in enumerate(_NVIDIA_MODELS)
        ],
    )


def downgrade() -> None:
    """Remove the NVIDIA provider and its models from the catalog."""
    op.execute("DELETE FROM catalog_models WHERE provider_id = 'nvidia'")
    op.execute("DELETE FROM catalog_providers WHERE id = 'nvidia'")