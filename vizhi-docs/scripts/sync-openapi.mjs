#!/usr/bin/env node
/**
 * Sync the API reference with the backend's OpenAPI spec.
 *
 * Fetches the live spec (default http://localhost:8000/openapi.json), flattens
 * every path/method into a clean grouped structure, and writes it to
 * src/lib/openapi.generated.json. The /docs/reference page renders that file,
 * so any endpoint added to the backend shows up in the docs the next time this
 * runs — no hand-editing required.
 *
 * It also diffs the new spec against the previously generated file and
 * prepends a dated entry to src/lib/changelog.generated.json, which the
 * /docs/changelog page renders.
 *
 * Usage:
 *   npm run sync                          # fetch from the running backend
 *   OPENAPI_URL=http://host/openapi.json npm run sync
 *   npm run sync -- path/to/openapi.json  # or read a saved spec from disk
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_FILE = resolve(ROOT, "src/lib/openapi.generated.json");
const CHANGELOG_FILE = resolve(ROOT, "src/lib/changelog.generated.json");

const DEFAULT_URL =
  process.env.OPENAPI_URL ?? "http://localhost:8000/openapi.json";

/** Endpoints that exist but are not part of the public reference. */
const HIDDEN_PATHS = new Set(["/"]);

const METHOD_ORDER = ["get", "post", "patch", "put", "delete"];

async function loadSpec(source) {
  if (source.startsWith("http://") || source.startsWith("https://")) {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`GET ${source} → ${res.status} ${res.statusText}`);
    }
    return res.json();
  }
  return JSON.parse(await readFile(resolve(source), "utf8"));
}

/** Resolve a local `#/components/schemas/...` reference one level. */
function deref(spec, node) {
  if (node && typeof node === "object" && "$ref" in node) {
    const ref = node.$ref;
    const name = ref.split("/").pop();
    return spec.components?.schemas?.[name] ?? node;
  }
  return node;
}

function schemaType(schema) {
  if (!schema || typeof schema !== "object") return "any";
  if (schema.anyOf) {
    const types = schema.anyOf
      .map((s) => (s.type === "null" ? null : schemaType(s)))
      .filter(Boolean);
    const base = types[0] ?? "any";
    return schema.anyOf.some((s) => s.type === "null") ? `${base} | null` : base;
  }
  if (schema.type === "array") return `array[${schemaType(schema.items)}]`;
  if (Array.isArray(schema.type)) return schema.type.join(" | ");
  return schema.type ?? "object";
}

function bodyFields(spec, requestBody) {
  const content = requestBody?.content?.["application/json"]?.schema;
  if (!content) return [];
  const schema = deref(spec, content);
  if (!schema?.properties) return [];
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties).map(([name, prop]) => {
    const resolved = deref(spec, prop);
    return {
      name,
      type: schemaType(resolved),
      required: required.has(name),
      description: resolved.description ?? "",
      default: resolved.default,
    };
  });
}

function parameters(spec, op) {
  return (op.parameters ?? []).map((p) => {
    const schema = deref(spec, p.schema);
    return {
      name: p.name,
      in: p.in,
      required: Boolean(p.required),
      type: schemaType(schema),
      description: p.description ?? schema.description ?? "",
      default: schema.default,
    };
  });
}

function responses(op) {
  return Object.entries(op.responses ?? {}).map(([status, r]) => ({
    status,
    description: typeof r.description === "string" ? r.description : "",
  }));
}

function transform(spec) {
  const groups = new Map();

  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    if (HIDDEN_PATHS.has(path)) continue;
    for (const method of METHOD_ORDER) {
      const op = pathItem?.[method];
      if (!op) continue;
      const tag = op.tags?.[0] ?? "other";
      const endpoint = {
        method: method.toUpperCase(),
        path,
        summary: op.summary ?? "",
        description: op.description ?? "",
        operationId: op.operationId ?? "",
        parameters: parameters(spec, op),
        requestBody: bodyFields(spec, op.requestBody),
        responses: responses(op),
      };
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag).push(endpoint);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    title: spec.info?.title ?? "API",
    version: spec.info?.version ?? "",
    groups: [...groups.entries()].map(([tag, endpoints]) => ({
      tag,
      endpoints,
    })),
  };
}

