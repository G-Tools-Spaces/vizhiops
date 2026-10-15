import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Ping "panel": flat surface, hairline border, square corners.
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-w-0 flex-col border border-[var(--line)] bg-[var(--panel)]", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex min-h-[50px] flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-[18px] py-3", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-sm font-bold text-[var(--ink)]", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-[18px]", className)} {...props} />;
}

/** Label/value row used inside panels (metadata lists, specs). */
export function CardRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--line-soft)] px-[18px] py-[11px] text-[13px] last:border-b-0">
      <span className="shrink-0 text-[var(--ink-secondary)]">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-[var(--ink)]">{children}</span>
    </div>
  );
}
