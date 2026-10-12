"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, LogOut, Search } from "lucide-react";
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
  const [searchOpen, setSearchOpen] = useState(false);

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

  // ⌘K / Ctrl+K opens the command palette — matches the topbar's Search chip.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
  const initials = (user?.name || user?.email || "V")
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

  return (
    <div className="flex min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      {/* ── Sidebar (232px, mockup: #0C0C0E) ─────────────────────────── */}
      <aside className="hidden w-[232px] shrink-0 flex-col bg-[var(--surface)] lg:flex">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3 text-xs font-semibold text-[var(--ink-secondary)] transition-colors hover:text-[var(--ink)]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>

        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center bg-[var(--brand)] text-[13px] font-bold text-[var(--brand-ink)]">
            V
          </span>
          <span className="flex min-w-0 flex-col gap-[3px]">
            <span className="truncate text-sm font-bold tracking-tight text-[var(--ink)]">
              Vizhi
            </span>
            <span className="flex items-center gap-1.5">
              <span className="border border-[#1f5c46] px-[5px] py-px text-[10px] font-bold tracking-wider text-[var(--ok)]">
                LIVE
              </span>
              <span className="font-mono text-[11px] text-[var(--ink-tertiary)]">
                gateway
              </span>
            </span>
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-[18px] overflow-y-auto pb-4">
          {navSections.map((section) => (
            <div key={section.title} className="flex flex-col">
              <p className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-tertiary)]">
                {section.title}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-2 text-[13px] transition-colors",
                      active
                        ? "bg-[var(--surface-strong)] font-semibold text-[var(--ink)] shadow-[inset_2px_0_0_var(--brand-hover)]"
                        : "font-medium text-[var(--ink-secondary)] hover:text-[var(--ink)]",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        active ? "text-[var(--accent)]" : "text-[var(--ink-tertiary)]",
                      )}
                    />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        {/* ── Topbar (48px, mockup: #0A0A0B) ──────────────────────────── */}
        <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--canvas)]">
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-2.5 px-4">
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-1 text-[13px]"
            >
              <Link
                href="/dashboard"
                className="flex items-center gap-2 pr-2 font-bold tracking-tight text-[var(--ink)]"
              >
                <span className="flex h-[22px] w-[22px] items-center justify-center bg-[var(--brand)] text-xs font-bold text-[var(--brand-ink)]">
                  V
                </span>
                Vizhi
              </Link>
              <span aria-hidden className="px-0.5 text-base text-[#3a3a42]">
                /
              </span>
              <span className="truncate font-semibold text-[var(--ink)]">
                {currentLabel}
              </span>
            </nav>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2.5 border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--ink-secondary)] transition-colors hover:text-[var(--ink)]"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden border border-[var(--line-strong)] px-1 font-mono text-[11px] sm:inline">
                  ⌘K
                </kbd>
              </button>
              <a
                href="http://localhost:3001/docs"
                target="_blank"
                rel="noreferrer"
                className="hidden px-2.5 py-1.5 text-[13px] font-medium text-[#d4d4d8] transition-colors hover:text-[var(--ink)] md:inline"
              >
                Docs
              </a>
              <ThemeToggle />
              <button
                type="button"
                aria-label="Account menu"
                title={user?.email ?? ""}
                className="flex h-[30px] w-[30px] items-center justify-center border border-[var(--line-strong)] bg-[var(--muted-soft)] text-[11px] font-bold text-[var(--ink)]"
              >
                {initials || "V"}
              </button>
              <Button
                variant="ghost"
                size="icon"
                title="Logout"
                onClick={logout}
                className="border border-transparent hover:border-[var(--line)] hover:bg-[var(--surface)]"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="px-6 py-8 md:px-10">{children}</main>
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
