"use client";

import type { AuthUser } from "@/lib/api";

let currentUser: AuthUser | null = null;

export function setCurrentUser(user: AuthUser | null) {
  currentUser = user;
}

export function getStoredUser(): AuthUser | null {
  return currentUser;
}

export function clearSession() {
  currentUser = null;
}
