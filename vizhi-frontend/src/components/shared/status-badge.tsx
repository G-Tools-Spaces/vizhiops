import type { Status } from "@/types/domain";
import { cn } from "@/lib/utils";

const styles: Record<Status, string> = {
  active: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  disabled: "border-white/10 bg-white/5 text-zinc-300",
  error: "border-red-400/25 bg-red-400/10 text-red-200",
  testing: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  archived: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  revoked: "border-rose-500/25 bg-rose-500/10 text-rose-300 line-through",
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={cn("inline-flex rounded-full border px-2 py-1 text-xs capitalize", styles[status])}>{status}</span>;
}
