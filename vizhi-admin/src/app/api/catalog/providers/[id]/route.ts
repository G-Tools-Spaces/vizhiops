/**
 * PATCH  /api/catalog/providers/:id — update label/order/enabled/credentials.
 * DELETE /api/catalog/providers/:id — delete provider and its models.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  db,
  providerDict,
  type CatalogModelRow,
  type CatalogProviderRow,
} from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";

type Params = { params: Promise<{ id: string }> };

function loadProvider(id: string): CatalogProviderRow | null {
  return (
    (db()
      .prepare("SELECT * FROM catalog_providers WHERE id = ?")
      .get(id) as CatalogProviderRow | undefined) ?? null
  );
}

function loadModels(providerId: string): CatalogModelRow[] {
  return db()
    .prepare(
      "SELECT * FROM catalog_models WHERE provider_id = ? ORDER BY sort_order, id",
    )
    .all(providerId) as CatalogModelRow[];
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = requireAdmin(request);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const row = loadProvider(id);
  if (!row) {
    return NextResponse.json({ detail: "Provider not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  const conn = db();
  const label = body.label !== undefined ? String(body.label).trim() : row.label;
  const sortOrder =
    body.sort_order !== undefined ? Number(body.sort_order) || 0 : row.sort_order;
  const enabled =
    body.enabled !== undefined ? (body.enabled ? 1 : 0) : row.enabled;

  // Credential rotation: empty string clears, non-empty sets, omitted keeps.
  const apiKey =
    body.api_key !== undefined
      ? String(body.api_key).trim() || null
      : row.api_key;
  const baseUrl =
    body.base_url !== undefined
      ? String(body.base_url).trim().replace(/\/+$/, "") || null
      : row.base_url;

  conn
    .prepare(
      "UPDATE catalog_providers SET label = ?, sort_order = ?, enabled = ?, api_key = ?, base_url = ? WHERE id = ?",
    )
    .run(label, sortOrder, enabled, apiKey, baseUrl, id);

  return NextResponse.json(providerDict(loadProvider(id)!, loadModels(id)));
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = requireAdmin(request);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const row = loadProvider(id);
  if (!row) {
    return NextResponse.json({ detail: "Provider not found" }, { status: 404 });
  }

  const conn = db();
  conn.prepare("DELETE FROM catalog_models WHERE provider_id = ?").run(id);
  conn.prepare("DELETE FROM catalog_providers WHERE id = ?").run(id);
  return new NextResponse(null, { status: 204 });
}
