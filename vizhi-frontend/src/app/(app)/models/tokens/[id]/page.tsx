"use client";

import { useParams } from "next/navigation";
import { ArrowLeft, TrendingUp, Clock, AlertCircle, CheckCircle, DollarSign } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useModelUsage } from "@/lib/api/queries";
import { formatNumber } from "@/lib/utils";

export default function ModelUsageDetailPage() {
  const params = useParams();
  const modelId = params.id as string;
  const { data, isLoading, error } = useModelUsage(modelId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[var(--muted)]">Loading model usage...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[var(--danger)]">Failed to load model usage details</div>
      </div>
    );
  }

  const { modelConnection, stats, recentQueries } = data;

  return (
    <>
      <div className="mb-6">
        <Link href="/models/tokens">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Models
          </Button>
        </Link>
      </div>

      <PageHeader
        title={`${modelConnection.modelName} Usage`}
        description={`Detailed usage analytics for ${modelConnection.provider} model`}
      />

      {/* Model Info Card */}
      <Card className="p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-[var(--muted)] mb-1">Provider</div>
            <div className="text-lg font-semibold">{modelConnection.provider}</div>
          </div>
          <div>
            <div className="text-sm text-[var(--muted)] mb-1">Status</div>
            <StatusBadge status={modelConnection.status} />
          </div>
          <div>
            <div className="text-sm text-[var(--muted)] mb-1">Token</div>
            <div className="font-mono text-sm">{modelConnection.maskedKey}</div>
          </div>
          <div>
            <div className="text-sm text-[var(--muted)] mb-1">Created</div>
            <div className="text-sm">{new Date(modelConnection.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
      </Card>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-[var(--muted)]">Total Requests</div>
            <TrendingUp className="h-4 w-4 text-[var(--primary)]" />
          </div>
          <div className="text-2xl font-bold">{formatNumber(stats.totalRequests)}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-[var(--muted)]">Total Tokens</div>
            <TrendingUp className="h-4 w-4 text-[var(--primary)]" />
          </div>
          <div className="text-2xl font-bold">{formatNumber(stats.totalTokens)}</div>
          <div className="text-xs text-[var(--muted)] mt-1">
            {formatNumber(stats.totalInputTokens)} in / {formatNumber(stats.totalOutputTokens)} out
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-[var(--muted)]">Avg Latency</div>
            <Clock className="h-4 w-4 text-[var(--primary)]" />
          </div>
          <div className="text-2xl font-bold">{stats.avgLatencyMs}ms</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-[var(--muted)]">Total Cost</div>
            <DollarSign className="h-4 w-4 text-[var(--primary)]" />
          </div>
          <div className="text-2xl font-bold">${stats.totalCost.toFixed(4)}</div>
        </Card>
      </div>

      {/* Success Rate and Errors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-[var(--muted)]">Success Rate</div>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold">{stats.successRate}%</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-[var(--muted)]">Error Count</div>
            <AlertCircle className="h-4 w-4 text-[var(--danger)]" />
          </div>
          <div className="text-2xl font-bold">{stats.errorCount}</div>
        </Card>
      </div>

      {/* Recent Queries */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Query History</h2>
        <div className="space-y-4">
          {recentQueries.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted)]">No queries found for this model</div>
          ) : (
            recentQueries.map((query) => (
              <div
                key={query.queryId}
                className="border border-[var(--border)] rounded-lg p-4 hover:border-[var(--primary)] transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-mono text-[var(--muted)]">{query.queryId}</span>
                      <StatusBadge status={query.statusCode < 400 ? "active" : "error"} />
                      <span className="text-xs text-[var(--muted)]">
                        {new Date(query.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--muted)]">Agent: {query.agentId}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">${query.estimatedCost.toFixed(4)}</div>
                    <div className="text-xs text-[var(--muted)]">{query.latencyMs}ms</div>
                  </div>
                </div>

                {/* Prompt Section */}
                <div className="mb-3">
                  <div className="text-xs font-semibold text-[var(--muted)] mb-1">PROMPT:</div>
                  <div className="bg-[var(--background-secondary)] p-3 rounded text-sm max-h-32 overflow-y-auto">
                    {query.prompt.length > 0 ? (
                      query.prompt.map((msg, idx) => (
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

                {/* Response Section */}
                <div className="mb-3">
                  <div className="text-xs font-semibold text-[var(--muted)] mb-1">RESPONSE:</div>
                  <div className="bg-[var(--background-secondary)] p-3 rounded text-sm max-h-32 overflow-y-auto">
                    {query.errorMessage ? (
                      <span className="text-[var(--danger)]">{query.errorMessage}</span>
                    ) : query.responseText ? (
                      <span className="text-[var(--foreground)]">{query.responseText}</span>
                    ) : (
                      <span className="text-[var(--muted)]">No response data</span>
                    )}
                  </div>
                </div>

                {/* Token Usage */}
                <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
                  <div>
                    <span className="font-semibold">Input:</span> {formatNumber(query.inputTokens)} tokens
                  </div>
                  <div>
                    <span className="font-semibold">Output:</span> {formatNumber(query.outputTokens)} tokens
                  </div>
                  <div>
                    <span className="font-semibold">Total:</span> {formatNumber(query.inputTokens + query.outputTokens)} tokens
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </>
  );
}
