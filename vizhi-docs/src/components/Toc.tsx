"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * "On this page" rail.
 *
 * The entries are read from the rendered DOM (every docs section and endpoint
 * carries an `id`), so pages need no extra wiring — the rail always matches
 * what is actually on the page. An IntersectionObserver highlights the entry
 * for the section currently being read.
 */

type TocEntry = {
  id: string;
  label: string;
  /** 2 = section heading, 3 = endpoint / sub-item */
  depth: 2 | 3;
};

function collectEntries(): TocEntry[] {
  const main = document.querySelector("main");
  if (!main) return [];
  const entries: TocEntry[] = [];
  for (const el of Array.from(main.querySelectorAll<HTMLElement>("[id]"))) {
    const id = el.id;
    if (!id) continue;
    const h2 = el.tagName === "H2" ? el : el.querySelector("h2");
    if (h2) {
      entries.push({ id, label: h2.textContent ?? id, depth: 2 });
      continue;
    }
    // Endpoint blocks: method badge + path in a <code>.
    const code = el.querySelector("code");
    if (code) {
      entries.push({ id, label: code.textContent ?? id, depth: 3 });
    }
  }
  return entries;
}

export function Toc() {
  const pathname = usePathname();
  const [entries, setEntries] = useState<TocEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Re-scan after each navigation (content is streamed, so scan once idle).
  useEffect(() => {
    setEntries([]);
    const frame = requestAnimationFrame(() => {
      setEntries(collectEntries());
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  // Scroll-spy.
  useEffect(() => {
    if (entries.length === 0) return;
    const observer = new IntersectionObserver(
      (observed) => {
        for (const entry of observed) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    for (const entry of entries) {
      const el = document.getElementById(entry.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
        On this page
      </p>
      <ul className="border-l border-line">
        {entries.map((entry) => {
          const active = entry.id === activeId;
          return (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                aria-current={active ? "location" : undefined}
                className={`-ml-px block border-l py-1 pr-2 text-xs transition-colors ${
                  entry.depth === 3 ? "pl-6 font-mono" : "pl-3"
                } ${
                  active
                    ? "border-accent font-medium text-accent"
                    : "border-transparent text-ink-tertiary hover:border-line hover:text-ink"
                }`}
              >
                <span className="line-clamp-1">{entry.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
