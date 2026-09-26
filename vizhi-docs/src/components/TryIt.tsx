"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";
import { highlight } from "@/lib/highlight";
import { useLocalStorage } from "@/lib/use-local-storage";

/**
 * "Try it" — run the documented call against the live gateway without
 * leaving the page. The reader's token is stored locally (never sent
 * anywhere except the API base URL) and shared across all Try-it blocks.
 */

const TOKEN_KEY = "vizhi_docs_token";

type TryItProps = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  /** Path including the /v1 prefix, e.g. "/v1/chat/completions". */
  path: string;
  /** JSON template shown in the body editor (POST/PATCH only). */
  body?: string;
};

type Result =
  | { kind: "response"; status: number; body: string; durationMs: number }
  | { kind: "error"; message: string };

export function TryIt({ method, path, body }: TryItProps) {
  const [token, setToken] = useLocalStorage(TOKEN_KEY);
  const [payload, setPayload] = useState(body ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const hasBody = method === "POST" || method === "PATCH";

  async function send() {
    setLoading(true);
    setResult(null);
    const started = performance.now();
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (hasBody) headers["Content-Type"] = "application/json";

      const response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: hasBody ? payload : undefined,
      });

      const text = await response.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // not JSON — show as-is
      }
      setResult({
        kind: "response",
        status: response.status,
        body: pretty,
        durationMs: Math.round(performance.now() - started),
      });
    } catch (error) {
      setResult({
        kind: "error",
        message:
          error instanceof TypeError
            ? `Could not reach ${API_BASE_URL} — is the backend running, and does CORS allow this origin?`
            : String(error),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <figure className="my-4 max-w-3xl overflow-hidden rounded-lg border border-accent/25">
      <figcaption className="flex flex-wrap items-center gap-2 border-b border-line bg-accent-soft px-3 py-2 text-xs">
        <span className="font-medium text-accent">Try it</span>
        <span className="font-mono text-ink-secondary">
          {method} {path}
        </span>
        <span className="ml-auto text-ink-tertiary">against {API_BASE_URL}</span>
      </figcaption>

      <div className="space-y-3 bg-panel p-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
            Bearer token
          </span>
          <input
            type="password"
            value={token ?? ""}
            onChange={(event) => setToken(event.target.value || null)}
            placeholder="vz_live_…"
            autoComplete="off"
            className="h-9 w-full rounded-md border border-line bg-surface px-2.5 font-mono text-xs text-ink outline-none placeholder:text-ink-tertiary focus:border-accent"
          />
        </label>

        {hasBody ? (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
              Request body
            </span>
            <textarea
              value={payload}
              onChange={(event) => setPayload(event.target.value)}
              rows={Math.min(14, Math.max(6, payload.split("\n").length + 1))}
              spellCheck={false}
              className="w-full rounded-md border border-line bg-surface p-2.5 font-mono text-xs leading-relaxed text-ink outline-none focus:border-accent"
            />
          </label>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={send}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-medium text-brand-ink transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            {loading ? "Sending…" : "Send request"}
          </button>
          {result?.kind === "response" ? (
            <span
              className={`rounded-full border px-1.5 py-px text-[11px] font-medium ${
                result.status < 300
                  ? "border-ok/20 bg-ok-soft text-ok"
                  : "border-danger/20 bg-danger-soft text-danger"
              }`}
            >
              {result.status} · {result.durationMs}ms
            </span>
          ) : null}
        </div>

        {result?.kind === "response" ? (
          <pre className="max-h-80 overflow-auto rounded-md border border-line bg-surface p-3 text-[12.5px] leading-relaxed">
            <code className="font-mono text-ink">{highlight(result.body, "json")}</code>
          </pre>
        ) : null}
        {result?.kind === "error" ? (
          <p className="rounded-md border border-danger/30 bg-danger-soft p-3 text-xs text-danger">
            {result.message}
          </p>
        ) : null}
      </div>
    </figure>
  );
}
