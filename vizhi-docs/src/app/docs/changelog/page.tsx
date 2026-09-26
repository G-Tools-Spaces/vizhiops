import { DocHeader, P } from "@/components/docs";
import changelog from "@/lib/changelog.generated.json";

export const metadata = { title: "Changelog" };

/**
 * API changelog — rendered from `changelog.generated.json`, which
 * `npm run sync` maintains by diffing the backend's OpenAPI spec against
 * the previously generated one. Newest first.
 */

type EndpointBrief = { method: string; path: string; summary: string };

type ChangelogEntry = {
  date: string;
  version: string;
  baseline: boolean;
  added: EndpointBrief[];
  removed: EndpointBrief[];
  changed: EndpointBrief[];
};

const entries = changelog as ChangelogEntry[];

const METHOD_COLOR: Record<string, string> = {
  GET: "text-info",
  POST: "text-ok",
  PATCH: "text-warn",
  DELETE: "text-danger",
};

function EndpointLine({ endpoint }: { endpoint: EndpointBrief }) {
  return (
    <li className="flex items-baseline gap-2.5 py-1">
      <span
        className={`w-14 shrink-0 font-mono text-[11px] font-semibold ${METHOD_COLOR[endpoint.method] ?? "text-ink-tertiary"}`}
      >
        {endpoint.method}
      </span>
      <code className="font-mono text-xs text-ink">{endpoint.path}</code>
      {endpoint.summary ? (
        <span className="truncate text-xs text-ink-tertiary">— {endpoint.summary}</span>
      ) : null}
    </li>
  );
}

function Group({
  label,
  badge,
  tone,
  items,
}: {
  label: string;
  badge: string;
  tone: "ok" | "warn" | "danger";
  items: EndpointBrief[];
}) {
  if (items.length === 0) return null;
  const tones = {
    ok: "border-ok/20 bg-ok-soft text-ok",
    warn: "border-warn/20 bg-warn-soft text-warn",
    danger: "border-danger/20 bg-danger-soft text-danger",
  } as const;
  return (
    <div className="mt-4">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-tertiary">
        <span className={`rounded-full border px-1.5 py-px font-mono text-[11px] ${tones[tone]}`}>
          {badge}
        </span>
        {label} ({items.length})
      </p>
      <ul className="mt-1 divide-y divide-line-soft">
        {items.map((item) => (
          <EndpointLine key={`${item.method} ${item.path}`} endpoint={item} />
        ))}
      </ul>
    </div>
  );
}

export default function ChangelogPage() {
  return (
    <>
      <DocHeader eyebrow="Reference" title="Changelog">
        Every change to the public API, generated automatically each time the
        spec is synced (<code className="font-mono text-[12.5px]">npm run sync</code>).
        Added endpoints, removed endpoints, and signature changes are diffed
        against the previous spec — nothing here is written by hand.
      </DocHeader>

      {entries.length === 0 ? (
        <P>No changes recorded yet. Run the sync after the next API change.</P>
      ) : (
        entries.map((entry) => (
          <section
            key={entry.date}
            className="mt-8 rounded-lg border border-line bg-panel p-4 first:mt-0"
          >
            <header className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
              <time className="text-sm font-medium text-ink">
                {new Date(entry.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              {entry.version ? (
                <span className="rounded border border-line bg-surface px-1.5 py-px font-mono text-[11px] text-ink-tertiary">
                  v{entry.version}
                </span>
              ) : null}
              {entry.baseline ? (
                <span className="rounded border border-accent/25 bg-accent-soft px-1.5 py-px text-[11px] font-medium text-accent">
                  Baseline
                </span>
              ) : null}
            </header>
            <Group label="Added" badge="+" tone="ok" items={entry.added} />
            <Group label="Changed" badge="~" tone="warn" items={entry.changed} />
            <Group label="Removed" badge="−" tone="danger" items={entry.removed} />
          </section>
        ))
      )}
    </>
  );
}
