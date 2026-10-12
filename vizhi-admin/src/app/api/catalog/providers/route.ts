/**
 * GET  /api/catalog/providers — list all providers with their models.
 * POST /api/catalog/providers — create a provider (optionally with credentials).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  db,
  providerDict,
  type CatalogModelRow,
  type CatalogProviderRow,
} from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";

const PROVIDER_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if ("error" in auth) return auth.error;

  const conn = db();
  const providers = conn
    .prepare(
      "SELECT * FROM catalog_providers ORDER BY sort_order, id",
    )
    .all() as CatalogProviderRow[];
  const models = conn
    .prepare("SELECT * FROM catalog_models ORDER BY sort_order, id")
    .all() as CatalogModelRow[];

  const byProvider = new Map<string, CatalogModelRow[]>();
  for (const model of models) {
    const list = byProvider.get(model.provider_id) ?? [];
    list.push(model);
    byProvider.set(model.provider_id, list);
  }

  return NextResponse.json(
    providers.map((p) => providerDict(p, byProvider.get(p.id) ?? [])),
  );
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  const id = String(body.id ?? "").trim().toLowerCase();
  const label = String(body.label ?? "").trim();
  const sortOrder = Number(body.sort_order ?? 0) || 0;
  const apiKey = String(body.api_key ?? "").trim() || null;
  const baseUrl = String(body.base_url ?? "").trim().replace(/\/+$/, "") || null;

  if (!PROVIDER_ID_RE.test(id)) {
    return NextResponse.json(
      {
        detail:
          "Provider id must be lowercase letters, digits and dashes (e.g. 'openai')",
      },
      { status: 422 },
    );
  }
  if (!label) {
    return NextResponse.json({ detail: "Label is required" }, { status: 422 });
  }

  const conn = db();
  const existing = conn
    .prepare("SELECT id FROM catalog_providers WHERE id = ?")
    .get(id);
  if (existing) {
    return NextResponse.json({ detail: "Provider id already exists" }, { status: 409 });
  }

  conn
    .prepare(
      "INSERT INTO catalog_providers (id, label, sort_order, enabled, api_key, base_url) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(id, label, sortOrder, 1, apiKey, baseUrl);

  const row = conn
    .prepare("SELECT * FROM catalog_providers WHERE id = ?")
    .get(id) as CatalogProviderRow;
  return NextResponse.json(providerDict(row, []), { status: 201 });
}
