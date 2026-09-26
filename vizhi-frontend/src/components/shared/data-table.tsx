"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Columns3, Download, Search } from "lucide-react";
import { useLocalStorage } from "@/lib/use-local-storage";
import { cn } from "@/lib/utils";

// Pull plain text out of a React cell so rows can be searched and exported.
function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).filter(Boolean).join(" ");
  if (typeof node === "object" && "props" in node) {
    return extractText((node.props as { children?: ReactNode }).children);
  }
  return "";
}

type StoredTableState = { hidden: string[]; query: string };

function storageKey(tableId: string) {
  return `vizhi_table_${tableId}`;
}

export function DataTable({
  headers,
  rows,
  tableId,
}: {
  headers: string[];
  rows: ReactNode[][];
  /** Enables persistence: column visibility + search query are saved per table. */
  tableId?: string;
}) {
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);

  // Column visibility + filter query persist in localStorage (reactive via
  // the useLocalStorage hook — no restore/persist effects needed). Tables
  // without a tableId get an ephemeral key, so state lasts for the mount only.
  const fallbackKey = `vizhi_table_ephemeral_${useId()}`;
  const key = tableId ? storageKey(tableId) : fallbackKey;
  const [raw, setRaw] = useLocalStorage(key);

  const saved: StoredTableState = useMemo(() => {
    if (!raw) return { hidden: [], query: "" };
    try {
      const parsed = JSON.parse(raw) as Partial<StoredTableState>;
      return {
        hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
        query: typeof parsed.query === "string" ? parsed.query : "",
      };
    } catch {
      return { hidden: [], query: "" };
    }
  }, [raw]);

  // Validate persisted column names against the current headers.
  const hidden = saved.hidden.filter((h) => headers.includes(h));
  const query = saved.query;

  function update(next: StoredTableState) {
    setRaw(JSON.stringify(next));
  }

  function setQuery(nextQuery: string) {
    update({ hidden: saved.hidden, query: nextQuery });
  }

  // Close the column menu on outside click / Escape.
  useEffect(() => {
    if (!columnsOpen) return;
    function onClick(event: MouseEvent) {
      if (columnsRef.current && !columnsRef.current.contains(event.target as Node)) {
        setColumnsOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setColumnsOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [columnsOpen]);

  const visibleIndexes = headers.map((_, i) => i).filter((i) => !hidden.includes(headers[i]));

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.some((cell) => extractText(cell).toLowerCase().includes(q)));
  }, [rows, query]);

  function toggleColumn(header: string) {
    const next = saved.hidden.includes(header)
      ? saved.hidden.filter((h) => h !== header)
      : [...saved.hidden, header];
    update({ hidden: next, query });
  }

  function download(filename: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [
      visibleIndexes.map((i) => escape(headers[i])).join(","),
      ...filteredRows.map((row) => visibleIndexes.map((i) => escape(extractText(row[i]))).join(",")),
    ];
    download(`${tableId ?? "table"}.csv`, lines.join("\n"), "text/csv");
  }

  function exportJson() {
    const data = filteredRows.map((row) =>
      Object.fromEntries(visibleIndexes.map((i) => [headers[i], extractText(row[i])])),
    );
    download(`${tableId ?? "table"}.json`, JSON.stringify(data, null, 2), "application/json");
  }

  const toolButton =
    "flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2.5 text-xs text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-strong)] hover:text-[var(--ink)]";

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2">
        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-tertiary)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter rows…"
            className="h-8 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] pl-8 pr-2.5 text-xs text-[var(--ink)] outline-none placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)]"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative" ref={columnsRef}>
            <button type="button" className={toolButton} onClick={() => setColumnsOpen((v) => !v)}>
              <Columns3 className="h-3.5 w-3.5" />
              Columns
              {hidden.length > 0 ? (
                <span className="rounded-full bg-[var(--accent-soft)] px-1.5 text-[10px] font-medium text-[var(--accent)]">
                  {headers.length - hidden.length}/{headers.length}
                </span>
              ) : null}
            </button>
            {columnsOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-lg">
                {headers.map((header) => {
                  const visible = !hidden.includes(header);
                  return (
                    <label
                      key={header}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--surface)]"
                    >
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={() => toggleColumn(header)}
                        className="h-3.5 w-3.5 accent-[var(--brand)]"
                      />
                      <span className={cn(!visible && "text-[var(--ink-tertiary)]")}>{header}</span>
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
          <button type="button" className={toolButton} onClick={exportCsv} title="Export visible rows as CSV">
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button type="button" className={toolButton} onClick={exportJson} title="Export visible rows as JSON">
            <Download className="h-3.5 w-3.5" />
            JSON
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-[var(--surface)] text-left text-xs font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">
            <tr>
              {visibleIndexes.map((i) => (
                <th key={headers[i]} className="px-4 py-2.5 font-medium">
                  {headers[i]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line-soft)]">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={visibleIndexes.length} className="px-4 py-10 text-center text-xs text-[var(--ink-tertiary)]">
                  {query ? `No rows match "${query}"` : "No data"}
                </td>
              </tr>
            ) : (
              filteredRows.map((row, index) => (
                <tr key={index} className="transition-colors hover:bg-[var(--surface)]">
                  {visibleIndexes.map((cellIndex) => (
                    <td key={cellIndex} className="px-4 py-3 align-middle text-[var(--ink-secondary)]">
                      {row[cellIndex]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
