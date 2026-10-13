// Provider API styles and built-in defaults — mirrors the gateway's
// app/providers/provider_config.py. Safe to import from client and server.

export const ADAPTERS = [
  {
    id: "openai",
    label: "OpenAI-compatible (OpenAI SDK)",
    hint: "OpenAI, NVIDIA NIM, Nebius, Groq, Together, Fireworks, DeepSeek, HuggingFace, Ollama, vLLM…",
    baseUrlPlaceholder: "https://api.studio.nebius.com/v1",
  },
  {
    id: "anthropic",
    label: "Anthropic (Messages API)",
    hint: "Anthropic, or any Anthropic-compatible endpoint",
    baseUrlPlaceholder: "https://api.anthropic.com",
  },
  {
    id: "gemini",
    label: "Google Gemini (generateContent)",
    hint: "Google AI Studio / Gemini API",
    baseUrlPlaceholder: "https://generativelanguage.googleapis.com/v1beta",
  },
  {
    id: "azure-openai",
    label: "Azure OpenAI",
    hint: "Sends the key as an api-key header",
    baseUrlPlaceholder: "https://<resource>.openai.azure.com/openai/v1",
  },
] as const;

export type AdapterId = (typeof ADAPTERS)[number]["id"];

export function isAdapterId(value: string): value is AdapterId {
  return ADAPTERS.some((a) => a.id === value);
}

export function adapterInfo(id: string) {
  return ADAPTERS.find((a) => a.id === id) ?? ADAPTERS[0];
}

type Builtin = { adapter: AdapterId; baseUrl: string };

// Built-ins the gateway knows: their base URL is optional in the console.
const BUILTINS: Record<string, Builtin> = {
  openai: { adapter: "openai", baseUrl: "https://api.openai.com/v1" },
  anthropic: { adapter: "anthropic", baseUrl: "https://api.anthropic.com" },
  gemini: { adapter: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  qwen: { adapter: "openai", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  huggingface: { adapter: "openai", baseUrl: "https://router.huggingface.co/v1" },
  nvidia: { adapter: "openai", baseUrl: "https://integrate.api.nvidia.com/v1" },
};

const ALIASES: Record<string, string> = {
  claude: "anthropic",
  google: "gemini",
  dashscope: "qwen",
  hf: "huggingface",
  nim: "nvidia",
};

export function builtinFor(providerId: string): Builtin | null {
  const id = providerId.toLowerCase();
  return BUILTINS[ALIASES[id] ?? id] ?? null;
}

/** The adapter and base URL the gateway will actually use for a provider. */
export function effectiveSettings(providerId: string, adapter: string | null, baseUrl: string | null) {
  const builtin = builtinFor(providerId);
  return {
    adapter: (adapter && isAdapterId(adapter) ? adapter : builtin?.adapter ?? "openai") as AdapterId,
    baseUrl: baseUrl || builtin?.baseUrl || null,
  };
}

/** URL + headers of the provider's model-list endpoint, per API style. */
export function modelsRequest(adapter: AdapterId, baseUrl: string, apiKey: string) {
  const url = new URL(baseUrl.trim());
  let path = url.pathname.replace(/\/+$/, "");
  let headers: Record<string, string>;

  if (adapter === "anthropic") {
    path = `${path.replace(/\/v1$/, "")}/v1/models`;
    headers = { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
  } else if (adapter === "gemini") {
    path = `${path || "/v1beta"}/models`;
    headers = { "x-goog-api-key": apiKey };
  } else {
    path = `${path || (adapter === "azure-openai" ? "/openai/v1" : "/v1")}/models`;
    headers = adapter === "azure-openai" ? { "api-key": apiKey } : { Authorization: `Bearer ${apiKey}` };
  }
  url.pathname = path;
  return { url: url.toString(), headers };
}
