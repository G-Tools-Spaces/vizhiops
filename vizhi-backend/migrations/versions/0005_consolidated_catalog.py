"""Consolidated model catalog: the end state of 0003 + 0004 in one revision

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-15 00:00:00.000000+00:00

Lands everything 0003 (model catalog, provider credentials, per-model
pricing, users.role, seed catalog) and 0004 (catalog_providers.adapter)
add, in a single revision:

* `catalog_providers`  — with `api_key`, `base_url` and `adapter`;
* `catalog_models`     — with `input_price` / `output_price`;
* `users.role`         — "user" (default) or "admin";
* the seed catalog, inserted only when the provider table is empty.

Like 0001/0003/0004, this converges: tables and columns are only added when
missing. A database at 0002, 0003 or 0004 ends up identical after it, and on
one already at 0004 it is a no-op. 0003 and 0004 stay in the chain because
existing databases are stamped with them.
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '0005'
down_revision: str | None = '0004'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


metadata = sa.MetaData()

catalog_providers = sa.Table(
    'catalog_providers', metadata,
    sa.Column('id', sa.Text(), primary_key=True),            # e.g. "openai"
    sa.Column('label', sa.Text(), nullable=False),
    sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
    sa.Column('enabled', sa.Integer(), server_default='1', nullable=False),
    sa.Column('api_key', sa.Text(), nullable=True),
    sa.Column('base_url', sa.Text(), nullable=True),
    sa.Column('adapter', sa.Text(), nullable=True),          # 0004: wire format, NULL = default
    sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
)

catalog_models = sa.Table(
    'catalog_models', metadata,
    sa.Column('id', sa.Text(), primary_key=True),            # e.g. "openai/gpt-4o"
    sa.Column('provider_id', sa.Text(), sa.ForeignKey('catalog_providers.id', ondelete='CASCADE'), nullable=False),
    sa.Column('label', sa.Text(), nullable=False),
    sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
    sa.Column('enabled', sa.Integer(), server_default='1', nullable=False),
    sa.Column('input_price', sa.Float(), nullable=True),
    sa.Column('output_price', sa.Float(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
)

# (provider id, label, sort_order, [(model id, label), ...]) — the catalog as
# the stage branch left it after its HuggingFace and NVIDIA refreshes.
SEED_CATALOG: list[tuple[str, str, int, list[tuple[str, str]]]] = [
    ("openai", "OpenAI", 0, [
        ("openai/gpt-4o", "gpt-4o"),
        ("openai/gpt-4o-mini", "gpt-4o-mini"),
        ("openai/gpt-4.1", "gpt-4.1"),
        ("openai/gpt-4.1-mini", "gpt-4.1-mini"),
        ("openai/gpt-4.1-nano", "gpt-4.1-nano"),
        ("openai/o3", "o3"),
        ("openai/o3-mini", "o3-mini"),
        ("openai/o4-mini", "o4-mini"),
    ]),
    ("claude", "Claude (Anthropic)", 1, [
        ("anthropic/claude-sonnet-4-20250514", "claude-sonnet-4"),
        ("anthropic/claude-3-5-sonnet-20241022", "claude-3.5-sonnet"),
        ("anthropic/claude-3-5-haiku-20241022", "claude-3.5-haiku"),
        ("anthropic/claude-3-haiku-20240307", "claude-3-haiku"),
    ]),
    ("gemini", "Gemini (Google)", 2, [
        ("gemini/gemini-2.5-pro", "Gemini 2.5 Pro"),
        ("gemini/gemini-2.5-flash", "Gemini 2.5 Flash"),
        ("gemini/gemini-2.0-flash", "Gemini 2.0 Flash"),
        ("gemini/gemini-1.5-pro", "Gemini 1.5 Pro"),
        ("gemini/gemini-1.5-flash", "Gemini 1.5 Flash"),
    ]),
    ("qwen", "Qwen (Alibaba)", 3, [
        ("qwen/qwen-plus", "Qwen Plus"),
        ("qwen/qwen-turbo", "Qwen Turbo"),
        ("qwen/qwen-max", "Qwen Max"),
        ("qwen/qwen2.5-72b-instruct", "Qwen 2.5 72B Instruct"),
        ("qwen/qwen2.5-32b-instruct", "Qwen 2.5 32B Instruct"),
    ]),
    ("huggingface", "🤗 Open Models (Free via HuggingFace)", 4, [
        ("huggingface/meta-llama/Llama-3.1-8B-Instruct", "Llama 3.1 8B Instruct (Free)"),
        ("huggingface/meta-llama/Llama-3.3-70B-Instruct", "Llama 3.3 70B Instruct (Free)"),
        ("huggingface/meta-llama/Llama-4-Scout-17B-16E-Instruct", "Llama 4 Scout 17B (Free)"),
        ("huggingface/Qwen/Qwen3-8B", "Qwen3 8B (Free)"),
        ("huggingface/Qwen/Qwen3-14B", "Qwen3 14B (Free)"),
        ("huggingface/deepseek-ai/DeepSeek-R1", "DeepSeek R1 (Free)"),
        ("huggingface/deepseek-ai/DeepSeek-V3", "DeepSeek V3 (Free)"),
        ("huggingface/google/gemma-3-4b-it", "Gemma 3 4B IT (Free)"),
        ("huggingface/google/gemma-3-12b-it", "Gemma 3 12B IT (Free)"),
        ("huggingface/microsoft/phi-4", "Phi-4 (Free)"),
        ("huggingface/openai/gpt-oss-20b", "GPT-OSS 20B (Free)"),
        ("huggingface/moonshotai/Kimi-K3", "Kimi K3 (Free)"),
    ]),
    ("nvidia", "NVIDIA NIM (build.nvidia.com)", 50, [
        ("nvidia/openai/gpt-oss-20b", "GPT-OSS 20B"),
        ("nvidia/google/gemma-4-31b-it", "Gemma 4 31B IT"),
        ("nvidia/nvidia/nemotron-3-super-120b-a12b", "Nemotron 3 Super 120B"),
        ("nvidia/nvidia/nemotron-3-ultra-550b-a55b", "Nemotron 3 Ultra 550B"),
        ("nvidia/nvidia/nemotron-3.5-lightning-30b-a3b", "Nemotron 3.5 Lightning 30B"),
    ]),
]


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

    user_columns = {c['name'] for c in inspector.get_columns('users')}
    if 'role' not in user_columns:
        op.add_column('users', sa.Column('role', sa.Text(), server_default='user', nullable=False))

    # Seed only an empty catalog: an operator who already curated providers
    # in the console keeps exactly what they have.
    count = bind.execute(sa.text('SELECT COUNT(*) FROM catalog_providers')).scalar_one()
    if count:
        return
    providers = [
        {"id": pid, "label": label, "sort_order": order, "enabled": 1}
        for pid, label, order, _ in SEED_CATALOG
    ]
    models = [
        {"id": mid, "provider_id": pid, "label": mlabel, "sort_order": m_order, "enabled": 1}
        for pid, _, _, model_list in SEED_CATALOG
        for m_order, (mid, mlabel) in enumerate(model_list)
    ]
    op.bulk_insert(catalog_providers, providers)
    op.bulk_insert(catalog_models, models)


def downgrade() -> None:
    # 0005 only fills in what 0003/0004 should already have created, so
    # stepping back to 0004 leaves the schema as 0004 expects it.
    pass
