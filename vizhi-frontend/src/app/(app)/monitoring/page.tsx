"use client";

import Link from "next/link";
import { Activity, AlertTriangle, Clock, DollarSign, Layers, TrendingUp } from "lucide-react";
import { RequestTimeline, TokenTimeline } from "@/components/shared/chart-panel";
import { DataTable } from "@/components/shared/data-table";
import { KpiGrid, MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Label, Select } from "@/components/ui/field";
import { useAgents, useMetrics, useModels } from "@/lib/api/queries";
import { useUiStore } from "@/stores/ui-store";
import { cn, formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";

const RANGES = [
  { id: "1h", label: "1h" },
  { id: "24h", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
] as const;

export default function MonitoringPage() {
  const store = useUiStore();
  const { data: agents = [] } = useAgents();
  const { data: models = [] } = useModels();

  // Pass all active filters to the metrics query so the backend filters correctly
  const { data } = useMetrics({
    timeRange: store.timeRange,
    agentId: store.selectedAgentId,
    modelId: store.selectedModelId,
  });

  const series = data?.metricSeries ?? [];
  const requests = data?.requests ?? [];
  const totalRequests = series.reduce((sum, point) => sum + point.requests, 0);
  const totalErrors = series.reduce((sum, point) => sum + point.errors, 0);
  const totalTokens = series.reduce((sum, point) => sum + point.inputTokens + point.outputTokens, 0);
  const nonEmptyBuckets = series.filter((p) => p.requests > 0);
  const avgLatency = Math.round(
    nonEmptyBuckets.reduce((sum, point) => sum + point.latency, 0) / Math.max(nonEmptyBuckets.length, 1),
  );
  // Compute cost from actual request list for accuracy
  const cost = requests.reduce((sum, r) => sum + (r.estimatedCost ?? 0), 0);
  const failureRate = Math.round((totalErrors / Math.max(totalRequests, 1)) * 100);

  // request.agentId holds the agent CID — match on agent.cid
  const agentByCid = (cid: string) => agents.find((a) => a.cid === cid)?.name ?? cid;
  // Unique model names: several tokens can point at the same model.
  const modelNames = Array.from(new Set(models.map((m) => m.modelName)));

  return (
    <>
      <PageHeader
        title="Monitoring"
        description="Requests, latency, tokens, cost and errors — filter by time, agent and model."
      />

      {/* Filters */}
      <section className="mb-6 flex flex-wrap items-end gap-4 border border-[var(--line)] bg-[var(--panel)] px-[18px] py-3.5">
        <div className="space-y-1.5">
          <Label>Time range</Label>
          <div role="group" aria-label="Time range" className="flex border border-[var(--line-strong)]">
            {RANGES.map((range, i) => (
              <button
                key={range.id}
                type="button"
                aria-pressed={store.timeRange === range.id}
                onClick={() => store.setTimeRange(range.id)}
                className={cn(
                  "h-[34px] px-3.5 text-xs font-semibold transition-colors",
                  i > 0 && "border-l border-[var(--line-strong)]",
                  store.timeRange === range.id
                    ? "bg-[var(--chip)] text-[var(--ink)]"
                    : "bg-[var(--surface)] text-[var(--ink-tertiary)] hover:text-[var(--ink)]",
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-52 flex-1 space-y-1.5 sm:max-w-64">
          <Label>Agent</Label>
          <Select value={store.selectedAgentId} onChange={(e) => store.setSelectedAgentId(e.target.value)}>
            <option value="all">All agents</option>
            {agents.map((agent) => (
              <option key={agent.cid} value={agent.cid}>
                {agent.name} · {agent.cid}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-52 flex-1 space-y-1.5 sm:max-w-64">
          <Label>Model</Label>
          <Select value={store.selectedModelId} onChange={(e) => store.setSelectedModelId(e.target.value)}>
            <option value="all">All models</option>
            {modelNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>
      </section>

      <KpiGrid>
        <MetricCard label="Requests" value={formatNumber(totalRequests)} hint="Gateway traffic" icon={Activity} />
        <MetricCard label="Success rate" value={`${100 - failureRate}%`} hint="2xx responses" icon={TrendingUp} />
        <MetricCard
          label="Failure rate"
          value={`${failureRate}%`}
          hint="4xx and 5xx"
          icon={AlertTriangle}
          tone={failureRate > 0 ? "danger" : undefined}
        />
        <MetricCard label="Avg latency" value={`${avgLatency}ms`} hint="Mean response time" icon={Clock} />
        <MetricCard label="Tokens" value={formatNumber(totalTokens)} hint="Input + output" icon={Layers} />
        <MetricCard label="Cost" value={formatCurrency(cost)} hint="Estimated" icon={DollarSign} />
      </KpiGrid>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <RequestTimeline data={series} />
        <TokenTimeline data={series} />
      </section>

      <section className="mt-6">
        <DataTable
          title="Request history"
          tableId="monitoring-requests"
          emptyMessage="No requests for the selected filters."
          defaultHidden={["Endpoint", "Response"]}
          headers={[
            "Time",
            "Request ID",
            "Agent",
            "Model",
            "Status",
            "Latency",
            "Input",
            "Output",
            "Cost",
            "Endpoint",
            "Prompt",
            "Response",
          ]}
          rows={requests.map((request) => {
            const prompt = request.prompt ?? [];
            const lastUser = [...prompt].reverse().find((m) => m.role === "user") ?? prompt[prompt.length - 1];
            return [
              <span key="time" className="whitespace-nowrap font-mono text-xs text-[var(--ink-secondary)]">
                {formatDateTime(request.timestamp)}
              </span>,
              <Link
                key="id"
                href={`/traces/${request.id}`}
                className="font-mono text-xs text-[var(--accent)] hover:text-[var(--accent-hover)]"
              >
                {request.id}
              </Link>,
              agentByCid(request.agentId),
              request.modelId,
              request.status === 0 ? (
              <StatusBadge key="status" status="archived" label="No response" />
            ) : (
              <StatusBadge key="status" status={request.status < 300 ? "active" : "error"} label={String(request.status)} />
            ),
              `${request.latencyMs}ms`,
              formatNumber(request.inputTokens),
              formatNumber(request.outputTokens),
              `$${(request.estimatedCost ?? 0).toFixed(4)}`,
              <span key="endpoint" className="font-mono text-xs">{request.endpoint}</span>,
              <span key="prompt" className="block max-w-[280px] truncate" title={lastUser?.content}>
                {lastUser?.content ?? "—"}
              </span>,
              request.errorMessage ? (
                <span key="response" className="block max-w-[280px] truncate text-[var(--danger)]" title={request.errorMessage}>
                  {request.errorMessage}
                </span>
              ) : (
                <span key="response" className="block max-w-[280px] truncate" title={request.responseText}>
                  {request.responseText || "—"}
                </span>
              ),
            ];
          })}
        />
      </section>
    </>
  );
}
