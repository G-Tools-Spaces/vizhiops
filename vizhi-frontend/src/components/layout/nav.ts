import {
  Activity,
  Bot,
  GitBranch,
  Heart,
  Home,
  KeyRound,
  MessageSquare,
  PlusCircle,
  Shield,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
export type NavSection = { title: string; items: NavItem[] };

export const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: Home }],
  },
  {
    title: "Models",
    items: [
      { href: "/models/connect", label: "Connect Model", icon: PlusCircle },
      { href: "/models/tokens", label: "Model Tokens", icon: KeyRound },
    ],
  },
  {
    title: "Agents",
    items: [
      { href: "/agents", label: "Agents", icon: Bot },
      { href: "/agents/tokens", label: "Agent Tokens", icon: Shield },
      { href: "/links", label: "Links", icon: GitBranch },
    ],
  },
  {
    title: "Observe",
    items: [
      { href: "/monitoring", label: "Monitoring", icon: Activity },
      { href: "/playground", label: "Playground", icon: MessageSquare },
      { href: "/health", label: "Provider Health", icon: Heart },
    ],
  },
];

const allItems = navSections.flatMap((section) => section.items);

/** The nav entry a route belongs to: longest href that prefixes the path. */
export function activeNavHref(pathname: string): string | undefined {
  return allItems
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/** Breadcrumb label for any route, including detail pages. */
export function pageLabel(pathname: string): string {
  if (pathname.startsWith("/traces/")) return "Request Trace";
  if (/^\/models\/tokens\/[^/]+/.test(pathname)) return "Model Usage";
  const href = activeNavHref(pathname);
  return allItems.find((item) => item.href === href)?.label ?? "Dashboard";
}
