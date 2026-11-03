"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { appendChatLog, loadChatLog } from "@/lib/api";
import type { ChatLogEntry } from "@/lib/api";
import { groupSessions } from "@/lib/history";

/** Everything saved in chat.md, plus the chats (sessions) it can be grouped into. */
export function useHistory() {
  const [entries, setEntries] = useState<ChatLogEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadChatLog().then((saved) => {
      setEntries(saved);
      setReady(true);
    });
  }, []);

  const append = useCallback((entry: ChatLogEntry) => {
    setEntries((prev) => [...prev, entry]);
    appendChatLog(entry);
  }, []);

  const sessions = useMemo(() => groupSessions(entries), [entries]);
  return { entries, sessions, ready, append };
}
