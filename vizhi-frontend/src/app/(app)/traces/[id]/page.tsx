"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, ArrowLeft, Bot, ChevronDown, ChevronUp, Clock, Copy, DollarSign, Layers, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiGrid, MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAgents, useModels, useTrace } from "@/lib/api/queries";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";
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
  // Status 0 means no response row was ever stored for this query.
  const pending = trace.status === 0;
  const ok = !pending && trace.status < 300;
  const statusLabel = pending ? "No response" : ok ? "Success" : "Failed";

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
        <MetricCard
          label="Status"
          value={pending ? "—" : String(trace.status)}
          hint={statusLabel}
          icon={Activity}
          tone={pending ? "warn" : ok ? "ok" : "danger"}
        />
        <MetricCard label="Latency" value={pending ? "—" : `${trace.latencyMs}ms`} hint={trace.endpoint} icon={Clock} />
        <MetricCard
          label="Tokens"
          value={pending ? "—" : formatNumber(totalTokens)}
          hint={`${formatNumber(trace.inputTokens)} in / ${formatNumber(trace.outputTokens)} out`}
          icon={Layers}
        />
        <MetricCard label="Cost" value={pending ? "—" : `$${trace.estimatedCost.toFixed(4)}`} hint="Estimated" icon={DollarSign} />
        <MetricCard label="Agent" value={agent?.name ?? trace.agentId} hint={agent ? agent.cid : "Unknown agent"} icon={Bot} />
      </KpiGrid>

      {pending ? (
        <p className="mt-4 border border-[var(--warn-border)] bg-[var(--warn-soft)] px-4 py-2.5 text-[13px] text-[var(--warn)]">
          No response was recorded for this request — the agent never reported a result back to the gateway, so status,
          latency, tokens and cost are unknown.
        </p>
      ) : null}

      {trace.errorMessage ? (
        <p className="mt-4 border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-2.5 text-[13px] text-[var(--danger)]">
          {trace.errorMessage}
        </p>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        {/* Key/value grid: 3 columns wide, wraps on small screens. */}
        <dl className="grid grid-cols-1 gap-px bg-[var(--line-soft)] sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Request ID", <span key="id" className="font-mono text-xs">{trace.id}</span>],
            ["Timestamp", <span key="ts" className="font-mono text-xs">{formatDateTime(trace.timestamp)}</span>],
            ["Status", <StatusBadge key="st" status={pending ? "archived" : ok ? "active" : "error"} label={statusLabel} />],
            ["Endpoint", <span key="ep" className="font-mono text-xs">{trace.endpoint}</span>],
            ["Model", model ? `${model.modelName} · ${model.provider}` : trace.modelId],
            ["Agent CID", <span key="cid" className="font-mono text-xs">{trace.agentId}</span>],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex items-center justify-between gap-4 bg-[var(--panel)] px-[18px] py-[11px] text-[13px]">
              <dt className="shrink-0 text-[var(--ink-secondary)]">{label}</dt>
              <dd className="min-w-0 truncate text-right font-medium text-[var(--ink)]">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>
            Request <span className="ml-1 font-mono text-[11px] font-medium text-[var(--ink-tertiary)]">{trace.prompt?.length ?? 0} messages</span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={copyCurl}>
            <Copy className="h-3.5 w-3.5" />
            cURL
          </Button>
        </CardHeader>
        {trace.prompt && trace.prompt.length > 0 ? (
          <MessageTable
            rows={trace.prompt.map((message) => ({ role: message.role, content: message.content }))}
          />
        ) : (
          <p className="px-[18px] py-4 text-xs text-[var(--ink-tertiary)]">No prompt payload was recorded for this request.</p>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Response</CardTitle>
        </CardHeader>
        {trace.responseText ? (
          <MessageTable rows={[{ role: "assistant", content: trace.responseText }]} defaultOpen />
        ) : (
          <p className="px-[18px] py-4 text-xs text-[var(--ink-tertiary)]">
            {pending ? "Waiting on the agent — no response has been reported." : "No response body was recorded for this request."}
          </p>
        )}
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

// One row per message: #, role, size, content. Long content is clamped
// until expanded so a big system prompt doesn't push everything off-screen.
function MessageTable({ rows, defaultOpen = false }: { rows: { role: string; content: string }[]; defaultOpen?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-[var(--surface)] text-left text-xs font-semibold text-[var(--ink-secondary)]">
            <th className="w-12 border-b border-[var(--line)] px-[18px] py-2.5">#</th>
            <th className="w-28 border-b border-[var(--line)] px-3 py-2.5">Role</th>
            <th className="w-28 border-b border-[var(--line)] px-3 py-2.5 text-right">Size</th>
            <th className="border-b border-[var(--line)] px-[18px] py-2.5">Content</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <MessageRow key={index} index={index} role={row.role} content={row.content} defaultOpen={defaultOpen} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessageRow({ index, role, content, defaultOpen }: { index: number; role: string; content: string; defaultOpen: boolean }) {
  const lines = content.split("\n").length;
  const long = lines > 8 || content.length > 900;
  const [open, setOpen] = useState(defaultOpen || !long);
  return (
    <tr className="align-top">
      <td className="border-b border-[var(--line-soft)] px-[18px] py-3 font-mono text-xs text-[var(--ink-tertiary)]">{index + 1}</td>
      <td className="border-b border-[var(--line-soft)] px-3 py-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">{role}</span>
      </td>
      <td className="whitespace-nowrap border-b border-[var(--line-soft)] px-3 py-3 text-right font-mono text-xs text-[var(--ink-tertiary)]">
        {formatNumber(content.length)} ch
        <br />
        {formatNumber(lines)} ln
      </td>
      <td className="border-b border-[var(--line-soft)] px-[18px] py-3">
        <pre
          className={cn(
            "whitespace-pre-wrap break-words font-mono text-xs leading-[1.7] text-[var(--ink-2)]",
            !open && "max-h-[10.5em] overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent)]",
          )}
        >
          {content}
        </pre>
        {long ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {open ? "Collapse" : `Show all ${formatNumber(lines)} lines`}
          </button>
        ) : null}
      </td>
    </tr>
  );
}
