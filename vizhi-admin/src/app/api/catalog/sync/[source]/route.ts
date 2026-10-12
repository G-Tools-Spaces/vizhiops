/**
 * POST /api/catalog/sync/:source — pull live models into the catalog.
 *
 * source: "nvidia" | "huggingface" (env-keyed built-ins) or any other
 * provider id that exists in catalog_providers with stored credentials
 * (e.g. "nebius", "groq", …) — those are synced with their own DB-stored
 * key + base URL, so admin-added providers get one-click model import too.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, type CatalogProviderRow } from "@/lib/server/db";
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

async function fetchFromUrl(
  url: string,
  apiKey: string,
): Promise<FetchResult> {
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

async function fetchModels(source: string): Promise<FetchResult> {
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
  const provider = db()
    .prepare("SELECT * FROM catalog_providers WHERE id = ?")
    .get(source) as CatalogProviderRow | undefined;
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
  const auth = requireAdmin(request);
  if ("error" in auth) return auth.error;
  const source = (await params).source;

  const conn = db();
  const providerId = source;
  const label =
    source === "nvidia"
      ? "NVIDIA NIM (build.nvidia.com)"
      : source === "huggingface"
        ? "🤗 Open Models (Free via HuggingFace)"
        : null;

  // Built-ins are auto-created; DB-credentialed providers already exist.
  if (label !== null) {
    const existing = conn
      .prepare("SELECT id FROM catalog_providers WHERE id = ?")
      .get(providerId);
    if (!existing) {
      conn
        .prepare(
          "INSERT INTO catalog_providers (id, label, sort_order, enabled) VALUES (?, ?, ?, 1)",
        )
        .run(providerId, label, source === "nvidia" ? 50 : 40);
    }
  } else {
    const existing = conn
      .prepare("SELECT id FROM catalog_providers WHERE id = ?")
      .get(providerId);
    if (!existing) {
      return NextResponse.json(
        { detail: `Unknown sync source: ${source}` },
        { status: 404 },
      );
    }
  }

  let models: { id: string; label: string }[] = [];
  let origin = "live";
  try {
    ({ models, origin } = await fetchModels(source));
  } catch {
    origin = "unreachable";
  }

  const existing = new Set(
    (conn
      .prepare("SELECT id FROM catalog_models WHERE provider_id = ?")
      .all(providerId) as { id: string }[]).map((r) => r.id),
  );

  let created = 0;
  const insert = conn.prepare(
    "INSERT INTO catalog_models (id, provider_id, label, sort_order, enabled) VALUES (?, ?, ?, ?, 1)",
  );
  models.forEach((model, order) => {
    const modelId = `${providerId}/${model.id}`;
    if (existing.has(modelId)) return;
    insert.run(modelId, providerId, model.label, order);
    created += 1;
  });

  return NextResponse.json({ source: origin, created, total: models.length });
}
