"use client";

import { useParams } from "next/navigation";
import { Activity, Bot, Clock, KeyRound, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTrace } from "@/lib/api/queries";
import { agents, modelConnections } from "@/lib/mock-data";

export default function TracePage() {
  const params = useParams<{ id: string }>();
  const { data: trace } = useTrace(params.id);
  const agent = agents.find((item) => item.id === trace?.agentId);
  const model = modelConnections.find((item) => item.id === trace?.modelId);

  if (!trace) {
    return null;
  }

  return (
    <>
      <PageHeader title="Request Trace" description="Single request lifecycle with request metadata, prompt preview, completion preview, token breakdown, latency, agent identity, and model identity." />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Request" value={trace.id} hint={new Date(trace.timestamp).toLocaleString()} icon={Activity} />
        <MetricCard label="Agent" value={agent?.name ?? "Unknown"} hint={agent?.cid ?? "No CID"} icon={Bot} />
        <MetricCard label="Model" value={model?.modelName ?? "Unknown"} hint={model?.provider ?? "Provider"} icon={KeyRound} />
        <MetricCard label="Latency" value={`${trace.latencyMs}ms`} hint={trace.endpoint} icon={Clock} />
        <MetricCard label="Tokens" value={`${trace.inputTokens + trace.outputTokens}`} hint={`${trace.inputTokens} in / ${trace.outputTokens} out`} icon={Layers} />
      </section>
      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Metadata</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4"><span className="text-[var(--muted)]">Status</span><StatusBadge status={trace.status < 300 ? "active" : "error"} /></div>
            <div className="flex justify-between gap-4"><span className="text-[var(--muted)]">Endpoint</span><span className="font-mono text-xs">{trace.endpoint}</span></div>
            <div className="flex justify-between gap-4"><span className="text-[var(--muted)]">Estimated Cost</span><span>${trace.estimatedCost.toFixed(2)}</span></div>
            {trace.errorMessage ? <p className="rounded-md border border-red-400/20 bg-red-400/10 p-3 text-red-100">{trace.errorMessage}</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Prompt Preview</CardTitle></CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md bg-black/30 p-4 font-mono text-xs text-zinc-300">Summarize the latest source material, cite uncertainty, and return a structured response for the calling agent.</pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Completion Preview</CardTitle></CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md bg-black/30 p-4 font-mono text-xs text-zinc-300">The request completed successfully. Token usage and model attribution were recorded by Vizhi for monitoring.</pre>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
