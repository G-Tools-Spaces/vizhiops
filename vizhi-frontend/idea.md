# Vizhi Frontend Idea

Vizhi is a developer-first Agent Observability + LLM Gateway platform.

The frontend is the control plane for connecting LLM providers, generating reusable model tokens, creating observable agent identities, linking agents to models, and monitoring usage, latency, errors, tokens, and estimated cost.

Backend owns credential security, token generation, usage accounting, metrics computation, and the monitoring pipeline. Frontend owns configuration, visualization, management, and observability UX.

## Product Model

Model Token means "how to access an LLM."

Agent Token means "which agent is consuming models."

This separation enables model usage tracking, agent usage tracking, cost attribution, and multi-agent observability.

## Core Flow

Login -> Dashboard -> Connect Model Provider -> Generate Model Token -> Create Agent -> Assign CID -> Link Agent to Model Token -> Use tokens externally -> Observe Metrics Dashboard.

## Tech Stack

- Framework: Next.js 16 App Router
- Language: TypeScript
- Styling: Tailwind CSS
- UI patterns: shadcn-inspired local primitives
- State: Zustand
- Data: TanStack Query
- Charts: Recharts
- Forms: React Hook Form
- Validation: Zod
- Tables: TanStack Table-ready data structures
- Icons: Lucide
- Notifications: Sonner

## Success Criteria

Users should be able to log in, connect a model, generate model tokens, create agents, generate agent tokens, link agents to models, use tokens externally, and observe metrics immediately.
