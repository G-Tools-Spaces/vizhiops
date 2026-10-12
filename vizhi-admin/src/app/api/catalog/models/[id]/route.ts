/**
 * PATCH  /api/catalog/models/:id — update a model (id contains slashes).
 * DELETE /api/catalog/models/:id — delete a model.
 */

import { NextRequest, NextResponse } from "next/server";
import { execute, loadModel, modelDict } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;
  const id = decodeURIComponent((await params).id);

  const row = await loadModel(id);
  if (!row) {
    return NextResponse.json({ detail: "Model not found" }, { status: 404 });
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
  // Per-model pricing (USD per 1K tokens). null/empty clears → falls back
  // to the provider's blended rate.
  const inputPrice =
    body.input_price !== undefined
      ? body.input_price === null || String(body.input_price) === ""
        ? null
        : Number(body.input_price)
      : row.input_price;
  const outputPrice =
    body.output_price !== undefined
      ? body.output_price === null || String(body.output_price) === ""
        ? null
        : Number(body.output_price)
      : row.output_price;

  await execute(
    "UPDATE catalog_models SET label = $1, sort_order = $2, enabled = $3, input_price = $4, output_price = $5, updated_at = NOW() WHERE id = $6",
    [label, sortOrder, enabled, inputPrice, outputPrice, id],
  );

  return NextResponse.json(modelDict((await loadModel(id))!));
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;
  const id = decodeURIComponent((await params).id);

  const row = await loadModel(id);
  if (!row) {
    return NextResponse.json({ detail: "Model not found" }, { status: 404 });
  }

  await execute("DELETE FROM catalog_models WHERE id = $1", [id]);
  return new NextResponse(null, { status: 204 });
}
