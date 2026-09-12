import type {
  Agent,
  AgentModelLink,
  ModelConnection,
  Provider,
  ProviderCatalogItem,
  RequestEvent,
  MetricPoint,
  Status,
} from "@/types/domain";
import { clearSession, type AuthSession } from "@/lib/auth";

// ── Budget types (exported for use in components) ──────────────────────
export type BudgetStatus = {
  /** agent_id or model_connection_id */
  agent_id?: string;
  model_connection_id?: string;
  budget_usd: number | null;
  budget_tokens: number | null;
  budget_reset_at: string | null;
  spent_usd: number;
  spent_tokens: number;
  remaining_usd: number | null;
  remaining_tokens: number | null;
  exceeded: boolean;
};

export type BudgetUpdateInput = {
  budget_usd?: number | null;
  budget_tokens?: number | null;
  budget_reset_at?: string | null;
  clear?: boolean;
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export type CreateModelConnectionInput = {
  provider: Provider;
  modelName: string;
  tokenName?: string;
  metadata?: string;
};

export type ModelConnectionCreated = ModelConnection & { apiKey: string };

export type CreateAgentInput = {
  name: string;
  description: string;
  tags: string;
  tokenName?: string;
};

export type AgentCreated = Agent & { apiKey: string };

type ApiMetricPoint = {
  time: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  latency: number;
  errors: number;
};

type ApiRequestEvent = {
  id: string;
  timestamp: string;
  agent_id: string;
  model: string;
  endpoint: string;
  status: number;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  error_message?: string;
  prompt?: Array<{ role: string; content: string }>;
  response_text?: string;
};

type ApiModelConnection = {
  id: string;
  provider: string;
  model_name: string;
  token_name?: string | null;
  status: string;
  created_at: string;
  usage_count: number;
  masked_key?: string;
  last_used_at?: string | null;
  metadata?: string | null;
};

type ApiModelConnectionCreated = {
  model_connection: ApiModelConnection;
  api_key: string;
};

type ApiAgent = {
  id: string;
  name: string;
  description: string;
  token_name?: string | null;
  agent_id: string;
  tags?: string[];
  status: string;
  created_at: string;
  masked_key: string;
  last_used_at?: string | null;
};

type ApiAgentCreated = {
  agent: ApiAgent;
  api_key: string;
};

function displayProvider(provider: string): Provider {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    if (response.status === 401) {
      clearSession();
    }
    throw new Error(errData.detail || `HTTP error ${response.status}`);
  }
  // Handle 204 No Content responses
  if (response.status === 204) {
    return null as T;
  }
  return response.json();
}

