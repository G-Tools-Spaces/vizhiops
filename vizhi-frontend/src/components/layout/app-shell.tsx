"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  GitBranch,
  Heart,
  Home,
  KeyRound,
  LogOut,
  MessageSquare,
  PlusCircle,
  Radar,
  Search,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { clearSession, getStoredUser, isAuthenticated, setCurrentUser, type AuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/models/connect", label: "Connect Model", icon: PlusCircle },
  { href: "/models/tokens", label: "Model Tokens", icon: KeyRound },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/agents/tokens", label: "Agent Tokens", icon: Shield },
  { href: "/links", label: "Links", icon: GitBranch },
  { href: "/monitoring", label: "Monitoring", icon: Activity },
  { href: "/playground", label: "Playground", icon: MessageSquare },
  { href: "/health", label: "Provider Health", icon: Heart },
];

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

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/10 bg-[#090c11]/95 px-3 py-4 lg:block">
        <Link href="/dashboard" className="flex h-12 items-center gap-3 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--accent)] text-black">
            <Radar className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-base font-semibold">Vizhi</span>
            <span className="block text-xs text-[var(--muted)]">Agent observability</span>
          </span>
        </Link>
        <nav className="mt-6 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm text-[var(--muted)] transition hover:bg-white/[0.06] hover:text-white",
                  active && "bg-white/[0.08] text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#080a0d]/85 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-[var(--muted)] md:max-w-xl">
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">Search agents, model tokens, CIDs, request IDs</span>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <span className="hidden max-w-52 truncate text-xs text-[var(--muted)] sm:block">
                  {user.email}
                </span>
              ) : null}
              <Button variant="secondary" size="sm">
                <Link href="/monitoring">Live</Link>
              </Button>
              <Button variant="ghost" size="icon" title="Logout" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
