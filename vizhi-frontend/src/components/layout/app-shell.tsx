"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogOut, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";
import { activeNavHref, navSections, pageLabel } from "@/components/layout/nav";
import { api } from "@/lib/api/client";
import { clearSession, getStoredUser, setCurrentUser, type AuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

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

  // Close the account menu on outside click / Escape.
  useEffect(() => {
    if (!accountOpen) return;
    function onClick(event: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  async function logout() {
    setAccountOpen(false);
    try {
      await api.logout();
    } catch {
      // ignore logout errors and clear local state anyway
    }
    clearSession();
    setUser(null);
    router.replace("/login");
  }

  const activeHref = activeNavHref(pathname);
  const initials = (user?.name || user?.email || "V")
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex min-h-[var(--topbar-h)] flex-wrap items-center justify-between gap-2.5 border-b border-[var(--line)] bg-[var(--canvas)] px-4 py-1.5">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-[13px]">
          <Link href="/dashboard" className="flex items-center gap-2 py-1.5 pr-2 font-bold tracking-tight text-[var(--ink)]">
            <span className="flex h-[22px] w-[22px] items-center justify-center bg-[var(--brand)] text-xs font-bold text-[var(--brand-ink)]">
              V
            </span>
            Vizhi
          </Link>
          <span aria-hidden className="px-0.5 text-base text-[var(--divider)]">
            /
          </span>
          <span className="truncate px-1 font-semibold text-[var(--ink)]">{pageLabel(pathname)}</span>
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2.5 border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--ink-secondary)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden border border-[var(--line-strong)] px-1 font-mono text-[11px] sm:inline">⌘K</kbd>
          </button>
          <a
            href="http://localhost:3001/docs"
            target="_blank"
            rel="noreferrer"
            className="hidden px-2.5 py-1.5 text-[13px] font-medium text-[var(--ink-2)] transition-colors hover:text-[var(--ink)] md:inline"
          >
            Docs
          </a>
          <ThemeToggle />
          <div ref={accountRef} className="relative">
            <button
              type="button"
              aria-label="Account menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((v) => !v)}
              className="flex h-[30px] w-[30px] items-center justify-center border border-[var(--line-strong)] bg-[var(--chip)] text-[11px] font-bold text-[var(--ink)]"
            >
              {initials || "V"}
            </button>
            {accountOpen ? (
              <div className="absolute right-0 top-[calc(100%+4px)] z-40 min-w-60 border border-[var(--line-strong)] bg-[var(--panel)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
                <div className="px-3 py-2">
                  <p className="text-[13px] font-semibold text-[var(--ink)]">{user?.name || user?.email || "Signed in"}</p>
                  {user?.name ? <p className="mt-0.5 text-xs text-[var(--ink-tertiary)]">{user.email}</p> : null}
                </div>
                <div className="my-1 h-px bg-[var(--line)]" />
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-[var(--ink-2)] hover:bg-[var(--surface-strong)] hover:text-[var(--ink)]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row">
        {/* ── Sidebar (tab strip below lg) ──────────────────────────────── */}
        <aside className="border-b border-[var(--line)] bg-[var(--sidebar)] lg:sticky lg:top-[var(--topbar-h)] lg:h-[calc(100vh-var(--topbar-h))] lg:w-[240px] lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="hidden items-center gap-2.5 px-4 pb-1 pt-5 lg:flex">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center bg-[var(--brand)] text-[13px] font-bold text-[var(--brand-ink)]">
              V
            </span>
            <span className="flex min-w-0 flex-col gap-[3px]">
              <span className="truncate text-sm font-bold tracking-tight text-[var(--ink)]">Vizhi</span>
              <span className="flex items-center gap-1.5">
                <span className="border border-[var(--ok-border)] px-[5px] py-px text-[10px] font-bold tracking-wider text-[var(--ok)]">
                  LIVE
                </span>
                <span className="font-mono text-[11px] text-[var(--ink-tertiary)]">gateway</span>
              </span>
            </span>
          </div>

          <nav
            aria-label="Main navigation"
            className="flex overflow-x-auto [scrollbar-width:none] lg:flex-col lg:gap-[18px] lg:overflow-visible lg:py-4"
          >
            {navSections.map((section) => (
              <div key={section.title} className="flex lg:flex-col">
                <p className="hidden px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-tertiary)] lg:block">
                  {section.title}
                </p>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.href === activeHref;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 whitespace-nowrap px-3.5 py-3 text-[13px] transition-colors lg:px-4 lg:py-2",
                        active
                          ? "bg-[var(--surface-strong)] font-semibold text-[var(--ink)] shadow-[inset_0_-2px_0_var(--brand-hover)] lg:shadow-[inset_2px_0_0_var(--brand-hover)]"
                          : "font-medium text-[var(--ink-secondary)] hover:bg-[var(--surface)] hover:text-[var(--ink)]",
                      )}
                    >
                      <Icon className={cn("h-4 w-4", active ? "text-[var(--accent)]" : "text-[var(--ink-tertiary)]")} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-14 pt-6 sm:px-6 lg:px-10 lg:pt-8">
          <div className="mx-auto max-w-[1280px]">{children}</div>
        </main>
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
