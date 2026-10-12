/**
 * Session auth for the admin API routes.
 *
 * Issues and verifies the *same* HS256 JWT the Python gateway issues
 * (shared secret + issuer + cookie name), so a session created by either
 * app works in the other. Mirrors app/auth/user_auth.py exactly.
 */

import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { db, userDict, type UserRow } from "./db";

const SECRET = process.env.AUTH_JWT_SECRET ?? "change-me-in-production";
const ISSUER = process.env.AUTH_JWT_ISSUER ?? "vizhi";
export const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "vizhi_session";
export const TTL_MINUTES = Number(process.env.AUTH_TOKEN_TTL_MINUTES ?? 60 * 24 * 7);

// ── HS256 JWT (no dependency — mirrors the Python implementation) ────────

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signToken(user: UserRow): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    email: user.email,
    iss: ISSUER,
    iat: now,
    exp: now + TTL_MINUTES * 60,
  };
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(`${header}.${body}`)
    .digest();
  let given: Buffer;
  try {
    given = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return null;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (payload.iss !== ISSUER) return null;
  if (Number(payload.exp ?? 0) < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// ── Request helpers ──────────────────────────────────────────────────────

export function sessionUser(request: NextRequest): UserRow | null {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;

  const row = db()
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(String(payload.sub ?? "")) as UserRow | undefined;
  return row ?? null;
}

/** Returns the admin user, or a 401/403 Response to return from the route. */
export function requireAdmin(
  request: NextRequest,
): { user: UserRow } | { error: Response } {
  const user = sessionUser(request);
  if (!user) {
    return {
      error: Response.json({ detail: "Not authenticated" }, { status: 401 }),
    };
  }
  if (user.role !== "admin") {
    return {
      error: Response.json({ detail: "Admin access required" }, { status: 403 }),
    };
  }
  return { user };
}

export function sessionCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.AUTH_COOKIE_SECURE === "true",
    sameSite: "lax" as const,
    maxAge: TTL_MINUTES * 60,
    path: "/",
  };
}

export { userDict };
