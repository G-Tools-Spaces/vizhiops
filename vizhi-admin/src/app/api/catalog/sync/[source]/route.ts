/**
 * POST /api/catalog/sync/:source — pull live models into the catalog.
 *
 * source: "nvidia" | "huggingface" (env-keyed built-ins) or any other
 * provider id that exists in catalog_providers with stored credentials
 * (e.g. "nebius", "groq", …) — those are synced with their own DB-stored
 * key + base URL, so admin-added providers get one-click model import too.
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

type Params = { params: Promise<{ source: string }> };

const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";
const HF_BASE = "https://router.huggingface.co/v1";

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

async function fetchFromUrl(url: string, apiKey: string): Promise<FetchResult> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    return { models: [], origin: `upstream-${res.status}` };
  }
  const data = (await res.json()) as { data?: { id?: string }[] };
  const models = (data.data ?? [])
    .filter((m) => m.id && isChatModel(m.id!))
    .map((m) => ({ id: m.id!, label: m.id! }));
  return { models, origin: "live" };
}

async function fetchModels(source: string, provider: CatalogProviderRow | null): Promise<FetchResult> {
  // Built-in, env-keyed sources.
  if (source === "nvidia") {
    const key = process.env.NVIDIA_API_KEY ?? "";
    if (!key) return { models: [], origin: "unconfigured" };
    return fetchFromUrl(`${NVIDIA_BASE}/models`, key);
  }
  if (source === "huggingface") {
    const key = process.env.HUGGINGFACE_API_KEY ?? process.env.HF_TOKEN ?? "";
    if (!key) return { models: [], origin: "unconfigured" };
    return fetchFromUrl(`${HF_BASE}/models`, key);
  }

  // Any other source: a catalog provider with stored credentials.
  if (!provider) {
    throw new Error(`Unknown sync source: ${source}`);
  }
  if (!provider.api_key || !provider.base_url) {
    return { models: [], origin: "unconfigured" };
  }
  const base = provider.base_url.replace(/\/+$/, "").replace(/\/v1$/, "");
  return fetchFromUrl(`${base}/v1/models`, provider.api_key);
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
    ({ models, origin } = await fetchModels(source, provider));
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
