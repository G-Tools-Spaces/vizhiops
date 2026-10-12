# vizhi-backend
backend-vizhi

## Database

One PostgreSQL database (Neon), for development and production alike; there
is no local SQLite. Set `DATABASE_URL` to the Neon connection string exactly
as the console shows it (`postgresql://...?sslmode=require&channel_binding=require`
is fine; it is translated for asyncpg).

The schema is managed by Alembic. The server never creates tables, so run the
migrations before starting it, locally and as the Render pre-deploy/build
step:

```bash
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
```

`migrations/versions/0001_baseline_schema.py` converges an existing database
(adds any missing columns and constraints) as well as creating a fresh one,
so it is safe on the database that create_all() used to manage. Tests run
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
