# Vizhi Frontend

Developer-first Agent Observability + LLM Gateway control plane.

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- Zustand
- TanStack Query
- Recharts
- React Hook Form + Zod
- TanStack Table-ready data contracts
- Lucide icons
- Sonner notifications

## Run

Next.js 16 requires Node `>=20.9.0`.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The app currently uses typed mock API facades in `src/lib/api` so backend endpoints can replace the mock transport without changing page-level UX.
