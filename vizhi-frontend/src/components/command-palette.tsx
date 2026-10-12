"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Command } from "cmdk";
import {
  Activity,
  BookOpen,
  Bot,
  KeyRound,
  LogOut,
  Moon,
  Search,
  Sun,
} from "lucide-react";
import { navSections } from "@/components/layout/nav";
import { useAgents, useDashboard, useModels } from "@/lib/api/queries";
import { api } from "@/lib/api/client";
import { clearSession } from "@/lib/auth";

type PaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: PaletteProps) {
  // Global Cmd/Ctrl+K toggle. The palette content (with its data hooks) is
  // only mounted while open, so nothing polls in the background.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;
  return <PaletteDialog onClose={() => onOpenChange(false)} />;
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState("");

  const { data: agents } = useAgents();
  const { data: models } = useModels();
  const { data: dashboard } = useDashboard();

  function go(href: string) {
    onClose();
    router.push(href);
  }

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
    onClose();
  }

  async function logout() {
    onClose();
    try {
      await api.logout();
    } catch {
      // ignore logout errors and clear local state anyway
    }
    clearSession();
    router.replace("/login");
  }

  const recentTraces = (dashboard?.recentRequests ?? []).slice(0, 8);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[16vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <Command label="Command palette" loop>
          <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-3.5">
            <Search className="h-4 w-4 shrink-0 text-[var(--ink-tertiary)]" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              onKeyDown={(event) => {
                if (event.key === "Escape") onClose();
              }}
              placeholder="Search pages, agents, models, traces…"
              className="h-12 w-full bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-tertiary)]"
            />
            <kbd className="shrink-0 rounded border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-tertiary)]">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-10 text-center text-sm text-[var(--ink-tertiary)]">
              No results for &ldquo;{query}&rdquo;
            </Command.Empty>

            <Command.Group heading={<GroupHeading>Pages</GroupHeading>}>
              {navSections.flatMap((section) =>
                section.items.map((item) => (
                  <PaletteItem
                    key={item.href}
                    icon={item.icon}
                    label={item.label}
                    meta={section.title}
                    keywords={[section.title, item.href]}
                    onSelect={() => go(item.href)}
                  />
                )),
              )}
            </Command.Group>

            {agents && agents.length > 0 ? (
              <Command.Group heading={<GroupHeading>Agents</GroupHeading>}>
                {agents.slice(0, 8).map((agent) => (
                  <PaletteItem
                    key={agent.id}
                    icon={Bot}
                    label={agent.name}
                    meta={agent.cid}
                    keywords={[agent.cid, agent.tokenName ?? "", ...agent.tags]}
                    onSelect={() => go("/agents")}
                  />
                ))}
              </Command.Group>
            ) : null}

            {models && models.length > 0 ? (
              <Command.Group heading={<GroupHeading>Models</GroupHeading>}>
                {models.slice(0, 8).map((model) => (
                  <PaletteItem
                    key={model.id}
                    icon={KeyRound}
                    label={model.modelName}
                    meta={model.provider}
                    keywords={[model.provider, model.tokenName ?? ""]}
                    onSelect={() => go(`/models/tokens/${model.id}`)}
                  />
                ))}
              </Command.Group>
            ) : null}

            {recentTraces.length > 0 ? (
              <Command.Group heading={<GroupHeading>Recent traces</GroupHeading>}>
                {recentTraces.map((trace) => (
                  <PaletteItem
                    key={trace.id}
                    icon={Activity}
                    label={trace.endpoint}
                    meta={String(trace.status)}
                    keywords={[String(trace.status), trace.modelId, trace.agentId]}
                    onSelect={() => go(`/traces/${trace.id}`)}
                  />
                ))}
              </Command.Group>
            ) : null}

            <Command.Group heading={<GroupHeading>Actions</GroupHeading>}>
              <PaletteItem
                icon={resolvedTheme === "dark" ? Sun : Moon}
                label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                keywords={["theme", "dark", "light", "appearance"]}
                onSelect={toggleTheme}
              />
              <PaletteItem
                icon={BookOpen}
                label="Open API reference"
                meta="docs"
                keywords={["docs", "documentation", "api", "reference"]}
                onSelect={() => {
                  onClose();
                  window.open("http://localhost:3001", "_blank", "noreferrer");
                }}
              />
              <PaletteItem
                icon={LogOut}
                label="Log out"
                keywords={["logout", "sign out", "exit"]}
                onSelect={logout}
              />
            </Command.Group>
          </Command.List>

          <div className="flex items-center gap-4 border-t border-[var(--line)] px-3.5 py-2 text-[11px] text-[var(--ink-tertiary)]">
            <span>
              <kbd className="font-medium">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="font-medium">↵</kbd> select
            </span>
            <span>
              <kbd className="font-medium">esc</kbd> close
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--ink-tertiary)]">
      {children}
    </p>
  );
}

type PaletteItemProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  meta?: string;
  keywords?: string[];
  onSelect: () => void;
};

function PaletteItem({ icon: Icon, label, meta, keywords, onSelect }: PaletteItemProps) {
  return (
    <Command.Item
      keywords={keywords}
      onSelect={onSelect}
      className="flex h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm text-[var(--ink-secondary)] transition-colors aria-selected:bg-[var(--accent-soft)] aria-selected:text-[var(--accent)]"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
      {meta ? <span className="ml-auto shrink-0 text-xs text-[var(--ink-tertiary)]">{meta}</span> : null}
    </Command.Item>
  );
}
