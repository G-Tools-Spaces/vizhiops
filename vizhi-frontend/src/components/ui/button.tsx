import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Ping-style buttons: square, 1px border, 13px semibold.
const buttonVariants = cva(
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap border px-3.5 text-[13px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)] hover:border-[var(--brand-hover)] hover:bg-[var(--brand-hover)]",
        secondary: "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-strong)]",
        ghost: "border-transparent bg-transparent text-[var(--ink-secondary)] hover:bg-[var(--surface-strong)] hover:text-[var(--ink)]",
        danger: "border-[var(--danger-border)] bg-transparent text-[var(--danger)] hover:bg-[var(--danger-soft)]",
      },
      size: {
        sm: "h-8 px-2.5 text-xs",
        md: "h-9 px-3.5",
        icon: "h-8 w-8 px-0",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

/** Same look as Button, for links that act as buttons. */
export function buttonClass(options: VariantProps<typeof buttonVariants> = {}, className?: string) {
  return cn(buttonVariants(options), className);
}
