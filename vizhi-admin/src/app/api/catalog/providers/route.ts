/**
 * GET  /api/catalog/providers — list all providers with their models.
 * POST /api/catalog/providers — create a provider (optionally with credentials).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  execute,
  loadProvider,
  providerDict,
  query,
  queryOne,
  type CatalogModelRow,
  type CatalogProviderRow,
} from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";

const PROVIDER_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const providers = await query<CatalogProviderRow>(
    "SELECT * FROM catalog_providers ORDER BY sort_order, id",
  );
  const models = await query<CatalogModelRow>(
    "SELECT * FROM catalog_models ORDER BY sort_order, id",
  );

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
  const auth = await requireAdmin(request);
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

  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM catalog_providers WHERE id = $1",
    [id],
  );
  if (existing) {
    return NextResponse.json({ detail: "Provider id already exists" }, { status: 409 });
  }

  await execute(
    "INSERT INTO catalog_providers (id, label, sort_order, enabled, api_key, base_url) VALUES ($1, $2, $3, 1, $4, $5)",
    [id, label, sortOrder, apiKey, baseUrl],
  );

  const row = (await loadProvider(id))!;
  return NextResponse.json(providerDict(row, []), { status: 201 });
}
