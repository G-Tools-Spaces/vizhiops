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
