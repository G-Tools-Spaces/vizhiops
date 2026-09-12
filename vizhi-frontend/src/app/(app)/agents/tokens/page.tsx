"use client";

import { RefreshCcw, ShieldOff, Trash2, Copy, Check, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { BudgetPanel } from "@/components/shared/budget-panel";
import {
  useAgents,
  useDeleteAgent,
  useLinks,
  useRevokeAgent,
  useRotateAgent,
} from "@/lib/api/queries";
import { useState, useCallback } from "react";
import type { AgentCreated } from "@/lib/api/client";

/** Format an ISO date string as a short relative/absolute label. */
function formatDate(iso: string | undefined): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function AgentTokensPage() {
  const { data: agents = [] } = useAgents();
  const { data: links = [] } = useLinks();
  const deleteAgent = useDeleteAgent();
  const revokeAgent = useRevokeAgent();
  const rotateAgent = useRotateAgent();

  const [pendingCID, setPendingCID] = useState<string | null>(null);
  // After rotation, hold the new key so the user can copy it once.
  const [rotatedToken, setRotatedToken] = useState<{ cid: string; apiKey: string } | null>(null);
  // Budget panel: which agent CID currently has it open
  const [budgetCID, setBudgetCID] = useState<string | null>(null);

  const handleDelete = useCallback(async (cid: string, name: string) => {
    if (!confirm(`Delete agent token "${name}"?\n\nThis cannot be undone.`)) return;
    setPendingCID(cid);
    try {
      await deleteAgent.mutateAsync(cid);
    } finally {
      setPendingCID(null);
    }
  }, [deleteAgent]);

  const handleRevoke = useCallback(async (cid: string, name: string) => {
    if (!confirm(`Revoke token "${name}"?\n\nThe token will immediately stop working. You can rotate it later to re-enable access.`)) return;
    setPendingCID(cid);
    try {
      await revokeAgent.mutateAsync(cid);
    } finally {
      setPendingCID(null);
    }
  }, [revokeAgent]);

  const handleRotate = useCallback(async (cid: string, name: string) => {
    if (!confirm(`Rotate token "${name}"?\n\nA new token will be generated. The current token stops working immediately.\nCopy the new token — it will only be shown once.`)) return;
    setPendingCID(cid);
    try {
      const result = await rotateAgent.mutateAsync(cid) as AgentCreated;
      // Show the new key in-row for one-time copy
      setRotatedToken({ cid, apiKey: result.apiKey });
    } catch {
      // error toast is handled by the mutation
    } finally {
      setPendingCID(null);
    }
  }, [rotateAgent]);

  const dismissRotatedToken = useCallback((cid: string) => {
    if (rotatedToken?.cid === cid) setRotatedToken(null);
  }, [rotatedToken]);

  return (
    <>
      <PageHeader
        title="Agent Tokens"
        description="Monitoring identities for external applications. Full tokens are shown only once at creation or after rotation — copy them immediately. Only masked versions are displayed here."
      />
      <DataTable
        headers={["Token Name", "Agent", "CID", "Token", "Last Used", "Created", "Status", "Actions"]}
        rows={agents.map((agent) => {
          const isRevoked = agent.status === "revoked";
          const isPending = pendingCID === agent.cid;
          const linkedModels = links.filter((l) => l.agentId === agent.id).length;
          const isJustRotated = rotatedToken?.cid === agent.cid;

          return [
            // Token Name
            <span key="tn" className={`text-sm ${isRevoked ? "text-[var(--muted)] line-through" : ""}`}>
              {agent.tokenName || <span className="text-[var(--muted)] italic">—</span>}
            </span>,

            // Agent Name + linked model count
            <span key="name" className="text-sm font-medium">
              {agent.name}
              {linkedModels > 0 && (
                <span className="ml-2 text-xs text-[var(--muted)]">({linkedModels} model{linkedModels !== 1 ? "s" : ""})</span>
              )}
            </span>,

            // CID
            <span className="font-mono text-xs" key="cid">{agent.cid}</span>,

            // Token — after rotation show copy-once key, otherwise masked
            <div className="flex items-center gap-2" key="token">
              {isJustRotated && rotatedToken ? (
                <>
                  <span className="font-mono text-xs text-[var(--warning)] truncate max-w-[140px]" title={rotatedToken.apiKey}>
                    {rotatedToken.apiKey}
                  </span>
                  <CopyOnceButton value={rotatedToken.apiKey} onDismiss={() => dismissRotatedToken(agent.cid)} />
                </>
              ) : (
                <>
                  <span className="font-mono text-xs" title="Full token only shown once at creation or rotation">
                    {agent.maskedKey}
                  </span>
                  <span className="text-xs text-[var(--muted)]">(masked)</span>
                </>
              )}
            </div>,

            // Last Used
            <span key="last" className="text-xs text-[var(--muted)]">
              {formatDate(agent.lastUsedAt)}
            </span>,

            // Created
            <span key="created" className="text-xs text-[var(--muted)]">
              {formatDate(agent.createdAt)}
            </span>,

            // Status
            <StatusBadge key="status" status={isRevoked ? "disabled" : agent.status} />,

            // Actions
            <div className="flex gap-2" key="actions">
              {/* Rotate */}
              <Button
                size="icon"
                title="Rotate token — generates a new key and revokes the current one"
                disabled={isPending}
                onClick={() => handleRotate(agent.cid, agent.tokenName || agent.name)}
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>

              {/* Revoke */}
              <Button
                size="icon"
                variant="danger"
                title={isRevoked ? "Already revoked" : "Revoke token — immediately blocks authentication"}
                disabled={isPending || isRevoked}
                onClick={() => handleRevoke(agent.cid, agent.tokenName || agent.name)}
              >
                <ShieldOff className="h-4 w-4" />
              </Button>

              {/* Budget */}
              <Button
                size="icon"
                title="Configure spending / token budget"
                disabled={isPending}
                onClick={() => setBudgetCID(budgetCID === agent.cid ? null : agent.cid)}
              >
                <Wallet className="h-4 w-4" />
              </Button>

              {/* Delete */}
              <Button
                size="icon"
                variant="danger"
                title="Permanently delete this agent token"
                disabled={isPending}
                onClick={() => handleDelete(agent.cid, agent.tokenName || agent.name)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>,

            // Budget panel (renders as an extra full-width row when open)
            ...(budgetCID === agent.cid
              ? [
                  <BudgetPanel
                    key="budget"
                    type="agent"
                    id={agent.cid}
                    label={agent.tokenName || agent.name}
                    onClose={() => setBudgetCID(null)}
                  />,
                ]
              : []),
          ];
        })}
      />
    </>
  );
}

/**
 * One-time copy button: shows a Copy icon, switches to a checkmark for 3 s after
 * clicking, then calls onDismiss() so the plaintext key is cleared from state.
 */
function CopyOnceButton({ value, onDismiss }: { value: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onDismiss();
      }, 3000);
    } catch {
      // fallback silently
    }
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy new token — it will disappear after copying"}
      className="p-1 rounded hover:bg-[var(--accent)] transition-colors"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-[var(--warning)]" />
      )}
    </button>
  );
}
