"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  RefreshCw,
  Settings,
  WifiOff,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
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

const STATUS_META: Record<
  ProviderStatus,
  { label: string; color: string; bgColor: string; borderColor: string; Icon: React.FC<{ className?: string }> }
> = {
  operational: {
    label: "Operational",
    color: "text-[var(--ok)]",
    bgColor: "bg-[var(--ok-soft)]",
    borderColor: "border-[var(--ok)]/30",
    Icon: CheckCircle2,
  },
  degraded: {
    label: "Degraded",
    color: "text-[var(--warn)]",
    bgColor: "bg-[var(--warn-soft)]",
    borderColor: "border-[var(--warn)]/30",
    Icon: AlertTriangle,
  },
  down: {
    label: "Down",
    color: "text-[var(--danger)]",
    bgColor: "bg-[var(--danger-soft)]",
    borderColor: "border-[var(--danger)]/30",
    Icon: WifiOff,
  },
  unknown: {
    label: "Unknown",
    color: "text-[var(--ink-tertiary)]",
    bgColor: "bg-[var(--surface-strong)]",
    borderColor: "border-[var(--line)]",
    Icon: HelpCircle,
  },
  unconfigured: {
    label: "Unconfigured",
    color: "text-[var(--ink-tertiary)]",
    bgColor: "bg-[var(--surface-strong)]",
    borderColor: "border-[var(--line)]",
    Icon: Settings,
  },
};

const OVERALL_META: Record<
  string,
  { label: string; dotColor: string; textColor: string }
> = {
  operational: { label: "All Systems Operational", dotColor: "bg-[var(--ok)]", textColor: "text-[var(--ok)]" },
  degraded: { label: "Systems Degraded", dotColor: "bg-[var(--warn)]", textColor: "text-[var(--warn)]" },
  partial_outage: { label: "Partial Outage", dotColor: "bg-[var(--warn)]", textColor: "text-[var(--warn)]" },
  major_outage: { label: "Major Outage", dotColor: "bg-[var(--danger)]", textColor: "text-[var(--danger)]" },
  unknown: { label: "Status Unknown", dotColor: "bg-[var(--ink-tertiary)]", textColor: "text-[var(--ink-tertiary)]" },
};

// ── Provider logo placeholders (emoji fallback) ──────────────────────────

const PROVIDER_EMOJI: Record<string, string> = {
  openai: "🟢",
  anthropic: "🟣",
  gemini: "🔵",
  huggingface: "🟡",
  qwen: "🔷",
  local: "💻",
};

// Local/Ollama shows a special "Not Running" label when unconfigured
function getStatusMeta(item: ProviderHealthItem) {
  if (item.provider === "local" && item.status === "unconfigured") {
    return {
      label: "Not Running",
      color: "text-[var(--ink-tertiary)]",
      bgColor: "bg-[var(--surface-strong)]",
      borderColor: "border-[var(--line)]",
      Icon: WifiOff,
    };
  }
  return STATUS_META[item.status] ?? STATUS_META.unknown;
}

// ── Helper: format relative time ─────────────────────────────────────────

function relativeTime(isoString: string): string {
  if (!isoString) return "Never";
  const diff = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 5) return "Just now";
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

// ── Latency bar ──────────────────────────────────────────────────────────

function LatencyBar({ latencyMs, status }: { latencyMs: number; status: ProviderStatus }) {
  if (status === "unconfigured" || status === "unknown" || latencyMs === 0) return null;
  // Scale 0–3000ms visually; clamp at 100%
  const pct = Math.min(100, Math.round((latencyMs / 3000) * 100));
  const color =
    latencyMs < 800 ? "bg-[var(--ok)]" : latencyMs < 2000 ? "bg-[var(--warn)]" : "bg-[var(--danger)]";
  return (
    <div className="mt-2">
      <div className="mb-1 flex justify-between text-xs text-[var(--ink-tertiary)]">
        <span>Latency</span>
        <span>{latencyMs}ms</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-strong)]">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Provider Card ────────────────────────────────────────────────────────

