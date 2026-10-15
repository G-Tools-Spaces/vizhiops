"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle, Clock, DollarSign, Layers, TrendingUp } from "lucide-react";
import { Card, CardRow } from "@/components/ui/card";
import { DataTable } from "@/components/shared/data-table";
import { KpiGrid, MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useModelUsage } from "@/lib/api/queries";
import { formatDateTime, formatNumber } from "@/lib/utils";

export default function ModelUsageDetailPage() {
  const params = useParams();
  const modelId = params.id as string;
  const { data, isLoading, error } = useModelUsage(modelId);

  if (isLoading) {
    return <div className="py-24 text-center text-[13px] text-[var(--ink-tertiary)]">Loading model usage…</div>;
  }

  if (error || !data) {
    return (
      <div className="border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-[13px] text-[var(--danger)]">
        Failed to load model usage details.
      </div>
    );
  }

  const { modelConnection, stats, recentQueries } = data;

  return (
    <>
      <Link
        href="/models/tokens"
        className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-[var(--ink-secondary)] hover:text-[var(--ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Model tokens
      </Link>

      <PageHeader title={modelConnection.modelName} description={`Usage analytics for this ${modelConnection.provider} model token.`} />

      <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardRow label="Provider">{modelConnection.provider}</CardRow>
          <CardRow label="Status"><StatusBadge status={modelConnection.status} /></CardRow>
          <CardRow label="Token"><span className="font-mono text-xs">{modelConnection.maskedKey}</span></CardRow>
          <CardRow label="Created">{new Date(modelConnection.createdAt).toLocaleDateString()}</CardRow>
        </Card>

        <KpiGrid className="grid-cols-2 md:grid-cols-3">
          <MetricCard label="Requests" value={formatNumber(stats.totalRequests)} icon={TrendingUp} />
          <MetricCard
            label="Tokens"
            value={formatNumber(stats.totalTokens)}
            hint={`${formatNumber(stats.totalInputTokens)} in / ${formatNumber(stats.totalOutputTokens)} out`}
            icon={Layers}
          />
          <MetricCard label="Avg latency" value={`${stats.avgLatencyMs}ms`} icon={Clock} />
          <MetricCard label="Cost" value={`$${stats.totalCost.toFixed(4)}`} hint="Estimated" icon={DollarSign} />
          <MetricCard label="Success rate" value={`${stats.successRate}%`} icon={CheckCircle} tone="ok" />
          <MetricCard
            label="Errors"
            value={String(stats.errorCount)}
            icon={AlertCircle}
            tone={stats.errorCount > 0 ? "danger" : undefined}
          />
        </KpiGrid>
      </div>

      <section className="mt-6">
        <DataTable
          title="Recent queries"
          tableId="model-usage-queries"
          emptyMessage="No queries for this model yet."
          defaultHidden={["Response"]}
          headers={["Time", "Query ID", "Agent", "Status", "Latency", "Input", "Output", "Cost", "Prompt", "Response"]}
          rows={recentQueries.map((query) => {
            const lastUser = [...query.prompt].reverse().find((m) => m.role === "user") ?? query.prompt[query.prompt.length - 1];
            return [
              <span key="time" className="whitespace-nowrap font-mono text-xs text-[var(--ink-secondary)]">
                {formatDateTime(query.timestamp)}
              </span>,
              <Link
                key="id"
                href={`/traces/${query.queryId}`}
                className="font-mono text-xs text-[var(--accent)] hover:text-[var(--accent-hover)]"
              >
                {query.queryId}
              </Link>,
              <span key="agent" className="font-mono text-xs">{query.agentId}</span>,
              <StatusBadge key="status" status={query.statusCode < 400 ? "active" : "error"} label={String(query.statusCode)} />,
              `${query.latencyMs}ms`,
              formatNumber(query.inputTokens),
              formatNumber(query.outputTokens),
              `$${query.estimatedCost.toFixed(4)}`,
              <span key="prompt" className="block max-w-[280px] truncate" title={lastUser?.content}>
                {lastUser?.content ?? "—"}
              </span>,
              query.errorMessage ? (
                <span key="response" className="block max-w-[280px] truncate text-[var(--danger)]" title={query.errorMessage}>
                  {query.errorMessage}
                </span>
              ) : (
                <span key="response" className="block max-w-[280px] truncate" title={query.responseText}>
                  {query.responseText || "—"}
                </span>
              ),
            ];
          })}
        />
      </section>
    </>
  );
}
