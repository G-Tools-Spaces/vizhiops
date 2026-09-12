"use client";

/**
 * BudgetPanel
 *
 * A compact, inline budget configuration + usage card that can be dropped
 * under any agent token row or model token row.
 *
 * Props:
 *   type      – "agent" | "model"
 *   id        – agentCID (for agents) or modelId (for models)
 *   label     – human-readable name shown in headings
 *   onClose   – called when the panel should be dismissed
 */

import { useState } from "react";
import { X, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useAgentBudget,
  useUpdateAgentBudget,
  useModelBudget,
  useUpdateModelBudget,
} from "@/lib/api/queries";
import type { BudgetStatus } from "@/lib/api/client";

// ── helpers ──────────────────────────────────────────────────────────────

function fmtUsd(v: number | null | undefined): string {
  if (v == null) return "—";
  return `$${v.toFixed(4)}`;
}

function fmtTokens(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString();
}

function pct(spent: number, limit: number | null): number {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((spent / limit) * 100));
}

function ProgressBar({ value, exceeded }: { value: number; exceeded: boolean }) {
  const color = exceeded
    ? "bg-red-500"
    : value >= 80
    ? "bg-yellow-400"
    : "bg-emerald-500";
  return (
    <div className="w-full h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

// ── Inner form ────────────────────────────────────────────────────────────

function BudgetForm({
  id,
  type,
  data,
  onSave,
  onClear,
  isSaving,
}: {
  id: string;
  type: "agent" | "model";
  data: BudgetStatus;
  onSave: (usd: number | null, tokens: number | null, resetAt: string | null) => void;
  onClear: () => void;
  isSaving: boolean;
}) {
  const [usdStr, setUsdStr] = useState(data.budget_usd != null ? String(data.budget_usd) : "");
  const [tokStr, setTokStr] = useState(data.budget_tokens != null ? String(data.budget_tokens) : "");
  const [resetAt, setResetAt] = useState(data.budget_reset_at ?? "");

  const handleSave = () => {
    const usd = usdStr.trim() ? parseFloat(usdStr) : null;
    const tok = tokStr.trim() ? parseInt(tokStr, 10) : null;
    const reset = resetAt.trim() ? resetAt.trim() : null;
    onSave(usd, tok, reset);
  };

  const hasLimits = data.budget_usd !== null || data.budget_tokens !== null;
  const usdPct = pct(data.spent_usd, data.budget_usd);
  const tokPct = pct(data.spent_tokens, data.budget_tokens);

  void id; void type; // used by parent

  return (
    <div className="space-y-4">
      {/* Current usage overview */}
      {hasLimits && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.budget_usd !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[var(--muted)]">
                <span>Cost</span>
                <span>
                  {fmtUsd(data.spent_usd)} / {fmtUsd(data.budget_usd)}
                </span>
              </div>
              <ProgressBar value={usdPct} exceeded={data.exceeded} />
              {data.remaining_usd !== null && (
                <div className="text-xs text-[var(--muted)]">
                  {data.remaining_usd <= 0
                    ? "Limit reached"
                    : `${fmtUsd(data.remaining_usd)} remaining`}
                </div>
              )}
            </div>
          )}
          {data.budget_tokens !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[var(--muted)]">
                <span>Tokens</span>
                <span>
                  {fmtTokens(data.spent_tokens)} / {fmtTokens(data.budget_tokens)}
                </span>
              </div>
              <ProgressBar value={tokPct} exceeded={data.exceeded} />
              {data.remaining_tokens !== null && (
                <div className="text-xs text-[var(--muted)]">
                  {data.remaining_tokens <= 0
                    ? "Limit reached"
                    : `${fmtTokens(data.remaining_tokens)} remaining`}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!hasLimits && (
        <p className="text-xs text-[var(--muted)] italic">
          No budget limits configured — this token can make unlimited requests.
        </p>
      )}

      {/* Edit fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted)]">Max spend (USD)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 5.00 (leave blank = unlimited)"
            value={usdStr}
            onChange={(e) => setUsdStr(e.target.value)}
            className="rounded border border-[var(--border)] bg-[var(--card)] text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted)]">Max tokens</span>
          <input
            type="number"
            min="0"
            step="1000"
            placeholder="e.g. 100000 (leave blank = unlimited)"
            value={tokStr}
            onChange={(e) => setTokStr(e.target.value)}
            className="rounded border border-[var(--border)] bg-[var(--card)] text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[var(--muted)]">
          Budget window resets at (ISO-8601, optional)
        </span>
        <input
          type="datetime-local"
          value={resetAt ? resetAt.slice(0, 16) : ""}
          onChange={(e) => setResetAt(e.target.value ? e.target.value + ":00Z" : "")}
          className="rounded border border-[var(--border)] bg-[var(--card)] text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
        <span className="text-[10px] text-[var(--muted)]">
          After this date/time the spent counter resets to zero.
        </span>
      </label>

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save limits"}
        </Button>
        {hasLimits && (
          <Button size="sm" variant="ghost" onClick={onClear} disabled={isSaving}>
            Clear limits
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────

export type BudgetPanelProps = {
  type: "agent" | "model";
  id: string;
  label: string;
  onClose: () => void;
};

export function BudgetPanel({ type, id, label, onClose }: BudgetPanelProps) {
  const isAgent = type === "agent";

  const agentBudget = useAgentBudget(isAgent ? id : "");
  const modelBudget = useModelBudget(isAgent ? "" : id);
  const updateAgent = useUpdateAgentBudget(id);
  const updateModel = useUpdateModelBudget(id);

  const query = isAgent ? agentBudget : modelBudget;
  const mutation = isAgent ? updateAgent : updateModel;

  const handleSave = (
    usd: number | null,
    tokens: number | null,
    resetAt: string | null
  ) => {
    mutation.mutate({ budget_usd: usd, budget_tokens: tokens, budget_reset_at: resetAt });
  };

  const handleClear = () => {
    mutation.mutate({ clear: true });
  };

  return (
    <div className="mt-2 ml-2 mr-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold">Budget limits</h4>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {label} · {isAgent ? "agent token" : "model token"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {query.data?.exceeded && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              Budget exceeded
            </span>
          )}
          {query.data && !query.data.exceeded && (query.data.budget_usd !== null || query.data.budget_tokens !== null) && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Within limits
            </span>
          )}
          <button
            onClick={onClose}
            className="rounded p-0.5 hover:bg-[var(--accent)] transition-colors"
            title="Close"
          >
            <X className="h-4 w-4 text-[var(--muted)]" />
          </button>
        </div>
      </div>

      {/* Body */}
      {query.isLoading && (
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading budget…
        </div>
      )}
      {query.isError && (
        <p className="text-xs text-red-400">
          Failed to load budget: {(query.error as Error).message}
        </p>
      )}
      {query.data && (
        <BudgetForm
          id={id}
          type={type}
          data={query.data}
          onSave={handleSave}
          onClear={handleClear}
          isSaving={mutation.isPending}
        />
      )}
    </div>
  );
}
