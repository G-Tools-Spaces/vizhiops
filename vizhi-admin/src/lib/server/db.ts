/**
 * Direct access to the shared Vizhi database (PostgreSQL: Supabase or Neon).
 *
 * vizhi-admin is self-contained: its API routes read/write the same tables
 * the gateway uses (catalog_providers, catalog_models, users, auth_accounts),
 * over the same DATABASE_URL. The connection string can be pasted exactly as
 * the provider's console shows it: a SQLAlchemy driver suffix
 * (`postgresql+asyncpg://`) is dropped and libpq-only parameters
 * (`sslmode`, `channel_binding`) are translated into node-postgres options.
 *
 * The schema is owned by the backend's Alembic migrations; nothing here
 * creates tables.
 */

import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { builtinFor, effectiveSettings } from "@/lib/providers";

type Connection = { connectionString: string; ssl: false | { rejectUnauthorized: false } };

export function connectionOptions(raw: string | undefined = process.env.DATABASE_URL): Connection {
  if (!raw) {
    throw new Error("DATABASE_URL is not set (vizhi-admin needs the same PostgreSQL URL as the gateway)");
  }
  const url = new URL(raw);
  if (!/^postgres(ql)?(\+[a-z0-9]+)?:$/.test(url.protocol)) {
    throw new Error(`DATABASE_URL must be a PostgreSQL URL; got '${url.protocol}//'`);
  }
  url.protocol = "postgresql:";

  const sslmode = url.searchParams.get("sslmode");
  url.searchParams.delete("sslmode");
  url.searchParams.delete("channel_binding");

  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  // libpq's `require` means "encrypt, do not verify", which is what hosted
  // poolers expect; an explicit `disable`, or a local database with no mode,
  // means plain TCP.
  const ssl: Connection["ssl"] =
    sslmode === "disable" || (sslmode === null && local) ? false : { rejectUnauthorized: false };

  return { connectionString: url.toString(), ssl };
}

// One pool per process; kept on globalThis so Next's dev-mode module
// reloads do not leak connections.
const globalForPg = globalThis as unknown as { __vizhiPool?: Pool };

export function pool(): Pool {
  if (!globalForPg.__vizhiPool) {
    const { connectionString, ssl } = connectionOptions();
    globalForPg.__vizhiPool = new Pool({
      connectionString,
      ssl,
      // The admin console is low-traffic and shares a small free-tier
      // database with the gateway: a handful of connections is plenty.
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalForPg.__vizhiPool;
}

export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool().query<T>(sql, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Run a statement and return the affected row count. */
export async function execute(sql: string, params: unknown[] = []): Promise<number> {
  const result = await pool().query(sql, params);
  return result.rowCount ?? 0;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const value = await fn(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
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
  adapter: string | null;
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

// ── Loaders shared by the catalog routes ────────────────────────────────

export function loadProvider(id: string): Promise<CatalogProviderRow | null> {
  return queryOne<CatalogProviderRow>("SELECT * FROM catalog_providers WHERE id = $1", [id]);
}

export function loadModels(providerId: string): Promise<CatalogModelRow[]> {
  return query<CatalogModelRow>(
    "SELECT * FROM catalog_models WHERE provider_id = $1 ORDER BY sort_order, id",
    [providerId],
  );
}

export function loadModel(id: string): Promise<CatalogModelRow | null> {
  return queryOne<CatalogModelRow>("SELECT * FROM catalog_models WHERE id = $1", [id]);
}

// ── Shared serializers (mirror the gateway's API shapes) ─────────────────

export function maskKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export function providerDict(row: CatalogProviderRow, models: CatalogModelRow[]) {
  const effective = effectiveSettings(row.id, row.adapter, row.base_url);
  return {
    id: row.id,
    label: row.label,
    sort_order: row.sort_order,
    enabled: Boolean(row.enabled),
    models: models.map(modelDict),
    // Callable through the gateway with a console-managed key: built-ins
    // need only the key (their base URL has a default).
    has_credentials: Boolean(row.api_key && effective.baseUrl),
    api_key_masked: maskKey(row.api_key),
    base_url: row.base_url,
    adapter: row.adapter,
    effective_adapter: effective.adapter,
    effective_base_url: effective.baseUrl,
    is_builtin: builtinFor(row.id) !== null,
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
