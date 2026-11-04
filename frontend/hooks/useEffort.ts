"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Effort = "low" | "medium" | "high";
export const EFFORTS: { value: Effort; label: string; hint: string }[] = [
  { value: "low", label: "Low", hint: "Fastest. Good for simple counts and totals." },
  { value: "medium", label: "Medium", hint: "Balanced. The default." },
  { value: "high", label: "High", hint: "Most careful, for tricky questions. Slower." },
];
const KEY = "chatcsv.effort";
const DEFAULT: Effort = "medium";

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** How hard the AI thinks before writing the query. Saved in this browser; Medium by default. */
export function readEffort(): Effort {
  const v = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
  return v === "low" || v === "medium" || v === "high" ? v : DEFAULT;
}

export function useEffort() {
  const effort = useSyncExternalStore(subscribe, readEffort, () => DEFAULT);
  const setEffort = useCallback((e: Effort) => {
    localStorage.setItem(KEY, e);
    listeners.forEach((l) => l());
  }, []);
  return { effort, setEffort };
}
