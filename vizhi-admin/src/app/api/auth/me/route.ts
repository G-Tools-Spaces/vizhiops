/** GET /api/auth/me — the signed-in user (any role). */

import { NextRequest, NextResponse } from "next/server";
import { userDict } from "@/lib/server/db";
import { sessionUser } from "@/lib/server/auth";

export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json(userDict(user));
}
