# Vizhi Admin Console

A separate console for managing the Vizhi **model catalog** — the providers
and models that appear in the main console's Connect Model dropdown.

Changes made here are written to the `catalog_providers` / `catalog_models`
tables (Supabase) and are picked up by `GET /v1/models/registry` on the next
fetch — **no redeploy or restart of anything is required**.

## Run

```bash
npm install
npm run dev        # http://localhost:3002
```

The console talks to the backend at `NEXT_PUBLIC_API_URL` (default
`http://localhost:8000`). Create a `.env.local` to override:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Access

Sign in with the same email/password account you use in the main console —
but the account must have `role = "admin"`. Promote an account from the
backend directory:

```bash
cd ../vizhi-backend
.venv/bin/python make_admin.py you@example.com
```

## What you can do

- **Providers** (`/catalog`): add a provider, rename, reorder, hide/show,
  delete (deletes its models too).
- **Models** (`/catalog/<provider>`): add a model (`<provider>/<model-id>`),
  rename, reorder, hide/show, delete.

Hidden providers/models disappear from the main console but stay in the DB;
existing user connections are never affected (the catalog is only used when
creating new connections).
