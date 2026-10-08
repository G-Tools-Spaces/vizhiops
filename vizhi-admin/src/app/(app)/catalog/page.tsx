"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Database,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";
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

  const syncNvidia = useMutation({
    mutationFn: api.syncNvidia,
    onSuccess: (result) => {
      toast.success(
        `NVIDIA synced — ${result.total} models (${result.source})`
      );
      invalidate();
    },
    onError: (exc) => toast.error(exc.message),
  });

  const syncHuggingface = useMutation({
    mutationFn: api.syncHuggingface,
    onSuccess: (result) => {
      toast.success(
        `HuggingFace synced — ${result.total} models (${result.source})`
      );
      invalidate();
    },
    onError: (exc) => toast.error(exc.message),
  });

  function startEdit(provider: CatalogProvider) {
    setEditingId(provider.id);
    setEditLabel(provider.label);
    setEditOrder(String(provider.sort_order));
  }

  const providerList = providers.data ?? [];
  const totalProviders = providerList.length;
  const totalModels = providerList.reduce((sum, provider) => sum + provider.models.length, 0);
  const enabledProviders = providerList.filter((provider) => provider.enabled).length;
  const enabledModels = providerList.reduce(
    (sum, provider) => sum + provider.models.filter((model) => model.enabled).length,
    0
  );
  const syncReadyProviders = providerList.filter(
    (provider) => provider.id.includes("hug") || provider.id.includes("nvidia")
  ).length;

  const statCards = [
    {
      label: "Providers",
      value: totalProviders,
      caption: "Available catalog providers",
      icon: Database,
    },
    {
      label: "Models",
      value: totalModels,
      caption: "Registered models",
      icon: Database,
    },
    {
      label: "Enabled providers",
      value: enabledProviders,
      caption: "Visible providers",
      icon: RefreshCcw,
    },
    {
      label: "Enabled models",
      value: enabledModels,
      caption: "Enabled models",
      icon: RefreshCcw,
    },
    {
      label: "Sync-ready providers",
      value: syncReadyProviders,
      caption: "Providers with live sync support",
      icon: RefreshCcw,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[2rem] font-semibold tracking-[-0.02em]">Model catalog</h1>
            <p className="mt-1 text-sm text-[var(--ink-secondary)]">
              Manage which providers and models appear in the main console with a cleaner admin workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => invalidate()}
              className="rounded-[10px] border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface)]"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.label}
                className="rounded-[18px] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium tracking-wide text-[var(--ink-tertiary)]">
                      {card.label}
                    </p>
                    <p className="mt-1 text-[2rem] leading-none tracking-[-0.03em] text-[var(--ink)]">
                      {card.value}
                    </p>
                    <p className="mt-2 text-sm text-[var(--ink-secondary)]">{card.caption}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <section className="rounded-[18px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--ink)]">Sync sources</h2>
                <p className="mt-1 text-sm text-[var(--ink-secondary)]">
                  Pull the latest catalog candidates from supported providers.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => syncHuggingface.mutate()}
                disabled={syncHuggingface.isPending}
                className="flex items-center justify-between rounded-[14px] border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-left transition hover:bg-[var(--surface)] disabled:opacity-60"
              >
                <span>
                  <span className="block text-sm font-medium text-[var(--ink)]">Sync HuggingFace</span>
                  <span className="mt-0.5 block text-xs text-[var(--ink-tertiary)]">Refresh router-backed public models</span>
                </span>
                <RefreshCcw className={`h-4 w-4 text-[var(--ink-secondary)] ${syncHuggingface.isPending ? "animate-spin" : ""}`} />
              </button>

              <button
                type="button"
                onClick={() => syncNvidia.mutate()}
                disabled={syncNvidia.isPending}
                className="flex items-center justify-between rounded-[14px] border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-left transition hover:bg-[var(--surface)] disabled:opacity-60"
              >
                <span>
                  <span className="block text-sm font-medium text-[var(--ink)]">Sync NVIDIA models</span>
                  <span className="mt-0.5 block text-xs text-[var(--ink-tertiary)]">Validate callable NIM chat models</span>
                </span>
                <RefreshCcw className={`h-4 w-4 text-[var(--ink-secondary)] ${syncNvidia.isPending ? "animate-spin" : ""}`} />
              </button>
            </div>
        </section>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.55fr]">
        <section className="rounded-[18px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">Add provider</h2>
            <p className="mt-1 text-sm text-[var(--ink-secondary)]">
              Register a provider and control whether it is visible in the main console.
            </p>
          </div>

          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              createProvider.mutate();
            }}
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">ID</label>
              <input
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="groq"
                required
                pattern="[a-z0-9][a-z0-9-]*"
                title="Lowercase letters, digits and dashes"
                className="w-full rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">Label</label>
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Groq"
                required
                className="w-full rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">Sort order</label>
              <input
                value={newOrder}
                onChange={(e) => setNewOrder(e.target.value)}
                type="number"
                className="w-full rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
              />
            </div>

            <button
              type="submit"
              disabled={createProvider.isPending}
              className="flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Add provider
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-[var(--ink)]">Catalog providers</h2>
              <p className="mt-1 text-sm text-[var(--ink-secondary)]">
                Providers and models shown in the main console. Changes go live immediately.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--surface)] text-left text-[11px] uppercase tracking-wide text-[var(--ink-tertiary)]">
                  <th className="px-5 py-3 font-medium">Provider</th>
                  <th className="px-5 py-3 font-medium">ID</th>
                  <th className="px-5 py-3 font-medium">Models</th>
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-5 py-3 font-medium">Visible</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {providers.isPending ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-[var(--ink-tertiary)]">
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
                        <td className="px-5 py-3">
                          <input
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className="w-full rounded-[10px] border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <code className="rounded-[8px] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--ink-secondary)]">
                            {provider.id}
                          </code>
                        </td>
                        <td className="px-5 py-3">{provider.models.length}</td>
                        <td className="px-5 py-3">
                          <input
                            value={editOrder}
                            onChange={(e) => setEditOrder(e.target.value)}
                            type="number"
                            className="w-20 rounded-[10px] border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <Toggle
                            checked={provider.enabled}
                            onChange={(enabled) =>
                              updateProvider.mutate({ id: provider.id, enabled })
                            }
                          />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() =>
                              updateProvider.mutate({
                                id: provider.id,
                                label: editLabel.trim(),
                                sort_order: Number(editOrder) || 0,
                              })
                            }
                            className="mr-2 rounded-[10px] bg-[var(--brand)] px-3 py-2 text-xs font-medium text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-[10px] border border-[var(--line)] px-3 py-2 text-xs hover:bg-[var(--surface)]"
                          >
                            Cancel
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-4">
                          <Link
                            href={`/catalog/${encodeURIComponent(provider.id)}`}
                            className="group flex items-center gap-1 font-medium text-[var(--ink)] hover:text-[var(--accent)]"
                          >
                            {provider.label}
                            <ChevronRight className="h-3.5 w-3.5 text-[var(--ink-tertiary)] transition group-hover:text-[var(--accent)]" />
                          </Link>
                        </td>
                        <td className="px-5 py-4">
                          <code className="rounded-[8px] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--ink-secondary)]">
                            {provider.id}
                          </code>
                        </td>
                        <td className="px-5 py-4 text-[var(--ink-secondary)]">
                          {provider.models.length}
                        </td>
                        <td className="px-5 py-4 text-[var(--ink-secondary)]">
                          {provider.sort_order}
                        </td>
                        <td className="px-5 py-4">
                          <Toggle
                            checked={provider.enabled}
                            onChange={(enabled) =>
                              updateProvider.mutate({ id: provider.id, enabled })
                            }
                          />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => startEdit(provider)}
                            title="Edit"
                            className="mr-1 rounded-[10px] p-2 text-[var(--ink-tertiary)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
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
                            className="rounded-[10px] p-2 text-[var(--ink-tertiary)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
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
          </div>
        </section>
      </div>
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
      className={`relative h-6 w-10 rounded-full transition ${
        checked ? "bg-[var(--ok)]" : "bg-[var(--surface-strong)]"
      } disabled:opacity-50`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(16,24,40,0.16)] transition-all ${
          checked ? "left-4.5" : "left-0.5"
        }`}
        style={{ left: checked ? "18px" : "2px" }}
      />
    </button>
  );
}
