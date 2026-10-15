"use client";

import Link from "next/link";
import { Activity, AlertTriangle, Bot, Cpu, KeyRound, Layers } from "lucide-react";
import { RequestTimeline, TokenTimeline } from "@/components/shared/chart-panel";
import { DataTable } from "@/components/shared/data-table";
import { KpiGrid, MetricCard } from "@/components/shared/metric-card";
import { OnboardingChecklist } from "@/components/shared/onboarding-checklist";
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
      <PageHeader
        title="Dashboard"
        description="Model access, agent usage, token consumption, failures and live request flow at a glance."
      />
      <OnboardingChecklist />
      <KpiGrid>
        <MetricCard label="Agents" value={String(totals?.agents ?? 0)} hint="Observable identities" icon={Bot} />
        <MetricCard label="Model tokens" value={String(totals?.modelTokens ?? 0)} hint="Reusable LLM access" icon={KeyRound} />
        <MetricCard label="Requests today" value={formatNumber(totals?.requestsToday ?? 0)} hint="Refreshes every 30s" icon={Activity} />
        <MetricCard label="Tokens" value={formatNumber(totals?.tokensConsumed ?? 0)} hint="Input + output" icon={Layers} />
        <MetricCard
          label="Errors"
          value={String(totals?.errors ?? 0)}
          hint="Provider and gateway"
          icon={AlertTriangle}
          tone={(totals?.errors ?? 0) > 0 ? "danger" : undefined}
        />
        <MetricCard label="Active models" value={String(totals?.activeModels ?? 0)} hint="Available for linking" icon={Cpu} />
      </KpiGrid>
      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <RequestTimeline data={data?.metricSeries ?? []} />
        <TokenTimeline data={data?.metricSeries ?? []} />
      </section>
      <section className="mt-6">
        <DataTable
          title="Recent requests"
          tableId="dashboard-requests"
          emptyMessage="No requests yet. Send one from the Playground."
          headers={["Request ID", "Agent", "Model", "Status", "Latency", "Cost"]}
          rows={(data?.recentRequests ?? []).map((request) => [
            <Link key="id" href={`/traces/${request.id}`} className="font-mono text-xs text-[var(--accent)] hover:text-[var(--accent-hover)]">
              {request.id}
            </Link>,
            agentByCid(request.agentId),
            modelByName(request.modelId),
            request.status === 0 ? (
              <StatusBadge key="status" status="archived" label="No response" />
            ) : (
              <StatusBadge key="status" status={request.status < 300 ? "active" : "error"} label={String(request.status)} />
            ),
            `${request.latencyMs}ms`,
            `$${(request.estimatedCost ?? 0).toFixed(4)}`,
          ])}
        />
      </section>
    </>
  );
}
