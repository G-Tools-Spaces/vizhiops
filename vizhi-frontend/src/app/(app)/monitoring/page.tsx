"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Clock,
  DollarSign,
  Gauge,
  Layers,
  TrendingUp,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { RequestTimeline, TokenTimeline } from "@/components/shared/chart-panel";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/field";
import { useAgents, useMetrics, useModels } from "@/lib/api/queries";
import { useUiStore } from "@/stores/ui-store";
import { formatCurrency, formatNumber } from "@/lib/utils";

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

  const requests = data?.requests ?? [];
  const totalRequests = (data?.metricSeries ?? []).reduce((sum, point) => sum + point.requests, 0);
  const totalErrors = (data?.metricSeries ?? []).reduce((sum, point) => sum + point.errors, 0);
  const totalTokens = (data?.metricSeries ?? []).reduce(
    (sum, point) => sum + point.inputTokens + point.outputTokens,
    0
  );
  const nonEmptyBuckets = (data?.metricSeries ?? []).filter((p) => p.requests > 0);
  const avgLatency = Math.round(
    nonEmptyBuckets.reduce((sum, point) => sum + point.latency, 0) /
      Math.max(nonEmptyBuckets.length, 1)
  );
  // Compute cost from actual request list for accuracy
  const cost = requests.reduce((sum, r) => sum + (r.estimatedCost ?? 0), 0);

  // Resolve agent name: request.agentId holds the agent CID — match on agent.cid
  const agentByCid = (cid: string) => agents.find((a) => a.cid === cid)?.name ?? cid;

  // Derive unique providers from the fetched models for the provider dropdown
  const providers = Array.from(new Set(models.map((m) => m.provider)));

  return (
    <>
      <PageHeader
        title="Monitoring"
        description="Deep observability for requests, latency, token consumption, provider distribution, errors, agent analytics, and model analytics."
      />

      {/* Filter Bar */}
      <section className="mb-6 grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 md:grid-cols-5">
        <div className="space-y-2">
          <Label>Time Range</Label>
          <Select
            value={store.timeRange}
            onChange={(e) => store.setTimeRange(e.target.value as typeof store.timeRange)}
          >
            <option value="1h">Last hour</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Agent</Label>
          <Select
            value={store.selectedAgentId}
            onChange={(e) => store.setSelectedAgentId(e.target.value)}
          >
            <option value="all">All agents</option>
            {agents.map((agent) => (
              <option key={agent.cid} value={agent.cid}>
                {agent.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Model</Label>
          <Select
            value={store.selectedModelId}
            onChange={(e) => store.setSelectedModelId(e.target.value)}
          >
            <option value="all">All models</option>
            {models.map((model) => (
              <option key={model.id} value={model.modelName}>
                {model.modelName}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select defaultValue="all">
            <option value="all">All providers</option>
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label>CID</Label>
          <Select defaultValue="all">
            <option value="all">All CIDs</option>
            {agents.map((agent) => (
              <option key={agent.cid} value={agent.cid}>
                {agent.cid}
              </option>
            ))}
          </Select>
        </div>
      </section>

      {/* Metric Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Requests" value={formatNumber(totalRequests)} hint="Gateway traffic" icon={Activity} />
        <MetricCard
          label="Success Rate"
          value={`${Math.round((1 - totalErrors / Math.max(totalRequests, 1)) * 100)}%`}
          hint="2xx responses"
          icon={TrendingUp}
        />
        <MetricCard
          label="Failure Rate"
          value={`${Math.round((totalErrors / Math.max(totalRequests, 1)) * 100)}%`}
          hint="4xx and 5xx"
          icon={AlertTriangle}
        />
        <MetricCard label="Latency" value={`${avgLatency}ms`} hint="Mean response time" icon={Clock} />
        <MetricCard label="Tokens" value={formatNumber(totalTokens)} hint="Input + output" icon={Layers} />
        <MetricCard label="Cost" value={formatCurrency(cost)} hint="Estimated" icon={DollarSign} />
      </section>

      {/* Charts */}
      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <RequestTimeline data={data?.metricSeries ?? []} />
        <TokenTimeline data={data?.metricSeries ?? []} />
      </section>

      {/* Request History — rich query cards like model tokens page */}
      <section className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Request History</h2>
        {requests.length === 0 ? (
          <Card className="p-8 text-center text-[var(--muted)]">
            No requests found for the selected filters.
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <Card
                key={request.id}
                className="p-4 border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
              >
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="text-xs font-mono text-[var(--muted)]">{request.id}</span>
                      <StatusBadge status={request.status < 300 ? "active" : "error"} />
                      <span className="text-xs text-[var(--muted)]">
                        {new Date(request.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
                      <span>
                        <span className="font-semibold">Agent:</span>{" "}
                        {agentByCid(request.agentId)}
                      </span>
                      <span>
                        <span className="font-semibold">Model:</span> {request.modelId}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Gauge className="h-3 w-3" />
                        {request.latencyMs}ms
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="text-sm font-semibold text-[var(--foreground)]">
                      ${(request.estimatedCost ?? 0).toFixed(4)}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {formatNumber(request.inputTokens + request.outputTokens)} tokens
                    </div>
                    <Button size="sm" className="mt-2">
                      <Link href={`/traces/${request.id}`}>View Trace</Link>
                    </Button>
                  </div>
                </div>

                {/* Prompt */}
                <div className="mb-3">
                  <div className="text-xs font-semibold text-[var(--muted)] mb-1">PROMPT:</div>
                  <div className="bg-[var(--background-secondary,#1a1a2e)] rounded p-3 text-sm max-h-32 overflow-y-auto">
                    {(request.prompt ?? []).length > 0 ? (
                      (request.prompt ?? []).map((msg, idx) => (
                        <div key={idx} className="mb-2 last:mb-0">
                          <span className="font-semibold text-[var(--primary)]">{msg.role}:</span>{" "}
                          <span className="text-[var(--foreground)]">{msg.content}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-[var(--muted)]">No prompt data</span>
                    )}
                  </div>
                </div>

                {/* Response */}
                <div className="mb-3">
                  <div className="text-xs font-semibold text-[var(--muted)] mb-1">RESPONSE:</div>
                  <div className="bg-[var(--background-secondary,#1a1a2e)] rounded p-3 text-sm max-h-32 overflow-y-auto">
                    {request.errorMessage ? (
                      <span className="text-[var(--danger,#f87171)]">{request.errorMessage}</span>
                    ) : request.responseText ? (
                      <span className="text-[var(--foreground)]">{request.responseText}</span>
                    ) : (
                      <span className="text-[var(--muted)]">No response data</span>
                    )}
                  </div>
                </div>

                {/* Token breakdown */}
                <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
                  {request.status < 300 ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-[var(--danger,#f87171)]" />
                  )}
                  <span>
                    <span className="font-semibold">Input:</span>{" "}
                    {formatNumber(request.inputTokens)} tokens
                  </span>
                  <span>
                    <span className="font-semibold">Output:</span>{" "}
                    {formatNumber(request.outputTokens)} tokens
                  </span>
                  <span>
                    <span className="font-semibold">Total:</span>{" "}
                    {formatNumber(request.inputTokens + request.outputTokens)} tokens
                  </span>
                  <span className="font-mono text-xs text-[var(--muted)]">{request.endpoint}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
