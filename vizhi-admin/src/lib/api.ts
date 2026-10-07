const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
};

export type CatalogProvider = {
  id: string;
  label: string;
  sort_order: number;
  enabled: boolean;
  models: CatalogModel[];
};

export type ProviderCreateInput = {
  id: string;
  label: string;
  sort_order?: number;
  enabled?: boolean;
};

export type ProviderUpdateInput = {
  label?: string;
  sort_order?: number;
  enabled?: boolean;
};

export type ModelCreateInput = {
  id: string;
  label: string;
  sort_order?: number;
  enabled?: boolean;
};

export type ModelUpdateInput = {
  label?: string;
  sort_order?: number;
  enabled?: boolean;
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
  const response = await fetch(`${BASE_URL}${path}`, {
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
  // Auth (same session cookie as the main console)
  login: (input: { email: string; password: string }) =>
    request<{ user: AuthUser }>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  me: () => request<AuthUser>("/v1/auth/me"),
  logout: () => request<void>("/v1/auth/logout", { method: "POST" }),

  // Admin catalog
  listProviders: () => request<CatalogProvider[]>("/v1/admin/catalog/providers"),
  createProvider: (input: ProviderCreateInput) =>
    request<CatalogProvider>("/v1/admin/catalog/providers", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateProvider: (id: string, input: ProviderUpdateInput) =>
    request<CatalogProvider>(`/v1/admin/catalog/providers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteProvider: (id: string) =>
    request<void>(`/v1/admin/catalog/providers/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  createModel: (providerId: string, input: ModelCreateInput) =>
    request<CatalogModel>(
      `/v1/admin/catalog/providers/${encodeURIComponent(providerId)}/models`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  updateModel: (id: string, input: ModelUpdateInput) =>
    request<CatalogModel>(`/v1/admin/catalog/models/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteModel: (id: string) =>
    request<void>(`/v1/admin/catalog/models/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};
