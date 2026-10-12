import Link from "next/link";

import { CONSOLE_URL } from "@/lib/config";
import { DocsSearch } from "@/components/Search";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * The docs site's one piece of chrome.
 *
 * It carries the same mark and hairline as the console so the two read as one
 * product, but it is deliberately not the console's sidebar: nothing here is an
 * operation, so there is nothing to navigate between except reading and leaving
 * for the console.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-topbar/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/docs" className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-6 place-items-center rounded-md bg-brand text-[11px] font-bold text-brand-ink"
          >
            V
          </span>
          <span className="text-sm font-medium text-ink">Vizhi</span>
          <span className="rounded border border-line bg-surface px-1.5 py-px text-[11px] font-medium text-ink-tertiary">
            API reference
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <DocsSearch />
          <ThemeToggle />
          <a
            href={CONSOLE_URL}
            className="inline-flex h-[34px] items-center justify-center rounded-md border border-brand bg-brand px-3 text-sm font-medium text-brand-ink transition-colors hover:border-brand-hover hover:bg-brand-hover"
          >
            Open console
          </a>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ink-tertiary sm:px-6">
        <span>Vizhi API reference</span>
        <div className="flex gap-4">
          <Link href="/docs" className="hover:text-ink-secondary">
            API reference
          </Link>
          <a href={CONSOLE_URL} className="hover:text-ink-secondary">
            Console
          </a>
        </div>
      </div>
    </footer>
  );
}
