"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Enables class-based light/dark theming. `attribute="class"` puts the theme
 * on `<html>` as `.dark`, which is what the CSS variables in globals.css key
 * off. `disableTransitionOnChange` avoids a flash of animated colour on toggle.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
