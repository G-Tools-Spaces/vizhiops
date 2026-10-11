"use client";

import { usePathname } from "next/navigation";

import dates from "@/lib/page-dates.generated.json";

type PageDates = Record<string, string>;

/**
 * "Last updated <date>" for the current page, generated from git history at
 * build time (scripts/generate-page-dates.mjs). Pages with no commit history
 * yet render nothing rather than a wrong date.
 */
export function LastUpdated() {
  const pathname = usePathname();
  const iso = (dates as PageDates)[pathname];
  if (!iso) return null;

  const date = new Date(iso);
  const formatted = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <p className="mt-12 border-t border-line-soft pt-3 text-xs text-ink-tertiary">
      Last updated {formatted}
    </p>
  );
}
