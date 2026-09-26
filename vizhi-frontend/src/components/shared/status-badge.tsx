import type { Status } from "@/types/domain";
import { cn } from "@/lib/utils";

const styles: Record<Status, string> = {
  active: "border-[var(--ok)]/25 bg-[var(--ok-soft)] text-[var(--ok)]",
  disabled: "border-[var(--line)] bg-[var(--surface-strong)] text-[var(--ink-secondary)]",
  error: "border-[var(--danger)]/25 bg-[var(--danger-soft)] text-[var(--danger)]",
  testing: "border-[var(--info)]/25 bg-[var(--info-soft)] text-[var(--info)]",
  archived: "border-[var(--warn)]/25 bg-[var(--warn-soft)] text-[var(--warn)]",
  revoked: "border-[var(--danger)]/25 bg-[var(--danger-soft)] text-[var(--danger)] line-through",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize", styles[status])}>
      {status}
    </span>
  );
}
