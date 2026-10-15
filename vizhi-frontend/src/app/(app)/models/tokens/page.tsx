"use client";

import { Eye, RefreshCcw, ShieldOff, Trash2, Copy, Check, Wallet, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { BudgetPanel } from "@/components/shared/budget-panel";
import {
  useModels,
  useDeleteModel,
  useRevokeModel,
  useRotateModel,
} from "@/lib/api/queries";
import { formatNumber } from "@/lib/utils";
import type { ModelConnectionCreated } from "@/lib/api/client";

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

export default function ModelTokensPage() {
  const router = useRouter();
  const { data: models = [] } = useModels();
  const deleteModel = useDeleteModel();
  const revokeModel = useRevokeModel();
  const rotateModel = useRotateModel();

  const [pendingId, setPendingId] = useState<string | null>(null);
  // After rotation, hold the new key for one-time copy
  const [rotatedToken, setRotatedToken] = useState<{ id: string; apiKey: string } | null>(null);
  // Budget panel: which model id currently has it open
  const [budgetId, setBudgetId] = useState<string | null>(null);

  const handleDelete = useCallback(async (modelId: string, label: string) => {
    if (!confirm(`Delete model token "${label}"?\n\nThis cannot be undone.`)) return;
    setPendingId(modelId);
    try {
      await deleteModel.mutateAsync(modelId);
      if (rotatedToken?.id === modelId) setRotatedToken(null);
    } finally {
      setPendingId(null);
    }
  }, [deleteModel, rotatedToken]);

  const handleRevoke = useCallback(async (modelId: string, label: string) => {
    if (!confirm(`Revoke token "${label}"?\n\nThe token will immediately stop working. You can rotate it later to re-enable access.`)) return;
    setPendingId(modelId);
    try {
      await revokeModel.mutateAsync(modelId);
    } finally {
      setPendingId(null);
    }
  }, [revokeModel]);

  const handleRotate = useCallback(async (modelId: string, label: string) => {
    if (!confirm(`Rotate token "${label}"?\n\nA new token will be generated. The current token stops working immediately.\nCopy the new token — it will only be shown once.`)) return;
    setPendingId(modelId);
    try {
      const result = await rotateModel.mutateAsync(modelId) as ModelConnectionCreated;
      setRotatedToken({ id: modelId, apiKey: result.apiKey });
    } catch {
      // error toast handled by mutation
    } finally {
      setPendingId(null);
    }
  }, [rotateModel]);

  const dismissRotatedToken = useCallback((id: string) => {
    if (rotatedToken?.id === id) setRotatedToken(null);
  }, [rotatedToken]);

  const handleViewUsage = (modelId: string) => {
    router.push(`/models/tokens/${modelId}`);
  };

  return (
    <>
      <PageHeader
        title="Model Tokens"
        description="Reusable model access tokens. Full tokens are shown once, at creation or rotation — only masked versions are stored."
        action={<Link href="/models/connect" className={buttonClass({ variant: "primary" })}><Plus className="h-4 w-4" />Connect model</Link>}
      />
      <DataTable
        title="Model tokens"
        tableId="model-tokens"
        emptyMessage="No model tokens yet. Connect a model to create one."
        headers={["Model", "Token name", "Provider", "Token", "Last used", "Created", "Usage", "Status", "Actions"]}
        rows={models.map((model) => {
          const isRevoked = model.status === "revoked";
          const isPending = pendingId === model.id;
          const isJustRotated = rotatedToken?.id === model.id;
          const label = model.tokenName || model.modelName;

          return [
            // Model name (clickable → usage page)
            <button
              key="model-name"
              onClick={() => handleViewUsage(model.id)}
              className="text-left font-semibold text-[var(--ink)] transition-colors hover:text-[var(--accent)]"
            >
              {model.modelName}
            </button>,

            // Token Name
            <span key="tn" className={isRevoked ? "text-[var(--ink-tertiary)] line-through" : ""}>
              {model.tokenName || <span className="text-[var(--ink-tertiary)]">—</span>}
            </span>,

            // Provider
            <span key="provider">{model.provider}</span>,

            // Token — after rotation show copy-once key, otherwise masked
            <div className="flex items-center gap-2" key="token">
              {isJustRotated && rotatedToken ? (
                <>
                  <span className="font-mono text-xs text-[var(--warn)] truncate max-w-[140px]" title={rotatedToken.apiKey}>
                    {rotatedToken.apiKey}
                  </span>
                  <CopyOnceButton value={rotatedToken.apiKey} onDismiss={() => dismissRotatedToken(model.id)} />
                </>
              ) : (
                <>
                  <span className="font-mono text-xs" title="Full token only shown once at creation or rotation">
                    {model.maskedKey}
                  </span>
                                  </>
              )}
            </div>,

            // Last Used
            <span key="last" className="text-xs text-[var(--ink-tertiary)]">
              {formatDate(model.lastUsedAt)}
            </span>,

            // Created
            <span key="created" className="text-xs text-[var(--ink-tertiary)]">
              {formatDate(model.createdAt)}
            </span>,

            // Usage count (clickable)
            <button
              key="usage"
              onClick={() => handleViewUsage(model.id)}
              className="font-mono text-xs transition-colors hover:text-[var(--accent)]"
            >
              {formatNumber(model.usageCount)}
            </button>,

            // Status
            <StatusBadge key="status" status={isRevoked ? "disabled" : model.status} />,

            // Actions
            <div className="flex gap-1.5" key="actions">
              {/* View Usage */}
              <Button size="icon" title="View Usage Details" onClick={() => handleViewUsage(model.id)}>
                <Eye className="h-3.5 w-3.5" />
              </Button>

              {/* Rotate */}
              <Button
                size="icon"
                title="Rotate token — generates a new key and revokes the current one"
                disabled={isPending}
                onClick={() => handleRotate(model.id, label)}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
              </Button>

              {/* Revoke */}
              <Button
                size="icon"
                variant="danger"
                title={isRevoked ? "Already revoked" : "Revoke token — immediately blocks authentication"}
                disabled={isPending || isRevoked}
                onClick={() => handleRevoke(model.id, label)}
              >
                <ShieldOff className="h-3.5 w-3.5" />
              </Button>

              {/* Budget */}
              <Button
                size="icon"
                title="Configure spending / token budget"
                disabled={isPending}
                variant={budgetId === model.id ? "primary" : "secondary"}
                onClick={() => setBudgetId(budgetId === model.id ? null : model.id)}
              >
                <Wallet className="h-3.5 w-3.5" />
              </Button>

              {/* Delete */}
              <Button
                size="icon"
                variant="danger"
                title="Permanently delete this model token"
                disabled={isPending}
                onClick={() => handleDelete(model.id, label)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>,

            // Budget panel (renders as an extra full-width row when open)
            ...(budgetId === model.id
              ? [
                  <BudgetPanel
                    key="budget"
                    type="model"
                    id={model.id}
                    label={label}
                    onClose={() => setBudgetId(null)}
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
      className="p-1 transition-colors hover:bg-[var(--surface-strong)]"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-[var(--ok)]" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-[var(--warn)]" />
      )}
    </button>
  );
}
