# Vizhi API reference

The documentation site for the Vizhi API gateway — a standalone Next.js app
that runs on its own port, separate from the console.

- **Console** (the dashboard): http://localhost:3000
- **API reference** (this app): http://localhost:3001
- **Backend** (the API being documented): http://localhost:8000

## Run it

```bash
npm install
npm run dev        # http://localhost:3001
```

The site is static-friendly. `npm run build` prerenders every page; `npm start`
serves the production build on port 3001.

## What's where

| Page | Source | Purpose |
| ---- | ------ | ------- |
| Overview, Quickstart, Authentication | hand-written | Get a reader from zero to a working call. |
| Chat, Models, Agents, Agent queue | hand-written | The resources day-to-day traffic touches, with copy-paste examples. |
| Queries, Metrics, Dashboard, Provider health | hand-written | The read-only observability endpoints. |
| **Endpoint index** (`/docs/reference`) | **generated** | Every endpoint the backend exposes, built from the OpenAPI spec. |
| Errors | hand-written | The shared failure shape and status codes. |

The hand-written pages explain *how* to use the API. The generated index
guarantees that *every* endpoint is listed, even one added five minutes ago.

## Keeping the docs in sync

The backend (FastAPI) publishes its OpenAPI spec at
`http://localhost:8000/openapi.json`. After you add, remove or change an
endpoint, regenerate the index:

```bash
npm run sync
```

This fetches the live spec and rewrites `src/lib/openapi.generated.json`, which
`/docs/reference` renders. Commit the regenerated file so the site builds
without the backend running.

Options:

```bash
# Read from a different backend
OPENAPI_URL=http://staging.example.com/openapi.json npm run sync

# Or from a saved spec file (no backend needed)
npm run sync -- path/to/openapi.json
```

> The curated pages (Chat, Models, …) are written by hand for clarity, so a
> brand-new resource still deserves a curated page — but it will appear in the
> endpoint index immediately after `npm run sync`, so nothing is ever
> undocumented.

## Theming

Light and dark modes share one token set in `src/app/globals.css`, exposed to
Tailwind via `@theme inline`. The toggle in the header (next-themes) flips a
`.dark` class on `<html>`; every colour resolves from the CSS variables, so the
whole site reskins from that one file.
