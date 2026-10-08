"""refresh HuggingFace catalog models

Revision ID: d5e6f7a8b9c0
Revises: c4a1b2e3f5d6
Create Date: 2026-10-08 16:13:00.000000

The HuggingFace router retires models over time, so the originally-seeded
catalog drifted (e.g. ``mistralai/Mistral-7B-Instruct-v0.3`` is no longer a
chat model). This replaces the stale HF models with currently-available ones
and drops the redundant legacy providers (llama/mistral/deepseek) that were
just aliases of HuggingFace.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, Sequence[str], None] = "c4a1b2e3f5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Currently-available chat models on the HF router (verified against
# GET https://router.huggingface.co/v1/models).
_HF_MODELS: list[tuple[str, str]] = [
    ("meta-llama/Llama-3.1-8B-Instruct", "Llama 3.1 8B Instruct (Free)"),
    ("meta-llama/Llama-3.3-70B-Instruct", "Llama 3.3 70B Instruct (Free)"),
    ("meta-llama/Llama-4-Scout-17B-16E-Instruct", "Llama 4 Scout 17B (Free)"),
    ("Qwen/Qwen3-8B", "Qwen3 8B (Free)"),
    ("Qwen/Qwen3-14B", "Qwen3 14B (Free)"),
    ("deepseek-ai/DeepSeek-R1", "DeepSeek R1 (Free)"),
    ("deepseek-ai/DeepSeek-V3", "DeepSeek V3 (Free)"),
    ("google/gemma-3-4b-it", "Gemma 3 4B IT (Free)"),
    ("google/gemma-3-12b-it", "Gemma 3 12B IT (Free)"),
    ("microsoft/phi-4", "Phi-4 (Free)"),
    ("openai/gpt-oss-20b", "GPT-OSS 20B (Free)"),
    ("moonshotai/Kimi-K3", "Kimi K3 (Free)"),
]


def upgrade() -> None:
    """Replace stale HF models and drop legacy alias providers."""
    # Drop the legacy alias providers (they just routed to HuggingFace).
    op.execute("DELETE FROM catalog_models WHERE provider_id IN ('llama', 'mistral', 'deepseek')")
    op.execute("DELETE FROM catalog_providers WHERE id IN ('llama', 'mistral', 'deepseek')")

    # Replace the HuggingFace provider's models with the current list.
    op.execute("DELETE FROM catalog_models WHERE provider_id = 'huggingface'")

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
                "id": f"huggingface/{hf_id}",
                "provider_id": "huggingface",
                "label": label,
                "sort_order": order,
                "enabled": 1,
            }
            for order, (hf_id, label) in enumerate(_HF_MODELS)
        ],
    )


def downgrade() -> None:
    """No-op — the previous catalog state is not worth restoring."""
    pass