/**
 * PATCH  /api/catalog/providers/:id — update label/order/enabled/credentials/adapter.
 * DELETE /api/catalog/providers/:id — delete provider and its models.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  execute,
  loadModels,
  loadProvider,
  providerDict,
  withTransaction,
} from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { ADAPTERS, isAdapterId } from "@/lib/providers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const row = await loadProvider(id);
  if (!row) {
    return NextResponse.json({ detail: "Provider not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

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
  // Empty string resets to the default (the built-in's own, else OpenAI).
  const adapter =
    body.adapter !== undefined ? String(body.adapter ?? "").trim() || null : row.adapter;
  if (adapter !== null && !isAdapterId(adapter)) {
    return NextResponse.json(
      { detail: `Adapter must be one of: ${ADAPTERS.map((a) => a.id).join(", ")}` },
      { status: 422 },
    );
  }

  await execute(
    "UPDATE catalog_providers SET label = $1, sort_order = $2, enabled = $3, api_key = $4, base_url = $5, adapter = $6, updated_at = NOW() WHERE id = $7",
    [label, sortOrder, enabled, apiKey, baseUrl, adapter, id],
  );

  const [updated, models] = await Promise.all([loadProvider(id), loadModels(id)]);
  return NextResponse.json(providerDict(updated!, models));
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const row = await loadProvider(id);
  if (!row) {
    return NextResponse.json({ detail: "Provider not found" }, { status: 404 });
  }

  // The FK cascades, but deleting the models explicitly keeps the intent
  // visible and the two statements commit together.
  await withTransaction(async (client) => {
    await client.query("DELETE FROM catalog_models WHERE provider_id = $1", [id]);
    await client.query("DELETE FROM catalog_providers WHERE id = $1", [id]);
  });
  return new NextResponse(null, { status: 204 });
}
