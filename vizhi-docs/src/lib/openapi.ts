/**
 * Typed access to the generated OpenAPI index.
 *
 * `openapi.generated.json` is produced by `npm run sync` (see
 * scripts/sync-openapi.mjs) and committed so the site builds without the
 * backend running. The /docs/reference page renders it, which is what keeps the
 * full endpoint list in step with the backend automatically.
 */

import data from "./openapi.generated.json";

export interface ApiParameter {
  name: string;
  in: string;
  required: boolean;
  type: string;
  description: string;
  default?: unknown;
}

export interface ApiBodyField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: unknown;
}

export interface ApiResponse {
  status: string;
  description: string;
}

export interface ApiEndpoint {
  method: string;
  path: string;
  summary: string;
  description: string;
  operationId: string;
  parameters: ApiParameter[];
  requestBody: ApiBodyField[];
  responses: ApiResponse[];
}

export interface ApiGroup {
  tag: string;
  endpoints: ApiEndpoint[];
}

export interface OpenApiIndex {
  generatedAt: string;
  title: string;
  version: string;
  groups: ApiGroup[];
}

export const openApiIndex = data as OpenApiIndex;

/** Human-readable titles for each tag, in sidebar order. */
export const TAG_META: Record<string, { title: string; href: string }> = {
  auth: { title: "Authentication", href: "/docs/authentication" },
  chat: { title: "Chat completions", href: "/docs/chat" },
  models: { title: "Model tokens", href: "/docs/models" },
  agents: { title: "Agents", href: "/docs/agents" },
  "agent-queue": { title: "Agent queue", href: "/docs/agent-queue" },
  queries: { title: "Queries", href: "/docs/queries" },
  metrics: { title: "Metrics", href: "/docs/metrics" },
  dashboard: { title: "Dashboard", href: "/docs/dashboard" },
  health: { title: "Provider health", href: "/docs/health" },
};

export function tagTitle(tag: string): string {
  return TAG_META[tag]?.title ?? tag;
}

export function totalEndpoints(index: OpenApiIndex): number {
  return index.groups.reduce((n, g) => n + g.endpoints.length, 0);
}
