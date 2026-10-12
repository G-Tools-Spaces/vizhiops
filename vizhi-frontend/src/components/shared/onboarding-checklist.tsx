"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CheckCircle2, ChevronRight, Circle, Rocket, X } from "lucide-react";
import { useAgents, useDashboard, useModels } from "@/lib/api/queries";
import { useLocalStorage, useMounted } from "@/lib/use-local-storage";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "vizhi_onboarding_dismissed";
const TRACE_VIEW_KEY = "vizhi_trace_viewed";

export function OnboardingChecklist() {
  // Render nothing until mounted, so returning users never see the card flash.
  const mounted = useMounted();
  const [dismissedRaw, setDismissedRaw] = useLocalStorage(DISMISS_KEY);
  const [traceViewedRaw] = useLocalStorage(TRACE_VIEW_KEY);
  const dismissed = dismissedRaw === "1";
  const traceViewed = traceViewedRaw === "1";

  const { data: models = [] } = useModels();
  const { data: agents = [] } = useAgents();
  const { data: dashboard } = useDashboard();

  const totals = dashboard?.totals;
  const firstTraceId = dashboard?.recentRequests?.[0]?.id;

  const steps = [
    {
      label: "Connect a model",
      description: "Add a provider and generate a model token",
      href: "/models/connect",
      done: models.length > 0,
    },
    {
      label: "Create an agent",
      description: "Issue an API key for your first agent",
      href: "/agents",
      done: agents.length > 0,
    },
    {
      label: "Make your first call",
      description: "Send a request through the gateway",
      href: "/playground",
      done: (totals?.requestsToday ?? 0) > 0 || (totals?.tokensConsumed ?? 0) > 0,
    },
    {
      label: "Inspect a trace",
      description: "Open a request and see the full breakdown",
      href: firstTraceId ? `/traces/${firstTraceId}` : "/monitoring",
      done: traceViewed,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  // Once everything is complete, celebrate silently: persist dismissal and hide.
  useEffect(() => {
    if (allDone && !dismissed) setDismissedRaw("1");
  }, [allDone, dismissed, setDismissedRaw]);

  if (!mounted || dismissed) return null;

  function dismiss() {
    setDismissedRaw("1");
  }

  return (
    <section className="mb-6 rounded-lg border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
            <Rocket className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">Getting started</h2>
            <p className="text-xs text-[var(--ink-tertiary)]">{doneCount} of {steps.length} complete</p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          title="Dismiss"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--surface-strong)] hover:text-[var(--ink)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-[var(--surface-strong)]">
        <div
          className="h-1 rounded-r-full bg-[var(--brand)] transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <ul className="divide-y divide-[var(--line-soft)]">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface)]"
            >
              {step.done ? (
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-[var(--ok)]" />
              ) : (
                <Circle className="h-4.5 w-4.5 shrink-0 text-[var(--ink-tertiary)]" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.done ? "text-[var(--ink-tertiary)] line-through" : "text-[var(--ink)]",
                  )}
                >
                  {step.label}
                </p>
                <p className="truncate text-xs text-[var(--ink-tertiary)]">{step.description}</p>
              </div>
              {!step.done ? (
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ink-tertiary)] transition-transform group-hover:translate-x-0.5" />
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
