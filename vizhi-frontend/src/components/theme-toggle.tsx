"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

// Subscribe to nothing — this only exists to detect client-side mounting
// without calling setState inside an effect.
const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  // next-themes resolves the theme only on the client (it reads the
  // <html> class / localStorage), so `resolvedTheme` is undefined during
  // SSR. Deriving the title/icon from it directly caused hydration
  // mismatches — the server rendered "Switch to dark mode" while the
  // client (already dark) rendered "Switch to light mode". Render a
  // static placeholder until mounted; the real toggle appears after
  // hydration with zero mismatch.
  const isDark = mounted ? resolvedTheme === "dark" : false;

  return (
    <Button
      variant="ghost"
      size="icon"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted && isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
