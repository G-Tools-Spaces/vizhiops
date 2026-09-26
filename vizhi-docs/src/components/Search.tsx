"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { BookOpen, FileText, Search } from "lucide-react";
import { openApiIndex, TAG_META } from "@/lib/openapi";

/**
 * Cmd+K search across every docs page and every API endpoint.
 *
 * The index is built at module load from the generated OpenAPI file, so it
 * stays in step with the backend every time `npm run sync` runs.
 */

type PageEntry = {
  kind: "page";
  label: string;
  href: string;
  section: string;
  keywords: string[];
};

type EndpointEntry = {
  kind: "endpoint";
  label: string;
  method: string;
  href: string;
  section: string;
  keywords: string[];
};

type Entry = PageEntry | EndpointEntry;

const PAGES: PageEntry[] = [
  { kind: "page", label: "Overview", href: "/docs", section: "Getting started", keywords: ["home", "intro"] },
  { kind: "page", label: "Quickstart", href: "/docs/quickstart", section: "Getting started", keywords: ["start", "first call", "setup"] },
  { kind: "page", label: "Authentication", href: "/docs/authentication", section: "Getting started", keywords: ["auth", "api key", "token", "login"] },
  { kind: "page", label: "Chat completions", href: "/docs/chat", section: "Core resources", keywords: ["chat", "completion", "llm", "message"] },
  { kind: "page", label: "Model tokens", href: "/docs/models", section: "Core resources", keywords: ["model", "token", "provider", "connect"] },
  { kind: "page", label: "Agents", href: "/docs/agents", section: "Core resources", keywords: ["agent", "identity", "budget"] },
  { kind: "page", label: "Agent queue", href: "/docs/agent-queue", section: "Core resources", keywords: ["queue", "websocket", "task"] },
  { kind: "page", label: "Queries", href: "/docs/queries", section: "Observability", keywords: ["query", "trace", "request", "log"] },
  { kind: "page", label: "Metrics", href: "/docs/metrics", section: "Observability", keywords: ["metrics", "usage", "tokens", "latency"] },
  { kind: "page", label: "Dashboard", href: "/docs/dashboard", section: "Observability", keywords: ["dashboard", "overview", "totals"] },
  { kind: "page", label: "Provider health", href: "/docs/health", section: "Observability", keywords: ["health", "provider", "status", "uptime"] },
  { kind: "page", label: "Endpoint index", href: "/docs/reference", section: "Reference", keywords: ["reference", "index", "all endpoints"] },
  { kind: "page", label: "Errors", href: "/docs/errors", section: "Reference", keywords: ["error", "status code", "problem"] },
  { kind: "page", label: "Changelog", href: "/docs/changelog", section: "Reference", keywords: ["changelog", "changes", "news", "version"] },
];

function buildEndpointIndex(): EndpointEntry[] {
  return openApiIndex.groups.flatMap((group) => {
    const meta = TAG_META[group.tag];
    const href = meta?.href ?? "/docs/reference";
    return group.endpoints.map((endpoint) => ({
      kind: "endpoint" as const,
      label: `${endpoint.method} ${endpoint.path}`,
      method: endpoint.method,
      href,
      section: meta?.title ?? group.tag,
      keywords: [
        endpoint.method,
        endpoint.path,
        endpoint.summary,
        endpoint.operationId,
        group.tag,
      ].filter(Boolean),
    }));
  });
}

const METHOD_COLOR: Record<string, string> = {
  GET: "text-info",
  POST: "text-ok",
  PATCH: "text-warn",
  DELETE: "text-danger",
};

export function DocsSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-[34px] items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-xs text-ink-tertiary transition-colors hover:bg-surface-strong hover:text-ink-secondary"
      >
        <Search className="size-3.5" />
        <span className="hidden sm:inline">Search docs…</span>
        <kbd className="hidden rounded border border-line bg-panel px-1 py-px text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </button>
      {open ? <SearchPalette onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SearchPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const endpoints = useMemo(buildEndpointIndex, []);

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[16vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <Command label="Search documentation" loop>
          <div className="flex items-center gap-2.5 border-b border-line px-3.5">
            <Search className="size-4 shrink-0 text-ink-tertiary" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              onKeyDown={(event) => {
                if (event.key === "Escape") onClose();
              }}
              placeholder="Search pages and endpoints…"
              className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-tertiary"
            />
            <kbd className="shrink-0 rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-tertiary">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-10 text-center text-sm text-ink-tertiary">
              No results for &ldquo;{query}&rdquo;
            </Command.Empty>

            <Command.Group heading={<GroupHeading>Pages</GroupHeading>}>
              {PAGES.map((page) => (
                <Command.Item
                  key={page.href}
                  value={page.label}
                  keywords={page.keywords}
                  onSelect={() => go(page.href)}
                  className="flex h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm text-ink-secondary transition-colors aria-selected:bg-accent-soft aria-selected:text-accent"
                >
                  <FileText className="size-4 shrink-0" />
                  <span className="truncate">{page.label}</span>
                  <span className="ml-auto shrink-0 text-xs text-ink-tertiary">{page.section}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading={<GroupHeading>Endpoints</GroupHeading>}>
              {endpoints.map((endpoint) => (
                <Command.Item
                  key={`${endpoint.method} ${endpoint.label}`}
                  value={endpoint.label}
                  keywords={endpoint.keywords}
                  onSelect={() => go(endpoint.href)}
                  className="flex h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm text-ink-secondary transition-colors aria-selected:bg-accent-soft aria-selected:text-accent"
                >
                  <span
                    className={`w-14 shrink-0 font-mono text-[11px] font-semibold ${METHOD_COLOR[endpoint.method] ?? "text-ink-tertiary"}`}
                  >
                    {endpoint.method}
                  </span>
                  <span className="truncate font-mono text-xs">{endpoint.label.slice(endpoint.method.length + 1)}</span>
                  <span className="ml-auto shrink-0 text-xs text-ink-tertiary">{endpoint.section}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>

          <div className="flex items-center gap-4 border-t border-line px-3.5 py-2 text-[11px] text-ink-tertiary">
            <span className="flex items-center gap-1">
              <BookOpen className="size-3" />
              {PAGES.length} pages · {endpoints.length} endpoints
            </span>
            <span className="ml-auto">
              <kbd className="font-medium">↑↓</kbd> navigate · <kbd className="font-medium">↵</kbd> open
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
      {children}
    </p>
  );
}
