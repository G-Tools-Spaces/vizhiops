# vizhi-backend
backend-vizhi

## Database

One PostgreSQL database (Supabase or Neon), for development and production
alike; there is no local SQLite. Set `DATABASE_URL` to the connection string
exactly as the provider's console shows it (`postgresql://...?sslmode=require`
is fine; libpq-only parameters are translated for asyncpg). On Supabase use the
session pooler, port 5432.

The schema is managed by Alembic. The server never creates tables, so run the
migrations before starting it, locally and as the Render pre-deploy/build
step:

```bash
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
```

`migrations/versions/0001_baseline_schema.py` and `0003_model_catalog.py`
converge an existing database (they add only what is missing) as well as
creating a fresh one, so they are safe on a database that create_all() used to
manage. Promote an admin for the model catalog with
`.venv/bin/python make_admin.py you@example.com`. Tests run
against a throwaway PostgreSQL via `TEST_DATABASE_URL` and are skipped
without it.

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
