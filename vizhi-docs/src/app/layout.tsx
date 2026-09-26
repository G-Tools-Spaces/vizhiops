import type { Metadata } from "next";

import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Vizhi API reference",
    template: "%s — Vizhi API",
  },
  description:
    "Vizhi is a unified API gateway and query-tracking core for AI agents. One OpenAI-compatible endpoint routes to every provider, with per-token budgets, automatic fallback, and full request tracing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
