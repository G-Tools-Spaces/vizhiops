import type { LucideIcon } from "lucide-react";

/**
 * KPI cell — mockup style: #0F0F11 card, 12px 600 label, 26px tabular-nums
 * value, 12px tertiary hint. Cards sit on a 1px-gap grid whose background
 * draws the separators (see the dashboard page's KPI grid wrapper).
 */
export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-[var(--panel)] px-[18px] py-4">
      <span className="flex items-center gap-2 text-xs font-semibold text-[var(--ink-secondary)]">
        <Icon className="h-3.5 w-3.5 text-[var(--ink-tertiary)]" />
        {label}
      </span>
      <span className="text-[26px] font-bold leading-none tracking-tight text-[var(--ink)] tabular-nums">
        {value}
      </span>
      <span className="text-xs text-[var(--ink-tertiary)]">{hint}</span>
    </div>
  );
}