export const api = {
  async signup(input: { email: string; password: string; name?: string }): Promise<AuthSession> {
    return request<AuthSession>("/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async login(input: { email: string; password: string }): Promise<AuthSession> {
    return request<AuthSession>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async loginWithGoogle(idToken: string): Promise<AuthSession> {
    return request<AuthSession>("/v1/auth/google", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken }),
    });
  },

  async logout(): Promise<void> {
    await request<void>("/v1/auth/logout", { method: "POST" });
  },

  async me(): Promise<AuthSession["user"]> {
    return request<AuthSession["user"]>("/v1/auth/me");
  },

  async getDashboard(): Promise<{
    totals: {
      agents: number;
      modelTokens: number;
      requestsToday: number;
      tokensConsumed: number;
      errors: number;
      activeModels: number;
    };
    metricSeries: MetricPoint[];
    recentRequests: RequestEvent[];
  }> {
    const data = await request<{
      totals: {
        agents: number;
        model_tokens: number;
        requests_today: number;
        tokens_consumed: number;
        errors: number;
        active_models: number;
      };
      metric_series: ApiMetricPoint[];
      recent_requests: ApiRequestEvent[];
    }>("/v1/dashboard");
    return {
      totals: {
        agents: data.totals.agents,
        modelTokens: data.totals.model_tokens,
        requestsToday: data.totals.requests_today,
        tokensConsumed: data.totals.tokens_consumed,
        errors: data.totals.errors,
        activeModels: data.totals.active_models,
      },
      metricSeries: data.metric_series.map((point) => ({
        time: point.time,
        requests: point.requests,
        inputTokens: point.input_tokens,
        outputTokens: point.output_tokens,
        latency: point.latency,
        errors: point.errors,
      })),
      recentRequests: data.recent_requests.map((req) => ({
        id: req.id,
        timestamp: req.timestamp,
        agentId: req.agent_id,
        modelId: req.model,
        endpoint: req.endpoint,
        status: req.status,
        latencyMs: req.latency_ms,
        inputTokens: req.input_tokens,
        outputTokens: req.output_tokens,
        estimatedCost: req.estimated_cost,
        errorMessage: req.error_message,
      })),
    };
  },

  async getModels(): Promise<ModelConnection[]> {
    const list = await request<ApiModelConnection[]>("/v1/models");
    return list.map((item) => ({
      id: item.id,
      provider: displayProvider(item.provider),
      modelName: item.model_name,
      tokenName: item.token_name ?? undefined,
      status: (item.status as ModelConnection["status"]),
      createdAt: item.created_at,
      usageCount: item.usage_count,
      maskedKey: item.masked_key || "vz_live_...",
      lastUsedAt: item.last_used_at ?? undefined,
      metadata: item.metadata || undefined,
    }));
  },

  async getModelCatalog(): Promise<ProviderCatalogItem[]> {
    return request<ProviderCatalogItem[]>("/v1/models/registry");
  },

  async createModelConnection(input: CreateModelConnectionInput): Promise<ModelConnectionCreated> {
    const res = await request<{
      model_connection: ApiModelConnection;
      api_key: string;
    }>("/v1/models", {
      method: "POST",
      body: JSON.stringify({
        provider: input.provider.toLowerCase(),
        model_name: input.modelName,
        token_name: input.tokenName || null,
        metadata: input.metadata || "",
      }),
    });
    return {
      id: res.model_connection.id,
      provider: displayProvider(res.model_connection.provider),
      modelName: res.model_connection.model_name,
      status: res.model_connection.status as Status,
      createdAt: res.model_connection.created_at,
      usageCount: res.model_connection.usage_count,
      maskedKey: res.model_connection.masked_key || "vz_live_...",
      metadata: res.model_connection.metadata || undefined,
      apiKey: res.api_key,
    };
  },

 

  async getAgents(): Promise<Agent[]> {
    const list = await request<ApiAgent[]>("/v1/agents");
    return list.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      tokenName: item.token_name ?? undefined,
      cid: item.agent_id,
      tags: item.tags || [],
      status: item.status as Agent["status"],
      maskedKey: item.masked_key,
      lastUsedAt: item.last_used_at ?? undefined,
      createdAt: item.created_at,
    }));
  },

  async createAgent(input: CreateAgentInput): Promise<AgentCreated> {
    const res = await request<ApiAgentCreated>("/v1/agents", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        tags: input.tags,
        token_name: input.tokenName ?? null,
      }),
    });
    return {
      id: res.agent.id,
      name: res.agent.name,
      description: res.agent.description,
      tokenName: res.agent.token_name ?? undefined,
      cid: res.agent.agent_id,
      tags: res.agent.tags || [],
      status: res.agent.status as Agent["status"],
      maskedKey: res.agent.masked_key,
      lastUsedAt: res.agent.last_used_at ?? undefined,
      createdAt: res.agent.created_at,
      apiKey: res.api_key, // Full plaintext key — returned once only
    };
  },

  async revokeAgent(agentCID: string): Promise<Agent> {
    const res = await request<ApiAgent>(
      `/v1/agents/${encodeURIComponent(agentCID)}/revoke`,
      { method: "POST" }
    );
    return {
      id: res.id,
      name: res.name,
      description: res.description,
      tokenName: res.token_name ?? undefined,
      cid: res.agent_id,
      tags: res.tags || [],
      status: res.status as Agent["status"],
      maskedKey: res.masked_key,
      lastUsedAt: res.last_used_at ?? undefined,
      createdAt: res.created_at,
    };
  },

  async rotateAgent(agentCID: string): Promise<AgentCreated> {
    const res = await request<ApiAgentCreated>(
      `/v1/agents/${encodeURIComponent(agentCID)}/rotate`,
      { method: "POST" }
    );
    return {
      id: res.agent.id,
      name: res.agent.name,
      description: res.agent.description,
      tokenName: res.agent.token_name ?? undefined,
      cid: res.agent.agent_id,
      tags: res.agent.tags || [],
      status: res.agent.status as Agent["status"],
      maskedKey: res.agent.masked_key,
      lastUsedAt: res.agent.last_used_at ?? undefined,
      createdAt: res.agent.created_at,
      apiKey: res.api_key, // New plaintext key — returned once only
    };
  },

  async getLinks(): Promise<AgentModelLink[]> {
    if (typeof window === "undefined") return [];
    const local = localStorage.getItem("vizhi_links");
    if (local) return JSON.parse(local);
    const initial: AgentModelLink[] = [];
    localStorage.setItem("vizhi_links", JSON.stringify(initial));
    return initial;
  },

  async createLink(agentId: string, modelId: string): Promise<AgentModelLink> {
    const links = await this.getLinks();
    const newLink: AgentModelLink = {
      id: `ln_${Math.random().toString(36).substring(2, 7)}`,
      agentId,
      modelId,
      status: "active",
      createdAt: new Date().toISOString(),
      requestCount: 0,
      tokenConsumption: 0,
    };
    links.push(newLink);
    if (typeof window !== "undefined") {
      localStorage.setItem("vizhi_links", JSON.stringify(links));
    }
    return newLink;
  },

  async getMetrics(params?: {
    timeRange?: string;
    agentId?: string;
    modelId?: string;
  }): Promise<{
    metricSeries: MetricPoint[];
    requests: RequestEvent[];
  }> {
    const searchParams = new URLSearchParams();
    if (params?.timeRange) searchParams.set("time_range", params.timeRange);
    if (params?.agentId && params.agentId !== "all") searchParams.set("agent_id", params.agentId);
    if (params?.modelId && params.modelId !== "all") searchParams.set("model_id", params.modelId);
    const qs = searchParams.toString();
    const data = await request<{
      metric_series: ApiMetricPoint[];
      requests: ApiRequestEvent[];
    }>(`/v1/metrics${qs ? `?${qs}` : ""}`);
    return {
      metricSeries: data.metric_series.map((point) => ({
        time: point.time,
        requests: point.requests,
        inputTokens: point.input_tokens,
        outputTokens: point.output_tokens,
        latency: point.latency,
        errors: point.errors,
      })),
      requests: data.requests.map((req) => ({
        id: req.id,
        timestamp: req.timestamp,
        agentId: req.agent_id,
        modelId: req.model,
        endpoint: req.endpoint,
        status: req.status,
        latencyMs: req.latency_ms,
        inputTokens: req.input_tokens,
        outputTokens: req.output_tokens,
        estimatedCost: req.estimated_cost,
        errorMessage: req.error_message,
        prompt: req.prompt ?? [],
        responseText: req.response_text ?? "",
      })),
    };
  },

  async getTrace(id: string): Promise<RequestEvent> {
    const req = await request<ApiRequestEvent>(`/v1/queries/${id}`);
    return {
      id: req.id,
      timestamp: req.timestamp,
      agentId: req.agent_id,
      modelId: req.model,
      endpoint: req.endpoint,
      status: req.status,
      latencyMs: req.latency_ms,
      inputTokens: req.input_tokens,
      outputTokens: req.output_tokens,
      estimatedCost: req.estimated_cost,
      errorMessage: req.error_message,
    };
  },

  async revokeModel(modelId: string): Promise<ModelConnection> {
    const res = await request<ApiModelConnection>(
      `/v1/models/${encodeURIComponent(modelId)}/revoke`,
      { method: "POST" }
    );
    return {
      id: res.id,
      provider: displayProvider(res.provider),
      modelName: res.model_name,
      tokenName: res.token_name ?? undefined,
      status: (res.status as ModelConnection["status"]),
      createdAt: res.created_at,
      usageCount: res.usage_count,
      maskedKey: res.masked_key || "vz_live_...",
      lastUsedAt: res.last_used_at ?? undefined,
      metadata: res.metadata || undefined,
    };
  },

  async rotateModel(modelId: string): Promise<ModelConnectionCreated> {
    const res = await request<ApiModelConnectionCreated>(
      `/v1/models/${encodeURIComponent(modelId)}/rotate`,
      { method: "POST" }
    );
    return {
      id: res.model_connection.id,
      provider: displayProvider(res.model_connection.provider),
      modelName: res.model_connection.model_name,
      tokenName: res.model_connection.token_name ?? undefined,
      status: (res.model_connection.status as ModelConnection["status"]),
      createdAt: res.model_connection.created_at,
      usageCount: res.model_connection.usage_count,
      maskedKey: res.model_connection.masked_key || "vz_live_...",
      lastUsedAt: res.model_connection.last_used_at ?? undefined,
      metadata: res.model_connection.metadata || undefined,
      apiKey: res.api_key,
    };
  },

  async deleteModel(modelId: string): Promise<void> {
    await request(`/v1/models/${modelId}`, {
      method: "DELETE",
    });
  },

  async deleteAgent(agentCID: string): Promise<void> {
    await request(`/v1/agents/${encodeURIComponent(agentCID)}`, {
      method: "DELETE",
    });
  },

  // ── Budget ─────────────────────────────────────────────────────────────

  async getAgentBudget(agentCID: string): Promise<BudgetStatus> {
    return request<BudgetStatus>(`/v1/agents/${encodeURIComponent(agentCID)}/budget`);
  },

  async updateAgentBudget(agentCID: string, body: BudgetUpdateInput): Promise<BudgetStatus> {
    return request<BudgetStatus>(`/v1/agents/${encodeURIComponent(agentCID)}/budget`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  async getModelBudget(modelId: string): Promise<BudgetStatus> {
    return request<BudgetStatus>(`/v1/models/${encodeURIComponent(modelId)}/budget`);
  },

  async updateModelBudget(modelId: string, body: BudgetUpdateInput): Promise<BudgetStatus> {
    return request<BudgetStatus>(`/v1/models/${encodeURIComponent(modelId)}/budget`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  async getProviderHealth(): Promise<{
    overallStatus: string;
    checkedAt: string;
    providers: Array<{
      provider: string;
      label: string;
      status: string;
      latencyMs: number;
      lastChecked: string;
      message: string;
      incidentCount: number;
    }>;
  }> {
    const data = await request<{
      overall_status: string;
      checked_at: string;
      providers: Array<{
        provider: string;
        label: string;
        status: string;
        latency_ms: number;
        last_checked: string;
        message: string;
        incident_count: number;
      }>;
    }>("/v1/health/providers");
    return {
      overallStatus: data.overall_status,
      checkedAt: data.checked_at,
      providers: data.providers.map((p) => ({
        provider: p.provider,
        label: p.label,
        status: p.status,
        latencyMs: p.latency_ms,
        lastChecked: p.last_checked,
        message: p.message,
        incidentCount: p.incident_count,
      })),
    };
  },

  async refreshProviderHealth(): Promise<{
    overallStatus: string;
    checkedAt: string;
    providers: Array<{
      provider: string;
      label: string;
      status: string;
      latencyMs: number;
      lastChecked: string;
      message: string;
      incidentCount: number;
    }>;
  }> {
    const data = await request<{
      overall_status: string;
      checked_at: string;
      providers: Array<{
        provider: string;
        label: string;
        status: string;
        latency_ms: number;
        last_checked: string;
        message: string;
        incident_count: number;
      }>;
    }>("/v1/health/providers/refresh", { method: "POST" });
    return {
      overallStatus: data.overall_status,
      checkedAt: data.checked_at,
      providers: data.providers.map((p) => ({
        provider: p.provider,
        label: p.label,
        status: p.status,
        latencyMs: p.latency_ms,
        lastChecked: p.last_checked,
        message: p.message,
        incidentCount: p.incident_count,
      })),
    };
  },

  async getModelUsage(modelId: string): Promise<{
    modelConnection: ModelConnection;
    stats: {
      totalRequests: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalTokens: number;
      totalCost: number;
      avgLatencyMs: number;
      errorCount: number;
      successRate: number;
    };
    recentQueries: Array<{
      queryId: string;
      timestamp: string;
      agentId: string;
      prompt: Array<{ role: string; content: string }>;
      responseText: string;
      inputTokens: number;
      outputTokens: number;
      latencyMs: number;
      statusCode: number;
      estimatedCost: number;
      errorMessage?: string;
    }>;
  }> {
    const data = await request<{
      model_connection: ApiModelConnection;
      stats: {
        total_requests: number;
        total_input_tokens: number;
        total_output_tokens: number;
        total_tokens: number;
        total_cost: number;
        avg_latency_ms: number;
        error_count: number;
        success_rate: number;
      };
      recent_queries: Array<{
        query_id: string;
        timestamp: string;
        agent_id: string;
        prompt: Array<{ role: string; content: string }>;
        response_text: string;
        input_tokens: number;
        output_tokens: number;
        latency_ms: number;
        status_code: number;
        estimated_cost: number;
        error_message?: string;
      }>;
    }>(`/v1/models/${modelId}/usage`);

    return {
      modelConnection: {
        id: data.model_connection.id,
        provider: displayProvider(data.model_connection.provider),
        modelName: data.model_connection.model_name,
        status: data.model_connection.status as Status,
        createdAt: data.model_connection.created_at,
        usageCount: data.model_connection.usage_count,
        maskedKey: data.model_connection.masked_key || "vz_live_...",
        metadata: data.model_connection.metadata || undefined,
      },
      stats: {
        totalRequests: data.stats.total_requests,
        totalInputTokens: data.stats.total_input_tokens,
        totalOutputTokens: data.stats.total_output_tokens,
        totalTokens: data.stats.total_tokens,
        totalCost: data.stats.total_cost,
        avgLatencyMs: data.stats.avg_latency_ms,
        errorCount: data.stats.error_count,
        successRate: data.stats.success_rate,
      },
      recentQueries: data.recent_queries.map((q) => ({
        queryId: q.query_id,
        timestamp: q.timestamp,
        agentId: q.agent_id,
        prompt: q.prompt,
        responseText: q.response_text,
        inputTokens: q.input_tokens,
        outputTokens: q.output_tokens,
        latencyMs: q.latency_ms,
        statusCode: q.status_code,
        estimatedCost: q.estimated_cost,
        errorMessage: q.error_message,
      })),
    };
  },
};


 
