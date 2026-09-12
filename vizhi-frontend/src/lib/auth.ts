"use client";

export type AuthUser = {
  id: string;
  email: string;
  email_verified: boolean;
  name: string;
  avatar_url: string;
};

export type AuthSession = {
  user: AuthUser;
};

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

export function isAuthenticated() {
  return currentUser !== null;
}
