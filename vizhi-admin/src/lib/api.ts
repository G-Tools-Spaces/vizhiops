// vizhi-admin is self-contained: every call below hits this app's own
// Next.js API routes (src/app/api/**), which read/write the shared Vizhi
// database directly. No Python backend required.

// ── Types ────────────────────────────────────────────────────────────────

export type AuthUser = {
  id: string;
  email: string;
  email_verified: boolean;
  name: string;
  avatar_url: string;
  role: string;
};

export type CatalogModel = {
  id: string;
  provider_id: string;
  label: string;
  sort_order: number;
  enabled: boolean;
  input_price: number | null;
  output_price: number | null;
};

export type CatalogProvider = {
  id: string;
  label: string;
  sort_order: number;
  enabled: boolean;
  models: CatalogModel[];
  has_credentials: boolean;
  api_key_masked: string | null;
  base_url: string | null;
};

export type ProviderCreateInput = {
  id: string;
  label: string;
  sort_order?: number;
  enabled?: boolean;
  api_key?: string;
  base_url?: string;
};

export type ProviderUpdateInput = {
  label?: string;
  sort_order?: number;
  enabled?: boolean;
  api_key?: string;
  base_url?: string;
};

export type ModelCreateInput = {
  id: string;
  label: string;
  sort_order?: number;
  enabled?: boolean;
  input_price?: number;
  output_price?: number;
};

export type ModelUpdateInput = {
  label?: string;
  sort_order?: number;
  enabled?: boolean;
  input_price?: number | null;
  output_price?: number | null;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ── Request helper ───────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    credentials: "include",
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data?.detail) {
        message =
          typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail);
      }
    } catch {
      // keep default message
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

// ── API surface ──────────────────────────────────────────────────────────

export const api = {
  // Auth — same session cookie as the main console (shared JWT secret)
  login: (input: { email: string; password: string }) =>
    request<{ user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  me: () => request<AuthUser>("/api/auth/me"),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),

  // Catalog providers
  listProviders: () => request<CatalogProvider[]>("/api/catalog/providers"),
  createProvider: (input: ProviderCreateInput) =>
    request<CatalogProvider>("/api/catalog/providers", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateProvider: (id: string, input: ProviderUpdateInput) =>
    request<CatalogProvider>(`/api/catalog/providers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteProvider: (id: string) =>
    request<void>(`/api/catalog/providers/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  // Catalog models
  createModel: (providerId: string, input: ModelCreateInput) =>
    request<CatalogModel>(
      `/api/catalog/providers/${encodeURIComponent(providerId)}/models`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  updateModel: (id: string, input: ModelUpdateInput) =>
    request<CatalogModel>(`/api/catalog/models/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteModel: (id: string) =>
    request<void>(`/api/catalog/models/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  // Live model sync
  syncNvidia: () =>
    request<{ source: string; created: number; total: number }>(
      "/api/catalog/sync/nvidia",
      { method: "POST" },
    ),
  syncHuggingface: () =>
    request<{ source: string; created: number; total: number }>(
      "/api/catalog/sync/huggingface",
      { method: "POST" },
    ),
  // Any DB-credentialed provider (nebius, groq, …) — synced with its
  // stored key + base URL.
  syncProvider: (providerId: string) =>
    request<{ source: string; created: number; total: number }>(
      `/api/catalog/sync/${encodeURIComponent(providerId)}`,
      { method: "POST" },
    ),
};
