"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, ArrowLeft, Bot, Clock, Copy, DollarSign, Layers, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardRow, CardTitle } from "@/components/ui/card";
import { KpiGrid, MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAgents, useModels, useTrace } from "@/lib/api/queries";
import { formatDateTime } from "@/lib/utils";
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

const codeBlock =
  "whitespace-pre-wrap border border-[var(--line)] bg-[var(--canvas)] px-4 py-3 font-mono text-xs leading-[1.7] text-[var(--ink-2)]";

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
      <Link
        href="/monitoring"
        className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-[var(--ink-secondary)] hover:text-[var(--ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Monitoring
      </Link>
      <PageHeader
        title="Request trace"
        description={<span className="font-mono text-[13px]">{trace.id}</span>}
        action={
          <Button onClick={copyCurl}>
            <Terminal className="h-4 w-4" />
            Copy as cURL
          </Button>
        }
      />

      <KpiGrid>
        <MetricCard label="Status" value={String(trace.status)} hint={ok ? "Success" : "Failed"} icon={Activity} tone={ok ? "ok" : "danger"} />
        <MetricCard label="Latency" value={`${trace.latencyMs}ms`} hint={trace.endpoint} icon={Clock} />
        <MetricCard label="Tokens" value={String(totalTokens)} hint={`${trace.inputTokens} in / ${trace.outputTokens} out`} icon={Layers} />
        <MetricCard label="Cost" value={`$${trace.estimatedCost.toFixed(4)}`} hint="Estimated" icon={DollarSign} />
        <MetricCard label="Agent" value={agent?.name ?? trace.agentId} hint={agent ? agent.cid : "Unknown agent"} icon={Bot} />
      </KpiGrid>

      {trace.errorMessage ? (
        <p className="mt-4 border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-2.5 text-[13px] text-[var(--danger)]">
          {trace.errorMessage}
        </p>
      ) : null}

      <section className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardRow label="Request ID"><span className="font-mono text-xs">{trace.id}</span></CardRow>
          <CardRow label="Timestamp"><span className="font-mono text-xs">{formatDateTime(trace.timestamp)}</span></CardRow>
          <CardRow label="Status"><StatusBadge status={ok ? "active" : "error"} label={ok ? "Success" : "Failed"} /></CardRow>
          <CardRow label="Endpoint"><span className="font-mono text-xs">{trace.endpoint}</span></CardRow>
          <CardRow label="Model">{model ? `${model.modelName} · ${model.provider}` : trace.modelId}</CardRow>
          <CardRow label="Agent CID"><span className="font-mono text-xs">{trace.agentId}</span></CardRow>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request</CardTitle>
            <Button variant="ghost" size="sm" onClick={copyCurl}>
              <Copy className="h-3.5 w-3.5" />
              cURL
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {trace.prompt && trace.prompt.length > 0 ? (
              trace.prompt.map((message, index) => (
                <div key={index} className={codeBlock}>
                  <p className="mb-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">
                    {message.role}
                  </p>
                  {message.content}
                </div>
              ))
            ) : (
              <p className="text-xs text-[var(--ink-tertiary)]">No prompt payload was recorded for this request.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Response</CardTitle>
        </CardHeader>
        <CardContent>
          {trace.responseText ? (
            <pre className={`${codeBlock} max-h-96 overflow-y-auto`}>{trace.responseText}</pre>
          ) : (
            <p className="text-xs text-[var(--ink-tertiary)]">No response body was recorded for this request.</p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Replay</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className={`${codeBlock} overflow-x-auto whitespace-pre`}>{buildCurl(trace)}</pre>
        </CardContent>
      </Card>
    </>
  );
}
