"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY as KEY } from "./themeScript";

export type Theme = "light" | "dark";
const listeners = new Set<() => void>();

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

/** The theme in effect right now: the saved choice, or else the system's. */
export function currentTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return media().matches ? "dark" : "light";
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onSystem = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    if (e.newValue === "light" || e.newValue === "dark") document.documentElement.dataset.theme = e.newValue;
    else delete document.documentElement.dataset.theme;
    cb();
  };
  media().addEventListener("change", onSystem);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    media().removeEventListener("change", onSystem);
    window.removeEventListener("storage", onStorage);
  };
}

/** Save the choice and apply it everywhere (this tab now, other tabs through the storage event). */
export function setTheme(theme: Theme) {
  localStorage.setItem(KEY, theme);
  document.documentElement.dataset.theme = theme;
  listeners.forEach((l) => l());
}

/** The current theme, re-rendering when it changes. The server renders "light"; the browser corrects it. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => "light");
}
