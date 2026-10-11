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

## Smoke testing

`smoke_test.py` is a standalone black-box script that verifies every public
endpoint of a **running** Vizhi server end-to-end: signup → model token
lifecycle → chat gateway → agent lifecycle → agent queue → observability →
cleanup. Use it before integrating Vizhi into another product, or after any
deployment, to confirm the API contract still holds.

```bash
# 1. Start the server (if not already running)
cd vizhi-backend
./venv/bin/uvicorn app.main:app --port 8000

# 2. Safe run — no LLM calls, zero cost
./venv/bin/python smoke_test.py --skip-chat

# 3. Full run — includes real chat completions (tiny cost)
./venv/bin/python smoke_test.py

# 4. Machine-readable report for CI
./venv/bin/python smoke_test.py --skip-chat --json report.json
```

Flags:

| Flag | Purpose |
|---|---|
| `--base-url <url>` | Target server (default `http://localhost:8000`) |
| `--skip-chat` | Skip real LLM calls — zero cost |
| `--dry-run` | Read-only endpoints only (health, registry, auth-negatives) |
| `--json <file>` | Also write results as JSON |
| `--timeout <sec>` | Per-request timeout (default 15s) |

Safety: the script only touches resources it creates itself (unique test email
per run, tokens/agents deleted at the end), never prints full API keys, and
exits with code 0 (all passed) / 1 (any failure) so it can gate CI pipelines.
