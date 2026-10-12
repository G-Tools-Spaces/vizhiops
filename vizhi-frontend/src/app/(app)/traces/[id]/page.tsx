"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Activity, Bot, Clock, Copy, DollarSign, KeyRound, Layers, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAgents, useModels, useTrace } from "@/lib/api/queries";
import type { RequestEvent } from "@/types/domain";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function buildCurl(trace: RequestEvent): string {
  const messages = (trace.prompt ?? []).map((m) => ({ role: m.role, content: m.content }));
  const body = JSON.stringify(
    { model: trace.modelId, ...(messages.length > 0 ? { messages } : {}) },
    null,
    2,
  );
  return [
    `curl -X POST "${BACKEND_URL}${trace.endpoint}" \\`,
    `  -H "Authorization: Bearer <your-agent-api-key>" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${body}'`,
  ].join("\n");
}

export default function TracePage() {
  const params = useParams<{ id: string }>();
  const { data: trace } = useTrace(params.id);
  const { data: agents = [] } = useAgents();
  const { data: models = [] } = useModels();

  // trace.agentId holds the agent CID; trace.modelId holds the raw model name.
  const agent = agents.find((a) => a.cid === trace?.agentId);
  const model = models.find((m) => m.modelName === trace?.modelId);

  // Mark "inspect a trace" done for the onboarding checklist.
  useEffect(() => {
    if (trace) localStorage.setItem("vizhi_trace_viewed", "1");
  }, [trace]);

  if (!trace) return null;

  const totalTokens = trace.inputTokens + trace.outputTokens;
  const ok = trace.status < 300;

  async function copyCurl() {
    try {
      await navigator.clipboard.writeText(buildCurl(trace!));
      toast.success("Copied as cURL", { description: "Replace <your-agent-api-key> with a live agent key." });
    } catch {
      toast.error("Could not access the clipboard");
    }
  }

  return (
    <>
      <PageHeader
        title="Request Trace"
        description="Single request lifecycle — full request and response, token and cost breakdown, latency, and identity."
        action={
          <Button variant="secondary" size="sm" onClick={copyCurl}>
            <Terminal className="h-4 w-4" />
            Copy as cURL
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Status" value={String(trace.status)} hint={ok ? "Success" : "Failed"} icon={Activity} />
        <MetricCard label="Latency" value={`${trace.latencyMs}ms`} hint={trace.endpoint} icon={Clock} />
        <MetricCard label="Tokens" value={String(totalTokens)} hint={`${trace.inputTokens} in / ${trace.outputTokens} out`} icon={Layers} />
        <MetricCard label="Cost" value={`$${trace.estimatedCost.toFixed(4)}`} hint="Estimated" icon={DollarSign} />
        <MetricCard label="Agent" value={agent?.name ?? trace.agentId} hint={agent ? agent.cid : "Unknown agent"} icon={Bot} />
      </section>

      {trace.errorMessage ? (
        <p className="mt-4 rounded-md border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
          {trace.errorMessage}
        </p>
      ) : null}

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Metadata</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4"><span className="text-[var(--ink-tertiary)]">Request ID</span><span className="font-mono text-xs">{trace.id}</span></div>
            <div className="flex justify-between gap-4"><span className="text-[var(--ink-tertiary)]">Timestamp</span><span className="text-xs">{new Date(trace.timestamp).toLocaleString()}</span></div>
            <div className="flex justify-between gap-4"><span className="text-[var(--ink-tertiary)]">Status</span><StatusBadge status={ok ? "active" : "error"} /></div>
            <div className="flex justify-between gap-4"><span className="text-[var(--ink-tertiary)]">Endpoint</span><span className="font-mono text-xs">{trace.endpoint}</span></div>
            <div className="flex justify-between gap-4"><span className="text-[var(--ink-tertiary)]">Model</span><span className="text-xs">{model?.modelName ?? trace.modelId}{model ? ` · ${model.provider}` : ""}</span></div>
            <div className="flex justify-between gap-4"><span className="text-[var(--ink-tertiary)]">Agent CID</span><span className="font-mono text-xs">{trace.agentId}</span></div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Request</CardTitle>
            <Button variant="ghost" size="sm" onClick={copyCurl}>
              <Copy className="h-3.5 w-3.5" />
              cURL
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {trace.prompt && trace.prompt.length > 0 ? (
              trace.prompt.map((message, index) => (
                <div key={index} className="rounded-md bg-[var(--surface)] p-3">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--accent)]">
                    {message.role}
                  </p>
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[var(--ink-secondary)]">
                    {message.content}
                  </pre>
                </div>
              ))
            ) : (
              <p className="rounded-md bg-[var(--surface)] p-4 text-xs text-[var(--ink-tertiary)]">
                No prompt payload was recorded for this request.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader><CardTitle>Response</CardTitle></CardHeader>
          <CardContent>
            {trace.responseText ? (
              <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md bg-[var(--surface)] p-4 font-mono text-xs leading-relaxed text-[var(--ink-secondary)]">
                {trace.responseText}
              </pre>
            ) : (
              <p className="rounded-md bg-[var(--surface)] p-4 text-xs text-[var(--ink-tertiary)]">
                No response body was recorded for this request.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" />Replay</CardTitle></CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-[var(--surface)] p-4 font-mono text-xs leading-relaxed text-[var(--ink-secondary)]">
              {buildCurl(trace)}
            </pre>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
