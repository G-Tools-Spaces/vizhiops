/**
 * POST /api/auth/login — password login, admin-gated.
 *
 * Verifies the bcrypt hash stored in auth_accounts (same as the gateway),
 * then issues the shared-session JWT cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { queryOne, userDict, type UserRow } from "@/lib/server/db";
import { signToken, sessionCookie } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json(
      { detail: "Email and password are required" },
      { status: 422 },
    );
  }

  const user = await queryOne<UserRow>("SELECT * FROM users WHERE email = $1", [email]);
  if (!user) {
    return NextResponse.json({ detail: "Invalid email or password" }, { status: 401 });
  }

  const account = await queryOne<{ password_hash: string | null }>(
    "SELECT password_hash FROM auth_accounts WHERE user_id = $1 AND provider = 'password'",
    [user.id],
  );
  if (!account?.password_hash) {
    return NextResponse.json({ detail: "Invalid email or password" }, { status: 401 });
  }

  const ok = await verifyBcrypt(password, account.password_hash);
  if (!ok) {
    return NextResponse.json({ detail: "Invalid email or password" }, { status: 401 });
  }

  const response = NextResponse.json({ user: userDict(user) });
  response.cookies.set(sessionCookie(signToken(user)));
  return response;
}

// bcrypt hashes are $2a$/$2b$ — verified with bcryptjs (pure JS, no native
// build). Loaded lazily so the route stays tree-shakeable.
async function verifyBcrypt(password: string, hash: string): Promise<boolean> {
  const { compare } = await import("bcryptjs");
  return compare(password, hash);
}
