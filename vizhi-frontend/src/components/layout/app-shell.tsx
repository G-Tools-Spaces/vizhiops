"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
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
    <div className="flex min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <aside className="hidden w-[248px] shrink-0 border-r border-[var(--line)] bg-[var(--panel)] lg:block">
        <div className="flex h-16 items-center border-b border-[var(--line)] px-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[var(--brand)] text-[var(--brand-ink)] shadow-sm">
            <Radar className="h-4 w-4" />
          </span>
            <span>
              <span className="block text-sm font-semibold text-[var(--ink)]">Vizhi</span>
              <span className="block text-xs text-[var(--ink-tertiary)]">Workspace</span>
            </span>
          </Link>
        </div>

        <nav className="overflow-y-auto px-4 py-5">
          {navSections.map((section) => (
            <div key={section.title} className="mb-6 last:mb-0">
              <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-10 items-center gap-3 rounded-[12px] px-3 text-sm transition-colors",
                          active
                            ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                            : "text-[var(--ink-secondary)] hover:bg-[var(--surface)] hover:text-[var(--ink)]",
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
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--panel)]/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-5 md:px-8">
            <nav className="flex min-w-0 items-center gap-1.5 text-sm text-[var(--ink-tertiary)]">
              <span className="font-medium text-[var(--brand)]">Vizhi</span>
              <span className="text-[var(--ink-tertiary)]">/</span>
              {user ? <span className="truncate">{user.email}</span> : null}
              <span className="text-[var(--ink-tertiary)]">/</span>
              <span className="truncate text-[var(--ink)]">{currentLabel}</span>
            </nav>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-xs font-medium text-[var(--ink-secondary)]">
                {user?.email?.slice(0, 1).toUpperCase() ?? "V"}
              </div>
              <Button
                variant="ghost"
                size="icon"
                title="Logout"
                onClick={logout}
                className="rounded-[12px] border border-transparent hover:border-[var(--line)] hover:bg-[var(--surface)]"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="px-5 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
