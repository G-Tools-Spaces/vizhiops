"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, MessageSquare, Radar, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";
import { navSections } from "@/components/layout/nav";
import { api } from "@/lib/api/client";
import { clearSession, getStoredUser, setCurrentUser, type AuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

// Flat lookup for the breadcrumb's current-page label.
const pageLabels = new Map<string, string>(
  navSections.flatMap((s) => s.items.map((i) => [i.href, i.label] as const)),
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    async function loadUser() {
      if (user) return;
      try {
        const currentUser = await api.me();
        setCurrentUser(currentUser);
        setUser(currentUser);
      } catch {
        clearSession();
        router.replace("/login");
      }
    }
    loadUser();
  }, [router, user]);

  async function logout() {
    try {
      await api.logout();
    } catch {
      // ignore logout errors and clear local state anyway
    }
    clearSession();
    setUser(null);
    router.replace("/login");
  }

  const currentLabel = pageLabels.get(pathname) ?? "Dashboard";

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-[var(--line)] bg-[var(--panel)] lg:flex">
        <Link href="/dashboard" className="flex h-14 items-center gap-2.5 border-b border-[var(--line)] px-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--brand)] text-[var(--brand-ink)]">
            <Radar className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-[var(--ink)]">Vizhi</span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navSections.map((section) => (
            <div key={section.title} className="mb-5">
              <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-[var(--ink-tertiary)]">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-9 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                          active
                            ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                            : "text-[var(--ink-secondary)] hover:bg-[var(--surface-strong)] hover:text-[var(--ink)]",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-[var(--line)] p-3">
          <a
            href="http://localhost:3001"
            target="_blank"
            rel="noreferrer"
            className="flex h-9 items-center gap-2.5 rounded-md px-2 text-sm text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-strong)] hover:text-[var(--ink)]"
          >
            <MessageSquare className="h-4 w-4" />
            API reference
          </a>
        </div>
      </aside>

      {/* Main column */}
      <div className="lg:pl-60">
        {/* Breadcrumb top bar */}
        <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--panel)]/90 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-6">
            <nav className="flex min-w-0 items-center gap-1.5 text-sm">
              <span className="font-medium text-[var(--ink)]">Vizhi</span>
              <span className="text-[var(--ink-tertiary)]">/</span>
              <span className="truncate text-[var(--ink-secondary)]">{currentLabel}</span>
            </nav>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="hidden h-8 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--surface-strong)] hover:text-[var(--ink-secondary)] sm:flex"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Search…</span>
                <kbd className="rounded border border-[var(--line)] bg-[var(--panel)] px-1 py-px text-[10px] font-medium">
                  ⌘K
                </kbd>
              </button>
              {user ? (
                <span className="hidden max-w-52 truncate text-xs text-[var(--ink-tertiary)] sm:block">
                  {user.email}
                </span>
              ) : null}
              <ThemeToggle />
              <Button variant="ghost" size="icon" title="Logout" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 md:px-6">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
