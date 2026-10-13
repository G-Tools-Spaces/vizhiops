/** POST /api/catalog/providers/:id/models — add a model to a provider. */

import { NextRequest, NextResponse } from "next/server";
import { execute, loadModel, modelDict, queryOne } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;
  const providerId = decodeURIComponent((await params).id);

  const provider = await queryOne<{ id: string }>(
    "SELECT id FROM catalog_providers WHERE id = $1",
    [providerId],
  );
  if (!provider) {
    return NextResponse.json({ detail: "Provider not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  const rawId = String(body.id ?? "").trim().replace(/^\/+/, "");
  const label = String(body.label ?? "").trim();
  const sortOrder = Number(body.sort_order ?? 0) || 0;

  // The stored id is "<provider>/<upstream model id>": the gateway routes on
  // the prefix and sends the remainder upstream. Admins usually paste the
  // provider's own id (e.g. "Qwen/Qwen3-235B-A22B-Instruct-2507"), so add
  // the prefix when it is missing instead of rejecting the request.
  const id = rawId.startsWith(`${providerId}/`) ? rawId : `${providerId}/${rawId}`;
  if (id === `${providerId}/`) {
    return NextResponse.json(
      { detail: `Enter the model id as the provider names it (e.g. 'my-model' or '${providerId}/my-model')` },
      { status: 422 },
    );
  }
  if (!label) {
    return NextResponse.json({ detail: "Label is required" }, { status: 422 });
  }

  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM catalog_models WHERE id = $1",
    [id],
  );
  if (existing) {
    return NextResponse.json({ detail: "Model id already exists" }, { status: 409 });
  }

  await execute(
    "INSERT INTO catalog_models (id, provider_id, label, sort_order, enabled) VALUES ($1, $2, $3, $4, 1)",
    [id, providerId, label, sortOrder],
  );

  const row = (await loadModel(id))!;
  return NextResponse.json(modelDict(row), { status: 201 });
}
