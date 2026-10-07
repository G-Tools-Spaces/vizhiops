"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { setCurrentUser } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await api.login({ email, password });
      if (session.user.role !== "admin") {
        await api.logout().catch(() => undefined);
        setError("This account does not have admin access.");
        return;
      }
      setCurrentUser(session.user);
      router.replace("/catalog");
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--panel)]">
        <div className="space-y-4 border-b border-[var(--line-soft)] px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand)] text-[var(--brand-ink)]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold">Vizhi Admin</h1>
              <p className="text-sm text-[var(--ink-tertiary)]">
                Sign in with an admin account
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5">
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@company.com"
                required
                className="w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
              />
            </div>
            {error ? (
              <p className="rounded-[var(--radius-md)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </p>
            ) : null}
            <button
              className="w-full rounded-[var(--radius-md)] bg-[var(--brand)] px-3 py-2 text-sm font-medium text-[var(--brand-ink)] transition hover:bg-[var(--brand-hover)] disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-[var(--ink-tertiary)]">
            Accounts are created in the main console and promoted with{" "}
            <code className="rounded bg-[var(--surface-strong)] px-1">make_admin.py</code>
          </p>
        </div>
      </div>
    </main>
  );
}
