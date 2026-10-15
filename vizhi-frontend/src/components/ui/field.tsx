import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full border border-[var(--line-strong)] bg-[var(--canvas)] px-2.5 text-[13px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-tertiary)] focus:border-[var(--brand-hover)] disabled:opacity-60";

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-[var(--ink-2)]">{children}</label>;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-9", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "vz-select h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 resize-y py-2 leading-relaxed", className)} {...props} />;
}

export function FieldHelp({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-[var(--ink-tertiary)]">{children}</p>;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-[var(--danger)]">{message}</p>;
}
