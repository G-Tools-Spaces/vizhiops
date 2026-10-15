import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * KPI cell: 12px label, 26px tabular value, 12px hint. Cells sit inside a
 * KpiGrid whose 1px gaps draw the separators.
 */
export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "ok" | "warn" | "danger";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 bg-[var(--panel)] px-[18px] py-4 shadow-[0_0_0_1px_var(--line)]">
      <span className="flex items-center gap-2 text-xs font-semibold text-[var(--ink-secondary)]">
        {Icon ? <Icon className="h-3.5 w-3.5 text-[var(--ink-tertiary)]" /> : null}
        {label}
      </span>
      <span
        className={cn(
          "truncate text-[26px] font-bold leading-none tracking-tight text-[var(--ink)] tabular-nums",
          tone === "ok" && "text-[var(--ok)]",
          tone === "warn" && "text-[var(--warn)]",
          tone === "danger" && "text-[var(--danger)]",
        )}
        title={value}
      >
        {value}
      </span>
      {hint ? <span className="truncate text-xs text-[var(--ink-tertiary)]">{hint}</span> : null}
    </div>
  );
}

/** Hairline grid of KPI cells, as in Ping. Each cell's 1px shadow draws the separators, so empty slots stay blank. */
export function KpiGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-px overflow-hidden border border-[var(--line)] bg-[var(--panel)]",
        className,
      )}
    >
      {children}
    </section>
  );
}
