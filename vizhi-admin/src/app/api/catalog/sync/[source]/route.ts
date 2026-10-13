/**
 * POST /api/catalog/sync/:source — pull live models into the catalog.
 *
 * source: any provider id in catalog_providers ("nvidia", "nebius", …).
 * Models are listed with the provider's console-stored key, base URL and
 * API style (OpenAI / Anthropic / Gemini / Azure). "nvidia" and
 * "huggingface" are auto-created and may still fall back to an env key.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  execute,
  loadProvider,
  query,
  withTransaction,
  type CatalogProviderRow,
} from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { effectiveSettings, modelsRequest } from "@/lib/providers";

type Params = { params: Promise<{ source: string }> };

// Model-id keywords that indicate non-chat models — skipped on import.
const NON_CHAT_KEYWORDS = [
  "embed", "retriever", "vision", "vlm", "vila", "neva", "kosmos", "deplot",
  "nvclip", "safety", "guard", "nemoguard", "translate", "riva", "parse",
  "detector", "calibration", "reward", "diffusion", "whisper", "tts",
  "stable-diffusion", "flux", "sdxl", "clip", "rerank",
];

function isChatModel(id: string): boolean {
  const lower = id.toLowerCase();
  return !NON_CHAT_KEYWORDS.some((k) => lower.includes(k));
}

type FetchResult = { models: { id: string; label: string }[]; origin: string };

type ModelList = {
  data?: { id?: string }[];
  // Gemini: { models: [{ name: "models/gemini-2.5-flash", supportedGenerationMethods: [...] }] }
  models?: { name?: string; displayName?: string; supportedGenerationMethods?: string[] }[];
};

async function fetchModels(provider: CatalogProviderRow): Promise<FetchResult> {
  // The console key first; .env only as a fallback for the two built-ins
  // that used to be env-keyed.
  const envKey =
    provider.id === "nvidia"
      ? process.env.NVIDIA_API_KEY
      : provider.id === "huggingface"
        ? process.env.HUGGINGFACE_API_KEY ?? process.env.HF_TOKEN
        : undefined;
  const apiKey = provider.api_key || envKey || "";
  const { adapter, baseUrl } = effectiveSettings(provider.id, provider.adapter, provider.base_url);
  if (!apiKey || !baseUrl) {
    return { models: [], origin: "unconfigured" };
  }

  const { url, headers } = modelsRequest(adapter, baseUrl, apiKey);
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    return { models: [], origin: `upstream-${res.status}` };
  }
  const data = (await res.json()) as ModelList;

  const models =
    adapter === "gemini"
      ? (data.models ?? [])
          .filter((m) => m.name && (m.supportedGenerationMethods ?? []).includes("generateContent"))
          .map((m) => {
            const id = m.name!.replace(/^models\//, "");
            return { id, label: m.displayName || id };
          })
      : (data.data ?? []).filter((m) => m.id).map((m) => ({ id: m.id!, label: m.id! }));

  return { models: models.filter((m) => isChatModel(m.id)), origin: "live" };
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;
  const source = (await params).source;

  const providerId = source;
  const label =
    source === "nvidia"
      ? "NVIDIA NIM (build.nvidia.com)"
      : source === "huggingface"
        ? "🤗 Open Models (Free via HuggingFace)"
        : null;

  let provider = await loadProvider(providerId);
  // Built-ins are auto-created; DB-credentialed providers must already exist.
  if (!provider) {
    if (label === null) {
      return NextResponse.json(
        { detail: `Unknown sync source: ${source}` },
        { status: 404 },
      );
    }
    await execute(
      "INSERT INTO catalog_providers (id, label, sort_order, enabled) VALUES ($1, $2, $3, 1)",
      [providerId, label, source === "nvidia" ? 50 : 40],
    );
    provider = await loadProvider(providerId);
  }

  let models: { id: string; label: string }[] = [];
  let origin = "live";
  try {
    ({ models, origin } = await fetchModels(provider!));
  } catch {
    origin = "unreachable";
  }

  const existing = new Set(
    (
      await query<{ id: string }>(
        "SELECT id FROM catalog_models WHERE provider_id = $1",
        [providerId],
      )
    ).map((r) => r.id),
  );

  const fresh = models
    .map((model, order) => ({ id: `${providerId}/${model.id}`, label: model.label, order }))
    .filter((m) => !existing.has(m.id));

  if (fresh.length) {
    await withTransaction(async (client) => {
      for (const m of fresh) {
        await client.query(
          "INSERT INTO catalog_models (id, provider_id, label, sort_order, enabled) VALUES ($1, $2, $3, $4, 1)",
          [m.id, providerId, m.label, m.order],
        );
      }
    });
  }

  return NextResponse.json({ source: origin, created: fresh.length, total: models.length });
}
