"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Reactive localStorage read/write.
 *
 * - SSR-safe: the server snapshot is always null.
 * - Reactive across components: writes dispatch a synthetic storage event
 *   (the real event only fires in *other* tabs), so every subscriber
 *   re-renders immediately.
 */
export function useLocalStorage(key: string): [string | null, (value: string | null) => void] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const handler = (event: StorageEvent) => {
        if (event.key === key || event.key === null) onChange();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
    [key],
  );

  const value = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(key),
    () => null,
  );

  const setValue = useCallback(
    (next: string | null) => {
      if (next === null) localStorage.removeItem(key);
      else localStorage.setItem(key, next);
      window.dispatchEvent(new StorageEvent("storage", { key }));
    },
    [key],
  );

  return [value, setValue];
}

const emptySubscribe = () => () => {};

/** True only after client-side mount — use to gate client-only UI. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
