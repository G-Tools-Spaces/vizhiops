"use client";

import { Activity, AlertTriangle, Bot, Cpu, KeyRound, Layers } from "lucide-react";
import { RequestTimeline, TokenTimeline } from "@/components/shared/chart-panel";
import { DataTable } from "@/components/shared/data-table";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAgents, useDashboard, useModels } from "@/lib/api/queries";
import { formatNumber } from "@/lib/utils";

export default function DashboardPage() {
  const { data } = useDashboard();
  const { data: agents = [] } = useAgents();
  const { data: models = [] } = useModels();
  const totals = data?.totals;

  // request.agentId holds the agent CID — match on agent.cid
  const agentByCid = (cid: string) => agents.find((a) => a.cid === cid)?.name ?? cid;
  // request.modelId holds the raw model name string — match on modelName
  const modelByName = (name: string) => models.find((m) => m.modelName === name)?.modelName ?? name;

  return (
    <>
      <PageHeader title="Dashboard" description="High-level observability across model access, agent usage, token consumption, failures, and live request flow." />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Total Agents" value={String(totals?.agents ?? 0)} hint="Observable identities" icon={Bot} />
        <MetricCard label="Model Tokens" value={String(totals?.modelTokens ?? 0)} hint="Reusable LLM access" icon={KeyRound} />
        <MetricCard label="Requests Today" value={formatNumber(totals?.requestsToday ?? 0)} hint="Polling every 30s" icon={Activity} />
        <MetricCard label="Tokens" value={formatNumber(totals?.tokensConsumed ?? 0)} hint="Input + output" icon={Layers} />
        <MetricCard label="Errors" value={String(totals?.errors ?? 0)} hint="Provider and gateway" icon={AlertTriangle} />
        <MetricCard label="Active Models" value={String(totals?.activeModels ?? 0)} hint="Available for linking" icon={Cpu} />
      </section>
      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <RequestTimeline data={data?.metricSeries ?? []} />
        <TokenTimeline data={data?.metricSeries ?? []} />
      </section>
      <section className="mt-6">
        <DataTable
          headers={["Request ID", "Agent", "Model", "Status", "Latency", "Cost"]}
          rows={(data?.recentRequests ?? []).map((request) => [
            <span className="font-mono text-xs" key="id">{request.id}</span>,
            agentByCid(request.agentId),
            modelByName(request.modelId),
            <StatusBadge key="status" status={request.status < 300 ? "active" : "error"} />,
            `${request.latencyMs}ms`,
            `$${(request.estimatedCost ?? 0).toFixed(4)}`,
          ])}
        />
      </section>
    </>
  );
}
