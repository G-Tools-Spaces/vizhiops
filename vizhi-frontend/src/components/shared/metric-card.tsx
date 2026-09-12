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
      <CardContent className="flex min-h-28 items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
          <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">{hint}</p>
        </div>
        <span className="rounded-md border border-white/10 bg-white/[0.06] p-2 text-[var(--accent)]">
          <Icon className="h-4 w-4" />
        </span>
      </CardContent>
    </Card>
  );
}
