"use client";

import { Activity, AlertTriangle, CheckCircle2, Gauge, RefreshCw, WifiOff } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { KpiGrid, MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { useProviderHealth, useRefreshProviderHealth } from "@/lib/api/queries";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────

type ProviderStatus = "operational" | "degraded" | "down" | "unknown" | "unconfigured";

interface ProviderHealthItem {
  provider: string;
  label: string;
  status: ProviderStatus;
  latencyMs: number;
  lastChecked: string;
  message: string;
  incidentCount: number;
}

// ── Status helpers ────────────────────────────────────────────────────────

const STATUS_META: Record<ProviderStatus, { label: string; badge: string; dot: string }> = {
  operational: { label: "Operational", badge: "border-[var(--ok-border)] text-[var(--ok)]", dot: "bg-[var(--ok)]" },
  degraded: { label: "Degraded", badge: "border-[var(--warn-border)] text-[var(--warn)]", dot: "bg-[var(--warn)]" },
  down: { label: "Down", badge: "border-[var(--danger-border)] text-[var(--danger)]", dot: "bg-[var(--danger)]" },
  unknown: { label: "Unknown", badge: "", dot: "bg-[var(--ink-tertiary)]" },
  unconfigured: { label: "Unconfigured", badge: "", dot: "bg-[var(--ink-tertiary)]" },
};

const OVERALL_META: Record<string, { label: string; dot: string; text: string }> = {
  operational: { label: "All systems operational", dot: "bg-[var(--ok)]", text: "text-[var(--ok)]" },
  degraded: { label: "Systems degraded", dot: "bg-[var(--warn)]", text: "text-[var(--warn)]" },
  partial_outage: { label: "Partial outage", dot: "bg-[var(--warn)]", text: "text-[var(--warn)]" },
  major_outage: { label: "Major outage", dot: "bg-[var(--danger)]", text: "text-[var(--danger)]" },
  unknown: { label: "Status unknown", dot: "bg-[var(--ink-tertiary)]", text: "text-[var(--ink-tertiary)]" },
};

// Local/Ollama shows a special "Not running" label when unconfigured
function statusMeta(item: ProviderHealthItem) {
  if (item.provider === "local" && item.status === "unconfigured") {
    return { ...STATUS_META.unconfigured, label: "Not running" };
  }
  return STATUS_META[item.status] ?? STATUS_META.unknown;
}

function relativeTime(isoString: string): string {
  if (!isoString) return "Never";
  const secs = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (secs < 5) return "Just now";
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

// Latency with an inline bar scaled 0–3000ms.
function Latency({ item }: { item: ProviderHealthItem }) {
  if (item.status === "unconfigured" || item.status === "unknown" || item.latencyMs === 0) return <>—</>;
  const pct = Math.min(100, Math.round((item.latencyMs / 3000) * 100));
  const color = item.latencyMs < 800 ? "bg-[var(--ok)]" : item.latencyMs < 2000 ? "bg-[var(--warn)]" : "bg-[var(--danger)]";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="hidden h-1 w-16 bg-[var(--line-soft)] sm:block">
        <span className={cn("block h-full", color)} style={{ width: `${pct}%` }} />
      </span>
      <span className="font-mono text-xs">{item.latencyMs}ms</span>
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function HealthStatusPage() {
  const { data, isLoading, isError } = useProviderHealth();
  const { mutate: refresh, isPending: isRefreshing } = useRefreshProviderHealth();
  const providers = (data?.providers ?? []) as ProviderHealthItem[];

  const count = (status: ProviderStatus) => providers.filter((p) => p.status === status).length;
  const measured = providers.filter((p) => p.latencyMs > 0);
  const avgLatency = measured.length
    ? Math.round(measured.reduce((s, p) => s + p.latencyMs, 0) / measured.length)
    : 0;
  const overall = data ? OVERALL_META[data.overallStatus] ?? OVERALL_META.unknown : null;

  return (
    <>
      <PageHeader
        title="Provider health"
        description="Live status of every connected AI provider, probed every 60 seconds."
        action={
          <Button onClick={() => refresh()} disabled={isRefreshing}>
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Refreshing…" : "Refresh now"}
          </Button>
        }
      />

      {isError ? (
        <div className="mb-6 border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-[13px] text-[var(--danger)]">
          Failed to load provider health. Make sure the backend is running.
        </div>
      ) : null}

      {overall && data ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-[var(--line)] bg-[var(--panel)] px-[18px] py-3.5">
          <span className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className={cn("absolute inline-flex h-full w-full animate-ping opacity-60", overall.dot)} />
              <span className={cn("relative inline-flex h-2.5 w-2.5", overall.dot)} />
            </span>
            <span className={cn("text-sm font-semibold", overall.text)}>{overall.label}</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs text-[var(--ink-tertiary)]">
            <Activity className="h-3 w-3" />
            Last checked {relativeTime(data.checkedAt)}
          </span>
        </div>
      ) : null}

      {data ? (
        <KpiGrid className="mb-6">
          <MetricCard label="Operational" value={String(count("operational"))} icon={CheckCircle2} tone="ok" />
          <MetricCard label="Degraded" value={String(count("degraded"))} icon={AlertTriangle} tone={count("degraded") ? "warn" : undefined} />
          <MetricCard label="Down" value={String(count("down"))} icon={WifiOff} tone={count("down") ? "danger" : undefined} />
          <MetricCard label="Avg latency" value={avgLatency ? `${avgLatency}ms` : "—"} icon={Gauge} />
        </KpiGrid>
      ) : null}

      <DataTable
        title="Providers"
        tableId="provider-health"
        defaultView="cards"
        emptyMessage={isLoading ? "Checking providers…" : "No providers configured."}
        headers={["Provider", "Status", "Latency", "Last checked", "Failures", "Message"]}
        rows={providers.map((item) => {
          const meta = statusMeta(item);
          return [
            <span key="provider" className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-[var(--line-strong)] bg-[var(--chip)] text-[11px] font-bold uppercase text-[var(--ink-2)]">
                {item.label.slice(0, 2)}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-[var(--ink)]">{item.label}</span>
                <span className="block font-mono text-[11px] font-normal text-[var(--ink-tertiary)]">{item.provider}</span>
              </span>
            </span>,
            <Badge key="status" className={meta.badge}>
              <span className={cn("h-1.5 w-1.5", meta.dot)} />
              {meta.label}
            </Badge>,
            <Latency key="latency" item={item} />,
            relativeTime(item.lastChecked),
            item.incidentCount > 0 ? (
              <span key="failures" className="text-[var(--danger)]">{item.incidentCount}</span>
            ) : (
              "0"
            ),
            <span key="message" className="block max-w-[320px] truncate text-[var(--ink-secondary)]" title={item.message}>
              {item.message || "—"}
            </span>,
          ];
        })}
      />

      <div className="mt-6 border border-[var(--line)] bg-[var(--panel)] px-[18px] py-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-tertiary)]">Status legend</p>
        <p>
          <strong className="text-[var(--ink)]">Operational</strong> — responded in under 3s with a non-5xx status ·{" "}
          <strong className="text-[var(--ink)]">Degraded</strong> — responded, but slower than 3s ·{" "}
          <strong className="text-[var(--ink)]">Down</strong> — 5xx or connection error ·{" "}
          <strong className="text-[var(--ink)]">Unconfigured</strong> — API key not set ·{" "}
          <strong className="text-[var(--ink)]">Not running</strong> — local Ollama is stopped; start it with{" "}
          <code className="border border-[var(--line)] bg-[var(--surface)] px-1 font-mono text-[var(--ink)]">ollama serve</code>.
        </p>
      </div>
    </>
  );
}
