# vizhi-backend
backend-vizhi

## Inference routing

All logical providers call `app/providers/final_call.py`. Configure the real
inference backend with environment variables:

```env
INFERENCE_BACKEND=huggingface
HF_TOKEN=hf_your_token
```

Create `vizhi-backend/.env` for real local secrets. The project already ignores
`.env`; use `.env.example` as the template.

For your own OpenAI-compatible deployment:

```env
INFERENCE_BACKEND=custom
CUSTOM_INFERENCE_BASE_URL=http://localhost:8001/v1
CUSTOM_INFERENCE_API_KEY=
```

You can also configure fallback order:

```env
INFERENCE_BACKEND=custom,huggingface
```

Use `INFERENCE_MODEL_MAP` when a Vizhi model alias should call a different
backend model id:

```env
INFERENCE_MODEL_MAP={"qwen/qwen-plus":"Qwen/Qwen2.5-7B-Instruct:fastest"}
```

## Database & migrations (Alembic)

The schema is managed by **Alembic**. On startup the backend runs
`alembic upgrade head` against `DATABASE_URL`, so Supabase and local SQLite
always converge on the same schema automatically.

```env
# Supabase (session pooler — SSL is handled automatically)
DATABASE_URL=postgresql+asyncpg://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres

# Local SQLite fallback
# DATABASE_URL=sqlite+aiosqlite:///./vizhi.db
```

Making a schema change:

```bash
cd vizhi-backend
.venv/bin/alembic revision --autogenerate -m "describe the change"
.venv/bin/alembic upgrade head        # apply now (also applied on next startup)
```

Useful commands: `alembic current` (applied revision), `alembic history`
(all revisions), `alembic downgrade -1` (roll back one).

> Databases created before Alembic are adopted automatically: on first startup
> they are stamped at head, then migrated normally.
