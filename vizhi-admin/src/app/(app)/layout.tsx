"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, LogOut, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { clearSession, setCurrentUser } from "@/lib/auth";

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

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/catalog" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand)] text-[var(--brand-ink)]">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="font-semibold">Vizhi Admin</span>
          </Link>
          <nav className="ml-4 flex items-center gap-1">
            <Link
              href="/catalog"
              className={`flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-sm transition ${
                pathname.startsWith("/catalog")
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--ink-secondary)] hover:bg-[var(--surface)]"
              }`}
            >
              <Database className="h-4 w-4" />
              Model Catalog
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-[var(--ink-tertiary)]">{me.data.email}</span>
            <button
              onClick={logout}
              title="Sign out"
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--ink-secondary)] transition hover:bg-[var(--surface)] hover:text-[var(--ink)]"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
