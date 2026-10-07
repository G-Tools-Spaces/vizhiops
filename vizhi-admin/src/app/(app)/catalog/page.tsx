"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, type CatalogProvider } from "@/lib/api";

export default function CatalogPage() {
  const queryClient = useQueryClient();
  const providers = useQuery({
    queryKey: ["admin-catalog"],
    queryFn: api.listProviders,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-catalog"] });

  // ── Add provider form state ──────────────────────────────────────────
  const [newId, setNewId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newOrder, setNewOrder] = useState("0");

  const createProvider = useMutation({
    mutationFn: () =>
      api.createProvider({
        id: newId.trim(),
        label: newLabel.trim(),
        sort_order: Number(newOrder) || 0,
      }),
    onSuccess: (provider) => {
      toast.success(`Provider "${provider.label}" created`);
      setNewId("");
      setNewLabel("");
      setNewOrder("0");
      invalidate();
    },
    onError: (exc) => toast.error(exc.message),
  });

  // ── Inline edit state ────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editOrder, setEditOrder] = useState("0");

  const updateProvider = useMutation({
    mutationFn: (input: { id: string; label?: string; sort_order?: number; enabled?: boolean }) =>
      api.updateProvider(input.id, input),
    onSuccess: () => {
      toast.success("Provider updated");
      setEditingId(null);
      invalidate();
    },
    onError: (exc) => toast.error(exc.message),
  });

  const deleteProvider = useMutation({
    mutationFn: (id: string) => api.deleteProvider(id),
    onSuccess: () => {
      toast.success("Provider deleted");
      invalidate();
    },
    onError: (exc) => toast.error(exc.message),
  });

  function startEdit(provider: CatalogProvider) {
    setEditingId(provider.id);
    setEditLabel(provider.label);
    setEditOrder(String(provider.sort_order));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Model Catalog</h1>
        <p className="mt-1 text-sm text-[var(--ink-tertiary)]">
          Providers and models shown in the main console. Changes go live
          immediately — no redeploy needed.
        </p>
      </div>

      {/* ── Add provider ─────────────────────────────────────────────── */}
      <section className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--panel)] p-5">
        <h2 className="text-sm font-semibold">Add provider</h2>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            createProvider.mutate();
          }}
        >
          <div className="space-y-1">
            <label className="text-xs text-[var(--ink-tertiary)]">ID</label>
            <input
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="groq"
              required
              pattern="[a-z0-9][a-z0-9-]*"
              title="Lowercase letters, digits and dashes"
              className="w-44 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[var(--ink-tertiary)]">Label</label>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Groq"
              required
              className="w-56 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[var(--ink-tertiary)]">Sort order</label>
            <input
              value={newOrder}
              onChange={(e) => setNewOrder(e.target.value)}
              type="number"
              className="w-24 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
            />
          </div>
          <button
            type="submit"
            disabled={createProvider.isPending}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Add provider
          </button>
        </form>
      </section>

      {/* ── Providers table ──────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--panel)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--surface)] text-left text-xs text-[var(--ink-tertiary)]">
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Models</th>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Visible</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {providers.isPending ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--ink-tertiary)]">
                  Loading…
                </td>
              </tr>
            ) : null}
            {providers.data?.map((provider) => (
              <tr
                key={provider.id}
                className="border-b border-[var(--line-soft)] last:border-0"
              >
                {editingId === provider.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="w-full rounded-[var(--radius-md)] border border-[var(--line)] px-2 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <code className="rounded bg-[var(--surface-strong)] px-1.5 py-0.5 text-xs">
                        {provider.id}
                      </code>
                    </td>
                    <td className="px-4 py-2">{provider.models.length}</td>
                    <td className="px-4 py-2">
                      <input
                        value={editOrder}
                        onChange={(e) => setEditOrder(e.target.value)}
                        type="number"
                        className="w-20 rounded-[var(--radius-md)] border border-[var(--line)] px-2 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Toggle
                        checked={provider.enabled}
                        onChange={(enabled) =>
                          updateProvider.mutate({ id: provider.id, enabled })
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() =>
                          updateProvider.mutate({
                            id: provider.id,
                            label: editLabel.trim(),
                            sort_order: Number(editOrder) || 0,
                          })
                        }
                        className="mr-2 rounded-[var(--radius-md)] bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-[var(--radius-md)] border border-[var(--line)] px-3 py-1.5 text-xs hover:bg-[var(--surface)]"
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3">
                      <Link
                        href={`/catalog/${encodeURIComponent(provider.id)}`}
                        className="group flex items-center gap-1 font-medium text-[var(--ink)] hover:text-[var(--accent)]"
                      >
                        {provider.label}
                        <ChevronRight className="h-3.5 w-3.5 text-[var(--ink-tertiary)] transition group-hover:text-[var(--accent)]" />
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-[var(--surface-strong)] px-1.5 py-0.5 text-xs">
                        {provider.id}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-[var(--ink-secondary)]">
                      {provider.models.length}
                    </td>
                    <td className="px-4 py-3 text-[var(--ink-secondary)]">
                      {provider.sort_order}
                    </td>
                    <td className="px-4 py-3">
                      <Toggle
                        checked={provider.enabled}
                        onChange={(enabled) =>
                          updateProvider.mutate({ id: provider.id, enabled })
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => startEdit(provider)}
                        title="Edit"
                        className="mr-1 rounded-[var(--radius-md)] p-1.5 text-[var(--ink-tertiary)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete provider "${provider.label}" and its ${provider.models.length} models?`
                            )
                          ) {
                            deleteProvider.mutate(provider.id);
                          }
                        }}
                        title="Delete"
                        className="rounded-[var(--radius-md)] p-1.5 text-[var(--ink-tertiary)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition ${
        checked ? "bg-[var(--ok)]" : "bg-[var(--surface-strong)]"
      } disabled:opacity-50`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
          checked ? "left-4.5" : "left-0.5"
        }`}
        style={{ left: checked ? "18px" : "2px" }}
      />
    </button>
  );
}
