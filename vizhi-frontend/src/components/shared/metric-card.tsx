import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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
    <Card>
      <CardContent className="flex min-h-24 items-start gap-3 p-4">
        <span className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-2 text-[var(--ink-secondary)]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">{label}</p>
          <p className="mt-1 text-xl font-semibold text-[var(--ink)]">{value}</p>
          <p className="mt-0.5 text-xs text-[var(--ink-tertiary)]">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