function ProviderCard({ item }: { item: ProviderHealthItem }) {
  const meta = getStatusMeta(item);
  const { Icon } = meta;

  return (
    <div
      className={cn(
        "rounded-xl border p-5 transition-all duration-300",
        meta.bgColor,
        meta.borderColor
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>
            {PROVIDER_EMOJI[item.provider] ?? "🔲"}
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--ink)]">{item.label}</p>
            <p className="text-xs text-[var(--ink-tertiary)] capitalize">{item.provider}</p>
          </div>
        </div>
        {/* Status pill */}
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            meta.bgColor,
            meta.color
          )}
        >
          <Icon className="h-3 w-3" />
          {meta.label}
        </span>
      </div>

      {/* Latency bar */}
      <LatencyBar latencyMs={item.latencyMs} status={item.status} />

      {/* Message */}
      <p className="mt-3 line-clamp-2 text-xs text-[var(--ink-tertiary)]">{item.message}</p>

      {/* Footer row */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-[var(--ink-tertiary)]">
          <Clock className="h-3 w-3" />
          <span>{relativeTime(item.lastChecked)}</span>
        </div>
        {item.incidentCount > 0 && (
          <span className="rounded-full bg-[var(--danger-soft)] px-2 py-0.5 text-xs text-[var(--danger)]">
            {item.incidentCount} consecutive failure{item.incidentCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Overall Banner ───────────────────────────────────────────────────────

function OverallBanner({ status, checkedAt }: { status: string; checkedAt: string }) {
  const meta = OVERALL_META[status] ?? OVERALL_META.unknown;
  return (
    <div className="mb-6 flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-4">
      <div className="flex items-center gap-3">
        {/* Pulsing dot */}
        <span className="relative flex h-3 w-3">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              meta.dotColor
            )}
          />
          <span className={cn("relative inline-flex h-3 w-3 rounded-full", meta.dotColor)} />
        </span>
        <span className={cn("text-sm font-semibold", meta.textColor)}>{meta.label}</span>
      </div>
      <div className="flex items-center gap-1 text-xs text-[var(--ink-tertiary)]">
        <Activity className="h-3 w-3" />
        <span>Last checked {relativeTime(checkedAt)}</span>
      </div>
    </div>
  );
}

// ── Skeleton loader ──────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-[var(--surface-strong)]" />
          <div className="space-y-1.5">
            <div className="h-3 w-24 rounded bg-[var(--surface-strong)]" />
            <div className="h-2.5 w-16 rounded bg-[var(--surface-strong)]" />
          </div>
        </div>
        <div className="h-5 w-20 rounded-full bg-[var(--surface-strong)]" />
      </div>
      <div className="mt-4 h-1.5 w-full rounded-full bg-[var(--surface-strong)]" />
      <div className="mt-3 h-3 w-3/4 rounded bg-[var(--surface-strong)]" />
    </div>
  );
}

// ── Summary stats ────────────────────────────────────────────────────────

function SummaryStats({ providers }: { providers: ProviderHealthItem[] }) {
  const operational = providers.filter((p) => p.status === "operational").length;
  const degraded = providers.filter((p) => p.status === "degraded").length;
  const down = providers.filter((p) => p.status === "down").length;
  const avgLatency = (() => {
    const measured = providers.filter((p) => p.latencyMs > 0);
    if (!measured.length) return 0;
    return Math.round(measured.reduce((s, p) => s + p.latencyMs, 0) / measured.length);
  })();

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { label: "Operational", value: operational, color: "text-[var(--ok)]" },
        { label: "Degraded", value: degraded, color: "text-[var(--warn)]" },
        { label: "Down", value: down, color: "text-[var(--danger)]" },
        {
          label: "Avg Latency",
          value: avgLatency ? `${avgLatency}ms` : "—",
          color: "text-[var(--ink)]",
          icon: Zap,
        },
      ].map(({ label, value, color, icon: Icon }) => (
        <div
          key={label}
          className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3"
        >
          <p className="text-xs text-[var(--ink-tertiary)]">{label}</p>
          <p className={cn("mt-1 text-xl font-semibold", color)}>
            {Icon && <Icon className="mr-1 inline h-4 w-4" />}
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function HealthStatusPage() {
  const { data, isLoading, isError } = useProviderHealth();
  const { mutate: refresh, isPending: isRefreshing } = useRefreshProviderHealth();

  return (
    <>
      <PageHeader
        title="Provider Health"
        description="Real-time status of all connected AI providers. Probed every 60 seconds automatically."
        action={
          <button
            onClick={() => refresh()}
            disabled={isRefreshing}
            className={cn(
              "inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-1.5 text-sm text-[var(--ink)] transition hover:bg-[var(--surface-strong)] disabled:opacity-50"
            )}
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Refreshing…" : "Refresh Now"}
          </button>
        }
      />

      {/* Error state */}
      {isError && (
        <div className="mb-6 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-5 py-4 text-sm text-[var(--danger)]">
          Failed to load provider health. Make sure the backend is running.
        </div>
      )}

      {/* Overall banner */}
      {data && (
        <OverallBanner status={data.overallStatus} checkedAt={data.checkedAt} />
      )}

      {/* Summary stats */}
      {data && <SummaryStats providers={data.providers as ProviderHealthItem[]} />}

      {/* Provider grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : (data?.providers ?? []).map((item) => (
              <ProviderCard key={item.provider} item={item as ProviderHealthItem} />
            ))}
      </div>

      {/* Legend */}
      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--ink-tertiary)]">
          Status Legend
        </p>
        <div className="flex flex-wrap gap-4">
          {(Object.entries(STATUS_META) as [ProviderStatus, typeof STATUS_META[ProviderStatus]][]).map(
            ([key, m]) => {
              const { Icon } = m;
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <Icon className={cn("h-3.5 w-3.5", m.color)} />
                  <span className={cn("text-xs", m.color)}>{m.label}</span>
                </div>
              );
            }
          )}
        </div>
        <p className="mt-3 text-xs text-[var(--ink-secondary)]">
          <strong className="text-[var(--ink)]">Operational</strong> — endpoint responded in under 3 s with a non-5xx status. ·{" "}
          <strong className="text-[var(--ink)]">Degraded</strong> — responded but latency exceeded 3 000ms. ·{" "}
          <strong className="text-[var(--ink)]">Down</strong> — 5xx or connection error. ·{" "}
          <strong className="text-[var(--ink)]">Unconfigured</strong> — API key not set in .env. ·{" "}
          <strong className="text-[var(--ink)]">Not Running</strong> — Ollama server is not running locally. Start it with{" "}
          <code className="rounded bg-[var(--surface-strong)] px-1 py-0.5 text-[var(--ink)]">ollama serve</code>.
        </p>
      </div>
    </>
  );
}
