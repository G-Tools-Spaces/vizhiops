"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Database,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { clearSession, setCurrentUser } from "@/lib/auth";

const primaryNav = [
  {
    href: "/catalog",
    label: "Catalog",
    icon: Database,
    match: (pathname: string) => pathname.startsWith("/catalog"),
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) {
      clearSession();
      router.replace("/login");
    }
  }, [me.error, router]);

  useEffect(() => {
    if (me.data) {
      setCurrentUser(me.data);
    }
  }, [me.data]);

  async function logout() {
    await api.logout().catch(() => undefined);
    clearSession();
    router.replace("/login");
  }

  if (me.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--ink-tertiary)]">
        Loading…
      </main>
    );
  }

  if (me.data && me.data.role !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--panel)] px-6 py-8 text-center">
          <p className="text-sm font-medium">No admin access</p>
          <p className="mt-1 text-sm text-[var(--ink-tertiary)]">
            {me.data.email} is not an admin account.
          </p>
          <button
            onClick={logout}
            className="mt-5 rounded-[var(--radius-md)] border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--surface)]"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  if (!me.data) {
    // 401 handled by the effect above — render nothing while redirecting.
    return null;
  }

  const pageTitle = pathname.startsWith("/catalog") ? "Catalog" : "Admin";

  return (
    <div className="flex min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <aside className="flex w-[72px] flex-col items-center border-r border-[var(--line)] bg-[var(--panel)] py-4">
        <Link
          href="/catalog"
          className="mb-5 flex h-9 w-9 items-center justify-center rounded-[12px] bg-[var(--brand)] text-[var(--brand-ink)] shadow-sm"
        >
          <ShieldCheck className="h-4 w-4" />
        </Link>

        <nav className="flex flex-1 flex-col items-center gap-2">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <Link
                key={item.label}
                href={item.href}
                title={item.label}
                className={`flex h-9 w-9 items-center justify-center rounded-[12px] border transition ${
                  active
                    ? "border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-transparent text-[var(--ink-tertiary)] hover:border-[var(--line)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                }`}
              >
                <Icon className="h-4 w-4" />
              </Link>
            );
          })}
        </nav>

        <button
          onClick={logout}
          title="Sign out"
          className="mt-4 flex h-9 w-9 items-center justify-center rounded-[12px] border border-transparent text-[var(--ink-tertiary)] transition hover:border-[var(--line)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[var(--line)] bg-[var(--panel)]">
          <div className="flex h-16 items-center justify-between px-8">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--ink-tertiary)]">
                <span className="font-medium text-[var(--brand)]">Vizhi Admin</span>
                <span>/</span>
                <span>{me.data.email}</span>
                <span>/</span>
                <span className="text-[var(--ink)]">{pageTitle}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-xs font-medium text-[var(--ink-secondary)]">
                {me.data.email.slice(0, 1).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
