/**
 * Direct access to the shared Vizhi database.
 *
 * vizhi-admin is self-contained: its API routes read/write the same SQLite
 * database the gateway uses (catalog, users, auth accounts). The path is
 * configurable so production can point elsewhere.
 *
 * Uses Node's built-in `node:sqlite` (DatabaseSync) — no native dependency.
 */

import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const DB_PATH = process.env.VIZHI_DB_PATH
  ? path.resolve(process.env.VIZHI_DB_PATH)
  : path.resolve(process.cwd(), "../vizhi-backend/vizhi.db");

let _db: DatabaseSync | null = null;

export function db(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    _db.exec("PRAGMA journal_mode = WAL;");
    _db.exec("PRAGMA foreign_keys = ON;");
  }
  return _db;
}

// ── Row types ────────────────────────────────────────────────────────────

export type UserRow = {
  id: string;
  email: string;
  email_verified: number;
  name: string | null;
  avatar_url: string | null;
  role: string;
};

export type CatalogProviderRow = {
  id: string;
  label: string;
  sort_order: number;
  enabled: number;
  api_key: string | null;
  base_url: string | null;
};

export type CatalogModelRow = {
  id: string;
  provider_id: string;
  label: string;
  sort_order: number;
  enabled: number;
  input_price: number | null;
  output_price: number | null;
};

// ── Shared serializers (mirror the old Python API shapes) ────────────────

export function maskKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export function providerDict(
  row: CatalogProviderRow,
  models: CatalogModelRow[],
) {
  return {
    id: row.id,
    label: row.label,
    sort_order: row.sort_order,
    enabled: Boolean(row.enabled),
    models: models.map(modelDict),
    has_credentials: Boolean(row.api_key && row.base_url),
    api_key_masked: maskKey(row.api_key),
    base_url: row.base_url,
  };
}

export function modelDict(row: CatalogModelRow) {
  return {
    id: row.id,
    provider_id: row.provider_id,
    label: row.label,
    sort_order: row.sort_order,
    enabled: Boolean(row.enabled),
    input_price: row.input_price,
    output_price: row.output_price,
  };
}

export function userDict(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    email_verified: Boolean(row.email_verified),
    name: row.name ?? "",
    avatar_url: row.avatar_url ?? "",
    role: row.role ?? "user",
  };
}
