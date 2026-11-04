"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const KEY = "chatcsv.results";
export const RESULTS_DEFAULT = 0.45; // share of the chat + results area
export const CHAT_MIN_PX = 420;
export const RESULTS_MIN_PX = 320;

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** The results panel's width as a share of the chat + results area, remembered between visits. */
export function useResultsWidth() {
  // The server has no localStorage, so it renders the default; the browser then shows the saved one.
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(KEY) ?? "", () => "");
  const fraction = useMemo(() => {
    const f = Number(raw);
    return f > 0.1 && f < 0.9 ? f : RESULTS_DEFAULT;
  }, [raw]);
  const setFraction = useCallback((f: number) => {
    localStorage.setItem(KEY, String(Math.round(f * 1000) / 1000));
    listeners.forEach((l) => l());
  }, []);
  return { fraction, setFraction };
}

/** Keep the chat at least 420px and results at least 320px wide inside an area `total` px wide. */
export function clampFraction(f: number, total: number): number {
  if (total <= CHAT_MIN_PX + RESULTS_MIN_PX) return RESULTS_MIN_PX / Math.max(total, 1);
  return Math.min(1 - CHAT_MIN_PX / total, Math.max(RESULTS_MIN_PX / total, f));
}