/** Flatten groups into a `METHOD path` → endpoint map for diffing. */
function endpointMap(index) {
  const map = new Map();
  for (const group of index.groups ?? []) {
    for (const endpoint of group.endpoints ?? []) {
      map.set(`${endpoint.method} ${endpoint.path}`, endpoint);
    }
  }
  return map;
}

/** What makes an endpoint "changed" for changelog purposes. */
function fingerprint(endpoint) {
  return JSON.stringify({
    summary: endpoint.summary,
    description: endpoint.description,
    parameters: endpoint.parameters,
    requestBody: endpoint.requestBody,
    responses: endpoint.responses,
  });
}

function brief(endpoint) {
  return { method: endpoint.method, path: endpoint.path, summary: endpoint.summary };
}

/**
 * Diff the new index against the previous generated file and prepend a dated
 * entry to the changelog. Returns a summary string for the console, or null
 * when nothing changed.
 */
async function updateChangelog(data) {
  let previous = null;
  try {
    previous = JSON.parse(await readFile(OUT_FILE, "utf8"));
  } catch {
    // No previous file — this sync establishes the baseline.
  }

  let changelog = [];
  try {
    changelog = JSON.parse(await readFile(CHANGELOG_FILE, "utf8"));
    if (!Array.isArray(changelog)) changelog = [];
  } catch {
    changelog = [];
  }

  const next = endpointMap(data);

  if (!previous) {
    changelog.unshift({
      date: data.generatedAt,
      version: data.version,
      baseline: true,
      added: [...next.values()].map(brief),
      removed: [],
      changed: [],
    });
    await writeFile(CHANGELOG_FILE, JSON.stringify(changelog, null, 2) + "\n", "utf8");
    return `baseline (${next.size} endpoints)`;
  }

  const prev = endpointMap(previous);
  const added = [];
  const removed = [];
  const changed = [];

  for (const [key, endpoint] of next) {
    if (!prev.has(key)) {
      added.push(brief(endpoint));
    } else if (fingerprint(prev.get(key)) !== fingerprint(endpoint)) {
      changed.push(brief(endpoint));
    }
  }
  for (const [key, endpoint] of prev) {
    if (!next.has(key)) removed.push(brief(endpoint));
  }

  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    return null;
  }

  changelog.unshift({
    date: data.generatedAt,
    version: data.version,
    baseline: false,
    added,
    removed,
    changed,
  });
  await writeFile(CHANGELOG_FILE, JSON.stringify(changelog, null, 2) + "\n", "utf8");
  return `+${added.length} ~${changed.length} -${removed.length}`;
}

async function main() {
  const source = process.argv[2] ?? DEFAULT_URL;
  console.log(`Syncing OpenAPI spec from ${source}`);

  const spec = await loadSpec(source);
  const data = transform(spec);

  const changelogSummary = await updateChangelog(data);

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(data, null, 2) + "\n", "utf8");

  const total = data.groups.reduce((n, g) => n + g.endpoints.length, 0);
  console.log(`\n${data.title} ${data.version}`);
  for (const group of data.groups) {
    console.log(`  ${group.tag.padEnd(14)} ${group.endpoints.length} endpoint(s)`);
  }
  console.log(`\nWrote ${total} endpoints → ${OUT_FILE}`);
  console.log(
    changelogSummary
      ? `Changelog updated: ${changelogSummary}`
      : "Changelog unchanged (no endpoint differences)",
  );
}

main().catch((error) => {
  console.error(`\nSync failed: ${error.message}`);
  console.error(
    "Is the backend running? Start it, or pass a saved spec: npm run sync -- openapi.json",
  );
  process.exit(1);
});
