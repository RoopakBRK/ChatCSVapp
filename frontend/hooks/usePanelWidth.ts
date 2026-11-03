"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

type Options = { key: string; min: number; max: number; initial: number };
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** A panel width the user can drag, remembered between visits (the sidebar and the canvas use it). */
export function usePanelWidth({ key, min, max, initial }: Options) {
  // The server has no localStorage, so it renders the initial width; the browser then shows the saved one.
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(key) ?? "", () => "");
  const clamp = useCallback((w: number) => Math.round(Math.min(max, Math.max(min, w))), [min, max]);
  const width = useMemo(() => {
    try {
      return clamp(Number((JSON.parse(raw) as { width?: number }).width) || initial);
    } catch {
      return initial;
    }
  }, [raw, clamp, initial]);

  const setWidth = useCallback(
    (w: number) => {
      localStorage.setItem(key, JSON.stringify({ width: clamp(w) }));
      listeners.forEach((l) => l());
    },
    [key, clamp],
  );
  return { width, setWidth, clamp, min, max, initial };
}
