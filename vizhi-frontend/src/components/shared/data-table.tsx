"use client";

import {
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Columns3,
  Download,
  LayoutGrid,
  Rows3,
  Search,
  Sheet,
  X,
} from "lucide-react";
import { useLocalStorage } from "@/lib/use-local-storage";
import { cn } from "@/lib/utils";

// ── Cell text helpers ───────────────────────────────────────────────────────

// Pull plain text out of a React cell so rows can be searched, sorted and
// exported. Elements without children fall back to their status/label/value
// prop, so <StatusBadge status="active" /> reads as "active".
function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).filter(Boolean).join(" ");
  if (isValidElement(node)) {
    const props = node.props as Record<string, unknown>;
    const fromChildren = extractText(props.children as ReactNode);
    if (fromChildren) return fromChildren;
    for (const key of ["label", "status", "value", "title"]) {
      if (typeof props[key] === "string" || typeof props[key] === "number") return String(props[key]);
    }
  }
  return "";
}

// "$0.0123", "1,204", "350ms", "98%", "12 tokens" → number; anything else → null.
function toNumber(text: string): number | null {
  const cleaned = text.replace(/[$,%]/g, "").replace(/\s*(ms|tokens?)$/i, "").trim();
  if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

function columnLetter(index: number): string {
  let s = "";
  let n = index + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const formatStat = (n: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: Math.abs(n) < 1 && n !== 0 ? 4 : 2 }).format(n);

// ── Persisted state ─────────────────────────────────────────────────────────

export type TableView = "table" | "sheet" | "cards";
type Sort = { column: string; dir: "asc" | "desc" } | null;
type StoredTableState = { hidden: string[]; query: string; view?: TableView; sort?: Sort };

const VIEWS: { id: TableView; label: string; icon: typeof Rows3 }[] = [
  { id: "table", label: "Table", icon: Rows3 },
  { id: "sheet", label: "Sheet", icon: Sheet },
  { id: "cards", label: "Cards", icon: LayoutGrid },
];

function parseState(raw: string | null): StoredTableState {
  if (!raw) return { hidden: [], query: "" };
  try {
    const parsed = JSON.parse(raw) as Partial<StoredTableState>;
    return {
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
      query: typeof parsed.query === "string" ? parsed.query : "",
      view: VIEWS.some((v) => v.id === parsed.view) ? parsed.view : undefined,
      sort: parsed.sort && typeof parsed.sort.column === "string" ? parsed.sort : null,
    };
  } catch {
    return { hidden: [], query: "" };
  }
}

/** Close a popover on outside click or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

const NO_COLUMNS: string[] = [];

// ── Component ───────────────────────────────────────────────────────────────

export function DataTable({
  headers,
  rows,
  tableId,
  title,
  defaultView = "table",
  defaultHidden = NO_COLUMNS,
  emptyMessage = "No data yet",
}: {
  headers: string[];
  /** One array per row. Cells beyond headers.length render as a full-width row beneath (e.g. an inline panel). */
  rows: ReactNode[][];
  /** Enables persistence: view, sort, column visibility and filter are saved per table. */
  tableId?: string;
  title?: string;
  defaultView?: TableView;
  /** Columns hidden until the user changes the column picker. */
  defaultHidden?: string[];
  emptyMessage?: string;
}) {
  const fallbackKey = `vizhi_table_ephemeral_${useId()}`;
  const [raw, setRaw] = useLocalStorage(tableId ? `vizhi_table_${tableId}` : fallbackKey);
  const saved = useMemo(() => {
    const state = parseState(raw);
    return raw ? state : { ...state, hidden: defaultHidden };
  }, [raw, defaultHidden]);
  const update = (patch: Partial<StoredTableState>) => setRaw(JSON.stringify({ ...saved, ...patch }));

  const view = saved.view ?? defaultView;
  const query = saved.query;
  const hidden = saved.hidden.filter((h) => headers.includes(h));
  const sort = saved.sort && headers.includes(saved.sort.column) ? saved.sort : null;

  const [columnsOpen, setColumnsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const closeColumns = useCallback(() => setColumnsOpen(false), []);
  const closeExport = useCallback(() => setExportOpen(false), []);
  const columnsRef = useDismiss(columnsOpen, closeColumns);
  const exportRef = useDismiss(exportOpen, closeExport);

  // Text of every header cell, computed once per render of `rows`.
  const texts = useMemo(() => rows.map((row) => headers.map((_, i) => extractText(row[i]))), [rows, headers]);

  // A column is numeric when most of its non-empty cells parse as numbers.
  const numericCols = useMemo(
    () =>
      headers.map((header, col) => {
        // Status codes and IDs look numeric but are labels.
        if (/status|\bid\b|code/i.test(header)) return false;
        const values = texts.map((t) => t[col]).filter(Boolean);
        if (!values.length) return false;
        return values.filter((v) => toNumber(v) !== null).length / values.length >= 0.6;
      }),
    [texts, headers],
  );
  // Columns with no text at all (e.g. icon-only action buttons) cannot be sorted.
  const sortableCols = useMemo(
    () => headers.map((h, col) => !/^actions?$/i.test(h) && texts.some((t) => t[col])),
    [texts, headers],
  );

  const visible = headers.map((_, i) => i).filter((i) => !hidden.includes(headers[i]));

  // Filter, then sort; keep the original index so extras and keys follow the row.
  const order = useMemo(() => {
    const q = query.trim().toLowerCase();
    let idx = rows.map((_, i) => i);
    if (q) idx = idx.filter((i) => texts[i].some((t) => t.toLowerCase().includes(q)));
    if (sort) {
      const col = headers.indexOf(sort.column);
      const sign = sort.dir === "asc" ? 1 : -1;
      idx = [...idx].sort((a, b) => {
        const ta = texts[a][col];
        const tb = texts[b][col];
        if (!ta && tb) return 1;
        if (ta && !tb) return -1;
        const na = toNumber(ta);
        const nb = toNumber(tb);
        if (na !== null && nb !== null) return (na - nb) * sign;
        return ta.localeCompare(tb, undefined, { numeric: true, sensitivity: "base" }) * sign;
      });
    }
    return idx;
  }, [rows, texts, query, sort, headers]);

  function toggleSort(col: number) {
    if (!sortableCols[col]) return;
    const column = headers[col];
    if (sort?.column !== column) update({ sort: { column, dir: numericCols[col] ? "desc" : "asc" } });
    else if (sort.dir === (numericCols[col] ? "desc" : "asc")) update({ sort: { column, dir: sort.dir === "asc" ? "desc" : "asc" } });
    else update({ sort: null });
  }

  function toggleColumn(header: string) {
    const next = saved.hidden.includes(header) ? saved.hidden.filter((h) => h !== header) : [...saved.hidden, header];
    update({ hidden: next });
  }

  function download(extension: "csv" | "json") {
    let content: string;
    if (extension === "csv") {
      const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
      content = [
        visible.map((i) => escape(headers[i])).join(","),
        ...order.map((r) => visible.map((i) => escape(texts[r][i])).join(",")),
      ].join("\n");
    } else {
      content = JSON.stringify(
        order.map((r) => Object.fromEntries(visible.map((i) => [headers[i], texts[r][i]]))),
        null,
        2,
      );
    }
    const url = URL.createObjectURL(new Blob([content], { type: extension === "csv" ? "text/csv" : "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${tableId ?? "table"}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  }

  const tool =
    "flex h-8 items-center gap-1.5 border border-[var(--line-strong)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-strong)] hover:text-[var(--ink)]";
  const menu = "absolute right-0 z-30 mt-1 min-w-44 border border-[var(--line-strong)] bg-[var(--panel)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)]";

  const empty = (
    <div className="px-4 py-12 text-center text-[13px] text-[var(--ink-tertiary)]">
      {query ? `No rows match “${query}”` : emptyMessage}
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col border border-[var(--line)] bg-[var(--panel)]">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
        {title ? (
          <h2 className="mr-1 flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
            {title}
            <span className="font-mono text-[11px] font-medium text-[var(--ink-tertiary)]">{order.length}</span>
          </h2>
        ) : null}
        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-tertiary)]" />
          <input
            value={query}
            onChange={(event) => update({ query: event.target.value })}
            placeholder="Filter rows…"
            className="h-8 w-full border border-[var(--line-strong)] bg-[var(--canvas)] pl-8 pr-7 text-xs text-[var(--ink)] outline-none placeholder:text-[var(--ink-tertiary)] focus:border-[var(--brand-hover)]"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear filter"
              onClick={() => update({ query: "" })}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-[var(--ink-tertiary)] hover:text-[var(--ink)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* View switcher */}
          <div role="group" aria-label="View" className="flex border border-[var(--line-strong)]">
            {VIEWS.map(({ id, label, icon: Icon }, i) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                title={`${label} view`}
                onClick={() => update({ view: id })}
                className={cn(
                  "flex h-[30px] items-center gap-1.5 px-2.5 text-xs font-semibold transition-colors",
                  i > 0 && "border-l border-[var(--line-strong)]",
                  view === id
                    ? "bg-[var(--chip)] text-[var(--ink)]"
                    : "bg-[var(--surface)] text-[var(--ink-tertiary)] hover:text-[var(--ink)]",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", view === id && "text-[var(--accent)]")} />
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </div>

          <div className="relative" ref={columnsRef}>
            <button type="button" className={tool} onClick={() => setColumnsOpen((v) => !v)} aria-expanded={columnsOpen}>
              <Columns3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Columns</span>
              {hidden.length > 0 ? (
                <span className="font-mono text-[10px] text-[var(--accent)]">
                  {headers.length - hidden.length}/{headers.length}
                </span>
              ) : null}
            </button>
            {columnsOpen ? (
              <div className={menu}>
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-tertiary)]">
                  Columns
                </p>
                {headers.map((header) => {
                  const shown = !hidden.includes(header);
                  return (
                    <label
                      key={header}
                      className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-[13px] text-[var(--ink-2)] hover:bg-[var(--surface-strong)]"
                    >
                      <input
                        type="checkbox"
                        checked={shown}
                        onChange={() => toggleColumn(header)}
                        className="h-3.5 w-3.5 accent-[var(--brand)]"
                      />
                      <span className={cn(!shown && "text-[var(--ink-tertiary)]")}>{header}</span>
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="relative" ref={exportRef}>
            <button type="button" className={tool} onClick={() => setExportOpen((v) => !v)} aria-expanded={exportOpen}>
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {exportOpen ? (
              <div className={menu}>
                {(["csv", "json"] as const).map((ext) => (
                  <button
                    key={ext}
                    type="button"
                    onClick={() => download(ext)}
                    className="flex w-full items-center justify-between gap-6 px-3 py-2 text-left text-[13px] text-[var(--ink-2)] hover:bg-[var(--surface-strong)] hover:text-[var(--ink)]"
                  >
                    {ext === "csv" ? "Download CSV" : "Download JSON"}
                    <span className="font-mono text-[11px] text-[var(--ink-tertiary)]">.{ext}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {view === "table" ? (
        <ListView
          headers={headers}
          rows={rows}
          order={order}
          visible={visible}
          numericCols={numericCols}
          sortableCols={sortableCols}
          sort={sort}
          onSort={toggleSort}
          empty={empty}
        />
      ) : view === "sheet" ? (
        <SheetView
          headers={headers}
          rows={rows}
          texts={texts}
          order={order}
          visible={visible}
          numericCols={numericCols}
          sortableCols={sortableCols}
          sort={sort}
          onSort={toggleSort}
          empty={empty}
        />
      ) : (
        <CardsView headers={headers} rows={rows} order={order} visible={visible} empty={empty} />
      )}
    </div>
  );
}

// ── Shared header cell ──────────────────────────────────────────────────────

function SortLabel({ label, active, dir }: { label: ReactNode; active: boolean; dir?: "asc" | "desc" }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      {active ? (
        dir === "asc" ? (
          <ArrowUp className="h-3 w-3 text-[var(--accent)]" />
        ) : (
          <ArrowDown className="h-3 w-3 text-[var(--accent)]" />
        )
      ) : null}
    </span>
  );
}

type ViewProps = {
  headers: string[];
  rows: ReactNode[][];
  order: number[];
  visible: number[];
  empty: ReactNode;
};

type GridProps = ViewProps & {
  numericCols: boolean[];
  sortableCols: boolean[];
  sort: Sort;
  onSort: (col: number) => void;
};

// ── Table view: the clean default list ──────────────────────────────────────

function ListView({ headers, rows, order, visible, numericCols, sortableCols, sort, onSort, empty }: GridProps) {
  if (!order.length) return <>{empty}</>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-[var(--surface)] text-left">
            {visible.map((i) => (
              <th
                key={headers[i]}
                aria-sort={sort?.column === headers[i] ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                className={cn(
                  "whitespace-nowrap border-b border-[var(--line)] px-[18px] py-2.5 text-xs font-semibold text-[var(--ink-secondary)]",
                  numericCols[i] && "text-right",
                )}
              >
                {sortableCols[i] ? (
                  <button type="button" onClick={() => onSort(i)} className="hover:text-[var(--ink)]">
                    <SortLabel label={headers[i]} active={sort?.column === headers[i]} dir={sort?.dir} />
                  </button>
                ) : (
                  headers[i]
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {order.map((r) => (
            <Fragment key={r}>
              <tr className="transition-colors hover:bg-[var(--surface)]">
                {visible.map((i) => (
                  <td
                    key={i}
                    className={cn(
                      "whitespace-nowrap border-b border-[var(--line-soft)] px-[18px] py-[11px] align-middle text-[var(--ink-2)]",
                      numericCols[i] && "text-right font-mono text-xs tabular-nums",
                    )}
                  >
                    {rows[r][i]}
                  </td>
                ))}
              </tr>
              {rows[r].slice(headers.length).map((node, x) =>
                node ? (
                  <tr key={`x${x}`} className="bg-[var(--surface)]">
                    <td colSpan={visible.length} className="border-b border-[var(--line-soft)] p-0">
                      {node}
                    </td>
                  </tr>
                ) : null,
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Sheet view: spreadsheet grid for analysis ───────────────────────────────

function SheetView({
  headers,
  rows,
  texts,
  order,
  visible,
  numericCols,
  sortableCols,
  sort,
  onSort,
  empty,
}: GridProps & { texts: string[][] }) {
  // Selection is by position in the current (filtered, sorted) grid.
  const [sel, setSel] = useState<{ row: number; col: number } | null>(null);
  const row = sel && sel.row < order.length ? sel.row : null;
  const col = sel && sel.col < visible.length ? sel.col : null;
  const active = row !== null && col !== null;
  const dataCol = col !== null ? visible[col] : null;

  // Excel-style status bar for the selected column.
  const stats = useMemo(() => {
    if (dataCol === null) return null;
    const values = order.map((r) => texts[r][dataCol]).filter(Boolean);
    if (numericCols[dataCol]) {
      const nums = values.map(toNumber).filter((n): n is number => n !== null);
      if (!nums.length) return null;
      const sum = nums.reduce((a, b) => a + b, 0);
      return [
        ["Count", nums.length],
        ["Sum", sum],
        ["Avg", sum / nums.length],
        ["Min", Math.min(...nums)],
        ["Max", Math.max(...nums)],
      ] as const;
    }
    return [
      ["Count", values.length],
      ["Unique", new Set(values).size],
    ] as const;
  }, [dataCol, order, texts, numericCols]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!order.length || !visible.length) return;
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      const r = Math.max(0, Math.min(order.length - 1, (row ?? 0) + (active ? move[0] : 0)));
      const c = Math.max(0, Math.min(visible.length - 1, (col ?? 0) + (active ? move[1] : 0)));
      setSel({ row: r, col: c });
    } else if (event.key === "Escape") {
      setSel(null);
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c" && active) {
      navigator.clipboard?.writeText(texts[order[row]][visible[col]]);
    }
  }

  if (!order.length) return <>{empty}</>;

  const cellRef = active ? `${columnLetter(col)}${row + 1}` : "";
  const cellText = active ? texts[order[row]][visible[col]] : "";

  return (
    <div className="flex min-w-0 flex-col">
      {/* Formula bar: full value of the selected cell. */}
      <div className="flex h-8 items-stretch border-b border-[var(--line)] text-xs">
        <span className="flex w-16 shrink-0 items-center justify-center border-r border-[var(--line)] bg-[var(--surface)] font-mono text-[var(--ink-secondary)]">
          {cellRef || "—"}
        </span>
        <span className="flex items-center border-r border-[var(--line)] px-2 font-mono italic text-[var(--ink-tertiary)]">fx</span>
        <span className="flex min-w-0 flex-1 items-center truncate px-3 font-mono text-[var(--ink-2)]" title={cellText}>
          {active ? cellText || <span className="text-[var(--ink-tertiary)]">(empty)</span> : (
            <span className="text-[var(--ink-tertiary)]">Select a cell · arrow keys to move · ⌘/Ctrl+C to copy</span>
          )}
        </span>
      </div>

      <div
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="max-h-[70vh] overflow-auto outline-none focus-visible:outline-none"
      >
        <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 w-11 min-w-11 border-b border-r border-[var(--line-strong)] bg-[var(--surface-strong)]" />
              {visible.map((i, c) => (
                <th
                  key={headers[i]}
                  className={cn(
                    "min-w-28 border-b border-r border-[var(--line-strong)] bg-[var(--surface-strong)] px-2.5 py-1.5 text-left font-semibold text-[var(--ink-secondary)]",
                    numericCols[i] && "text-right",
                    col === c && "bg-[var(--accent-soft)] text-[var(--ink)]",
                  )}
                >
                  <button
                    type="button"
                    disabled={!sortableCols[i]}
                    onClick={() => onSort(i)}
                    className={cn("flex w-full items-center gap-2", numericCols[i] && "flex-row-reverse", sortableCols[i] && "hover:text-[var(--ink)]")}
                  >
                    <span className="font-mono text-[10px] font-medium text-[var(--ink-tertiary)]">{columnLetter(c)}</span>
                    <SortLabel label={headers[i]} active={sort?.column === headers[i]} dir={sort?.dir} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.map((r, rowPos) => (
              <Fragment key={r}>
                <tr>
                  <td
                    className={cn(
                      "sticky left-0 z-[5] border-b border-r border-[var(--line-strong)] bg-[var(--surface)] px-2 text-center font-mono text-[11px] text-[var(--ink-tertiary)]",
                      row === rowPos && "bg-[var(--accent-soft)] text-[var(--ink)]",
                    )}
                  >
                    {rowPos + 1}
                  </td>
                  {visible.map((i, c) => {
                    const selected = row === rowPos && col === c;
                    return (
                      <td
                        key={i}
                        onClick={() => setSel({ row: rowPos, col: c })}
                        className={cn(
                          "h-8 max-w-[320px] cursor-cell truncate border-b border-r border-[var(--line)] px-2.5 align-middle text-[var(--ink-2)]",
                          numericCols[i] && "text-right font-mono tabular-nums",
                          (row === rowPos || col === c) && "bg-[var(--surface)]",
                          selected && "bg-[var(--accent-soft)] shadow-[inset_0_0_0_2px_var(--brand-hover)]",
                        )}
                      >
                        {rows[r][i]}
                      </td>
                    );
                  })}
                </tr>
                {rows[r].slice(headers.length).map((node, x) =>
                  node ? (
                    <tr key={`x${x}`}>
                      <td colSpan={visible.length + 1} className="border-b border-[var(--line)] bg-[var(--surface)] p-0">
                        {node}
                      </td>
                    </tr>
                  ) : null,
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink-tertiary)]">
        <span>
          {order.length} row{order.length === 1 ? "" : "s"} · {visible.length} col{visible.length === 1 ? "" : "s"}
        </span>
        {dataCol !== null && stats ? (
          <>
            <span className="text-[var(--ink-secondary)]">{headers[dataCol]}</span>
            {stats.map(([label, value]) => (
              <span key={label}>
                {label} <span className="text-[var(--ink)]">{formatStat(value)}</span>
              </span>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── Cards view: one box per row ─────────────────────────────────────────────

function CardsView({ headers, rows, order, visible, empty }: ViewProps) {
  if (!order.length) return <>{empty}</>;

  const actionsCol = visible.find((i) => /^actions?$/i.test(headers[i]));
  const statusCol = visible.find((i) => /^status$/i.test(headers[i]));
  const titleCol = visible.find((i) => i !== actionsCol && i !== statusCol);
  const fields = visible.filter((i) => i !== actionsCol && i !== statusCol && i !== titleCol);

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-4">
      {order.map((r) => {
        const extras = rows[r].slice(headers.length).filter(Boolean);
        return (
          <Fragment key={r}>
            <article className="flex min-w-0 flex-col border border-[var(--line)] bg-[var(--canvas)] transition-colors hover:border-[var(--line-strong)]">
              <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
                <div className="min-w-0 text-sm font-semibold text-[var(--ink)]">
                  {titleCol !== undefined ? rows[r][titleCol] : null}
                </div>
                {statusCol !== undefined ? <div className="shrink-0">{rows[r][statusCol]}</div> : null}
              </header>
              <dl className="flex-1">
                {fields.map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-4 border-b border-[var(--line-soft)] px-4 py-2 text-[13px] last:border-b-0"
                  >
                    <dt className="shrink-0 text-xs text-[var(--ink-tertiary)]">{headers[i]}</dt>
                    <dd className="min-w-0 truncate text-right text-[var(--ink-2)]">{rows[r][i] ?? "—"}</dd>
                  </div>
                ))}
              </dl>
              {actionsCol !== undefined ? (
                <footer className="flex justify-end border-t border-[var(--line)] px-3 py-2">{rows[r][actionsCol]}</footer>
              ) : null}
            </article>
            {extras.map((node, x) => (
              <div key={`x${x}`} className="col-span-full border border-[var(--line)] bg-[var(--surface)]">
                {node}
              </div>
            ))}
          </Fragment>
        );
      })}
    </div>
  );
}
