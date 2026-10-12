# Vizhi Admin Console

A separate console for managing the Vizhi **model catalog** — the providers
and models that appear in the main console's Connect Model dropdown, the
credentials of admin-added providers, and per-model pricing.

Changes made here are written straight to the `catalog_providers` /
`catalog_models` tables in the gateway's PostgreSQL database and are picked
up by `GET /v1/models/registry` on the next fetch — **no redeploy or restart
of anything is required**. The tables themselves are created by the
backend's Alembic migrations (`alembic upgrade head`, revision 0003 or
later), never by this app.

## Run

```bash
npm install
cp .env.example .env.local      # set DATABASE_URL and AUTH_JWT_SECRET
npm run dev                     # http://localhost:3002
```

`DATABASE_URL` is the same connection string the gateway uses (Supabase
session pooler on port 5432, or Neon). `AUTH_JWT_SECRET` must match the
gateway's value so a sign-in in either console is valid in the other.

## Access

Sign in with the same email/password account you use in the main console —
but the account must have `role = "admin"`. Promote an account from the
backend directory, against the same database:

```bash
cd ../vizhi-backend
DATABASE_URL='<same url>' .venv/bin/python make_admin.py you@example.com
```

## What you can do

- **Providers** (`/catalog`): add a provider (optionally with its own API key
  and base URL — the gateway then serves it with those credentials, no `.env`
  change needed), rename, reorder, hide/show, delete (deletes its models too),
  sync the live model list from NVIDIA / HuggingFace / any credentialed
  provider.
- **Models** (`/catalog/<provider>`): add a model (`<provider>/<model-id>`),
  rename, reorder, hide/show, set `input_price` / `output_price` (USD per 1K
  tokens, used for cost estimation), delete.

Hidden providers/models disappear from the main console but stay in the DB;
existing user connections are never affected (the catalog is only used when
creating new connections).

## Deploy (Render)

A Node web service: build `npm install && npm run build`, start `npm start`
(listens on Render's `PORT`, or 3002 locally). Environment: `DATABASE_URL`,
`AUTH_JWT_SECRET`, `AUTH_COOKIE_SECURE=true`, and optionally
`NVIDIA_API_KEY` / `HF_TOKEN`.
