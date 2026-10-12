"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, type CatalogModel } from "@/lib/api";

export default function ProviderDetailPage() {
  const params = useParams<{ id: string }>();
  const providerId = decodeURIComponent(params.id);
  const queryClient = useQueryClient();

  const providers = useQuery({
    queryKey: ["admin-catalog"],
    queryFn: api.listProviders,
  });
  const provider = providers.data?.find((p) => p.id === providerId);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-catalog"] });

  // ── Credentials state (rotate / clear) ───────────────────────────────
  const [credApiKey, setCredApiKey] = useState("");
  const [credBaseUrl, setCredBaseUrl] = useState("");

  const syncProvider = useMutation({
    mutationFn: () => api.syncProvider(providerId),
    onSuccess: (result) => {
      if (result.source !== "live") {
        toast.error(
          `Sync failed (${result.source}) — check the provider's API key and base URL.`,
        );
      } else {
        toast.success(
          `Imported ${result.created} new model(s) — ${result.total} available from this provider`,
        );
      }
      invalidate();
    },
    onError: (exc) => toast.error(exc.message),
  });

  const updateCredentials = useMutation({
    mutationFn: () =>
      api.updateProvider(providerId, {
        ...(credApiKey.trim() ? { api_key: credApiKey.trim() } : {}),
        ...(credBaseUrl.trim() ? { base_url: credBaseUrl.trim() } : {}),
      }),
    onSuccess: () => {
      toast.success("Credentials saved — live on the next request");
      setCredApiKey("");
      invalidate();
    },
    onError: (exc) => toast.error(exc.message),
  });

  const clearCredentials = useMutation({
    mutationFn: () => api.updateProvider(providerId, { api_key: "", base_url: "" }),
    onSuccess: () => {
      toast.success("Credentials cleared");
      setCredApiKey("");
      setCredBaseUrl("");
      invalidate();
    },
    onError: (exc) => toast.error(exc.message),
  });

  // ── Add model form state ─────────────────────────────────────────────
  const [newModelId, setNewModelId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newOrder, setNewOrder] = useState("0");

  const createModel = useMutation({
    mutationFn: () =>
      api.createModel(providerId, {
        id: newModelId.trim(),
        label: newLabel.trim(),
        sort_order: Number(newOrder) || 0,
      }),
    onSuccess: (model) => {
      toast.success(`Model "${model.label}" added — live in the console now`);
      setNewModelId("");
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
  const [editInputPrice, setEditInputPrice] = useState("");
  const [editOutputPrice, setEditOutputPrice] = useState("");

  const updateModel = useMutation({
    mutationFn: (input: {
      id: string;
      label?: string;
      sort_order?: number;
      enabled?: boolean;
      input_price?: number | null;
      output_price?: number | null;
    }) => api.updateModel(input.id, input),
    onSuccess: () => {
      toast.success("Model updated");
      setEditingId(null);
      invalidate();
    },
    onError: (exc) => toast.error(exc.message),
  });

  const deleteModel = useMutation({
    mutationFn: (id: string) => api.deleteModel(id),
    onSuccess: () => {
      toast.success("Model deleted");
      invalidate();
    },
    onError: (exc) => toast.error(exc.message),
  });

  function startEdit(model: CatalogModel) {
    setEditingId(model.id);
    setEditLabel(model.label);
    setEditOrder(String(model.sort_order));
    setEditInputPrice(model.input_price !== null ? String(model.input_price) : "");
    setEditOutputPrice(model.output_price !== null ? String(model.output_price) : "");
  }

  if (providers.isPending) {
    return <p className="text-sm text-[var(--ink-tertiary)]">Loading…</p>;
  }

  if (!provider) {
    return (
      <div className="space-y-3">
        <BackLink />
        <p className="text-sm text-[var(--danger)]">
          Provider <code>{providerId}</code> not found.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <BackLink />
        <div className="mt-3 flex items-center gap-3">
          <h1 className="text-xl font-semibold">{provider.label}</h1>
          <code className="rounded bg-[var(--surface-strong)] px-1.5 py-0.5 text-xs">
            {provider.id}
          </code>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              provider.enabled
                ? "bg-[var(--ok-soft)] text-[var(--ok)]"
                : "bg-[var(--muted-soft)] text-[var(--muted)]"
            }`}
          >
            {provider.enabled ? "Visible" : "Hidden"}
          </span>
        </div>
        <p className="mt-1 text-sm text-[var(--ink-tertiary)]">
          Models appear in the main console's Connect Model dropdown the
          moment you save.
        </p>
      </div>

      {/* ── Provider credentials ──────────────────────────────────────── */}
      <section className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--panel)] p-5">
        <h2 className="text-sm font-semibold">Gateway credentials</h2>
        <p className="mt-1 text-sm text-[var(--ink-secondary)]">
          {provider.has_credentials
            ? "This provider is served by the gateway with the key below."
            : "Add an API key and base URL to make this provider callable through the gateway — no .env change needed."}
        </p>

        {provider.has_credentials ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <span className="rounded-full bg-[var(--ok-soft)] px-2 py-0.5 text-xs font-medium text-[var(--ok)]">
              Live
            </span>
            <code className="text-xs text-[var(--ink-secondary)]">
              {provider.api_key_masked}
            </code>
            {provider.base_url ? (
              <code className="text-xs text-[var(--ink-tertiary)]">{provider.base_url}</code>
            ) : null}
            <button
              type="button"
              onClick={() => syncProvider.mutate()}
              disabled={syncProvider.isPending}
              className="ml-auto flex items-center gap-1.5 rounded-[10px] border border-[var(--line)] px-3 py-1.5 text-xs hover:bg-[var(--panel)] disabled:opacity-60"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${syncProvider.isPending ? "animate-spin" : ""}`} />
              {syncProvider.isPending ? "Importing…" : "Import live models"}
            </button>
            <button
              type="button"
              onClick={() => clearCredentials.mutate()}
              disabled={clearCredentials.isPending}
              className="rounded-[10px] border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--danger)] hover:bg-[var(--danger-soft)] disabled:opacity-60"
            >
              Clear
            </button>
          </div>
        ) : null}

        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            updateCredentials.mutate();
          }}
        >
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--ink-secondary)]">
              API key {provider.has_credentials ? <span className="font-normal text-[var(--ink-tertiary)]">(leave blank to keep)</span> : null}
            </label>
            <input
              value={credApiKey}
              onChange={(e) => setCredApiKey(e.target.value)}
              placeholder={provider.api_key_masked ?? "gsk_… / sk-…"}
              type="password"
              autoComplete="off"
              className="w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--ink-secondary)]">Base URL</label>
            <input
              value={credBaseUrl}
              onChange={(e) => setCredBaseUrl(e.target.value)}
              placeholder={provider.base_url ?? "https://api.groq.com/openai/v1"}
              className="w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
            />
          </div>
          <button
            type="submit"
            disabled={updateCredentials.isPending || (!credApiKey.trim() && !credBaseUrl.trim())}
            className="rounded-[var(--radius-md)] bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            {provider.has_credentials ? "Update" : "Save credentials"}
          </button>
        </form>
      </section>

      {/* ── Add model ────────────────────────────────────────────────── */}
      <section className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--panel)] p-5">
        <h2 className="text-sm font-semibold">Add model</h2>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            createModel.mutate();
          }}
        >
          <div className="space-y-1">
            <label className="text-xs text-[var(--ink-tertiary)]">Model ID</label>
            <input
              value={newModelId}
              onChange={(e) => setNewModelId(e.target.value)}
              placeholder={`${providerId}/my-model`}
              required
              className="w-72 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
            />
            <p className="text-xs text-[var(--ink-tertiary)]">
              Must start with <code>{providerId}/</code>
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[var(--ink-tertiary)]">Label</label>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="My Model"
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
            disabled={createModel.isPending}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Add model
          </button>
        </form>
      </section>

      {/* ── Models table ─────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--panel)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--surface)] text-left text-xs text-[var(--ink-tertiary)]">
              <th className="px-4 py-3 font-medium">Model ID</th>
              <th className="px-4 py-3 font-medium">Label</th>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">
                Price / 1K <span className="font-normal text-[var(--ink-tertiary)]">(in / out)</span>
              </th>
              <th className="px-4 py-3 font-medium">Visible</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {provider.models.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--ink-tertiary)]">
                  No models yet — add the first one above.
                </td>
              </tr>
            ) : null}
            {provider.models.map((model) => (
              <tr
                key={model.id}
                className="border-b border-[var(--line-soft)] last:border-0"
              >
                {editingId === model.id ? (
                  <>
                    <td className="px-4 py-2">
                      <code className="rounded bg-[var(--surface-strong)] px-1.5 py-0.5 text-xs">
                        {model.id}
                      </code>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="w-full rounded-[var(--radius-md)] border border-[var(--line)] px-2 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editOrder}
                        onChange={(e) => setEditOrder(e.target.value)}
                        type="number"
                        className="w-20 rounded-[var(--radius-md)] border border-[var(--line)] px-2 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          value={editInputPrice}
                          onChange={(e) => setEditInputPrice(e.target.value)}
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="auto"
                          title="USD per 1K input tokens (empty = provider rate)"
                          className="w-24 rounded-[var(--radius-md)] border border-[var(--line)] px-2 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
                        />
                        <span className="text-xs text-[var(--ink-tertiary)]">/</span>
                        <input
                          value={editOutputPrice}
                          onChange={(e) => setEditOutputPrice(e.target.value)}
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="auto"
                          title="USD per 1K output tokens (empty = provider rate)"
                          className="w-24 rounded-[var(--radius-md)] border border-[var(--line)] px-2 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Toggle
                        checked={model.enabled}
                        onChange={(enabled) =>
                          updateModel.mutate({ id: model.id, enabled })
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() =>
                          updateModel.mutate({
                            id: model.id,
                            label: editLabel.trim(),
                            sort_order: Number(editOrder) || 0,
                            input_price: editInputPrice.trim() === "" ? null : Number(editInputPrice),
                            output_price: editOutputPrice.trim() === "" ? null : Number(editOutputPrice),
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
                      <code className="rounded bg-[var(--surface-strong)] px-1.5 py-0.5 text-xs">
                        {model.id}
                      </code>
                    </td>
                    <td className="px-4 py-3 font-medium">{model.label}</td>
                    <td className="px-4 py-3 text-[var(--ink-secondary)]">
                      {model.sort_order}
                    </td>
                    <td className="px-4 py-3">
                      {model.input_price !== null && model.output_price !== null ? (
                        <span className="font-mono text-xs text-[var(--ink)]">
                          ${model.input_price} / ${model.output_price}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--ink-tertiary)]">auto</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Toggle
                        checked={model.enabled}
                        onChange={(enabled) =>
                          updateModel.mutate({ id: model.id, enabled })
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => startEdit(model)}
                        title="Edit"
                        className="mr-1 rounded-[var(--radius-md)] p-1.5 text-[var(--ink-tertiary)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete model "${model.label}"?`)) {
                            deleteModel.mutate(model.id);
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

function BackLink() {
  return (
    <Link
      href="/catalog"
      className="inline-flex items-center gap-1 text-sm text-[var(--ink-tertiary)] hover:text-[var(--ink)]"
    >
      <ArrowLeft className="h-4 w-4" />
      All providers
    </Link>
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
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
        style={{ left: checked ? "18px" : "2px" }}
      />
    </button>
  );
}
