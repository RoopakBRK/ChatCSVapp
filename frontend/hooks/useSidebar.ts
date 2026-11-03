"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const KEY = "chatcsv.sidebar";
export const SIDEBAR_MIN = 220;
export const SIDEBAR_MAX = 480;
export const SIDEBAR_DEFAULT = 288;
export const SIDEBAR_RAIL = 64; // width when collapsed

type Prefs = { width: number; collapsed: boolean };
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export const clampWidth = (w: number) => Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w)));

/** Width and collapsed state of the history sidebar, remembered between visits. */
export function useSidebar() {
  // The server has no localStorage, so it renders the default; the browser then shows the saved value.
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(KEY) ?? "", () => "");
  const prefs: Prefs = useMemo(() => {
    try {
      const p = JSON.parse(raw) as Partial<Prefs>;
      return { width: clampWidth(Number(p.width) || SIDEBAR_DEFAULT), collapsed: !!p.collapsed };
    } catch {
      return { width: SIDEBAR_DEFAULT, collapsed: false };
    }
  }, [raw]);

  const save = useCallback((next: Prefs) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    listeners.forEach((l) => l());
  }, []);

  return {
    width: prefs.width,
    collapsed: prefs.collapsed,
    setWidth: (width: number) => save({ ...prefs, width: clampWidth(width) }),
    setCollapsed: (collapsed: boolean) => save({ ...prefs, collapsed }),
  };
}
