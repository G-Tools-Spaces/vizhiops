"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The reference's sidebar.
 *
 * Ordered the way a reader builds understanding: first how to get in and make
 * a call, then the resources a call touches, then the read-only observability
 * endpoints, then the reference tables that apply to everything.
 */

const SECTIONS: { title: string; items: { href: string; label: string }[] }[] = [
  {
    title: "Getting started",
    items: [
      { href: "/docs", label: "Overview" },
      { href: "/docs/quickstart", label: "Quickstart" },
      { href: "/docs/authentication", label: "Authentication" },
    ],
  },
  {
    title: "Core resources",
    items: [
      { href: "/docs/chat", label: "Chat completions" },
      { href: "/docs/models", label: "Model tokens" },
      { href: "/docs/agents", label: "Agents" },
      { href: "/docs/agent-queue", label: "Agent queue" },
    ],
  },
  {
    title: "Observability",
    items: [
      { href: "/docs/queries", label: "Queries" },
      { href: "/docs/metrics", label: "Metrics" },
      { href: "/docs/dashboard", label: "Dashboard" },
      { href: "/docs/health", label: "Provider health" },
    ],
  },
  {
    title: "Reference",
    items: [
      { href: "/docs/reference", label: "Endpoint index" },
      { href: "/docs/errors", label: "Errors" },
      { href: "/docs/changelog", label: "Changelog" },
    ],
  },
];

export function DocsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation" className="text-sm">
      {SECTIONS.map((section) => (
        <div key={section.title} className="mb-5">
          <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
            {section.title}
          </p>
          <ul>
            {section.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`mb-0.5 block rounded-md px-3 py-1.5 transition-colors ${
                      active
                        ? "bg-accent-soft font-medium text-accent"
                        : "text-ink-secondary hover:bg-topbar-hover hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
