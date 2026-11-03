"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { ChatAnswer } from "@/lib/api";

const listeners = new Set<() => void>();
const keyFor = (sessionId: string | null) => `csvchat.pins.${sessionId ?? "none"}`;

/** A pin is identified by question + SQL, so it survives a reload (message ids don't). */
export const pinKey = (question: string, answer: ChatAnswer) => `${question}\n${answer.sql}`;

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** Answers pinned to the canvas, per chat, remembered between visits. */
export function usePins(sessionId: string | null) {
  const storageKey = keyFor(sessionId);
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(storageKey) ?? "[]", () => "[]");
  const pins = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(raw) as string[]);
    } catch {
      return new Set<string>();
    }
  }, [raw]);

  const toggle = useCallback(
    (key: string) => {
      const next = new Set(pins);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem(storageKey, JSON.stringify([...next]));
      listeners.forEach((l) => l());
      return next.has(key);
    },
    [pins, storageKey],
  );
  return { pins, toggle };
}
