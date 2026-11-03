"use client";

import { useSyncExternalStore } from "react";

/** The current minute, updating once a minute; for "2h ago" labels. 0 during server rendering. */
export function useMinuteClock(): number {
  return useSyncExternalStore(
    (cb) => {
      const id = setInterval(cb, 30_000);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => 0,
  );
}
