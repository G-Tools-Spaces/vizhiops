/** POST /api/auth/logout — clear the session cookie. */

import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/server/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
