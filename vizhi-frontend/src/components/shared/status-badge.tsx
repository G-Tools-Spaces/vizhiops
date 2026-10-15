import type { Status } from "@/types/domain";
import { cn } from "@/lib/utils";

// Ping badges: 10px uppercase, 1px border, no fill.
const styles: Record<Status, string> = {
  active: "border-[var(--ok-border)] text-[var(--ok)]",
  disabled: "border-[var(--line-strong)] text-[var(--ink-secondary)]",
  error: "border-[var(--danger-border)] text-[var(--danger)]",
  testing: "border-[var(--info-border)] text-[var(--info)]",
  archived: "border-[var(--warn-border)] text-[var(--warn)]",
  revoked: "border-[var(--danger-border)] text-[var(--danger)] line-through",
};

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  return <Badge className={styles[status]}>{label ?? status}</Badge>;
}

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap border border-[var(--line-strong)] px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-[0.06em] text-[var(--ink-secondary)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
