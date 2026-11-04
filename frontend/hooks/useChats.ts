"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { getHistory } from "@/lib/api";

/** One chat this browser started. The messages live on the backend, in the session's folder. */
export type ChatEntry = { id: string; title: string; lastTs: string };

const KEY = "chatcsv.chats";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function read(): ChatEntry[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((c) => typeof c?.id === "string") : [];
  } catch {
    return [];
  }
}

function write(list: ChatEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  listeners.forEach((l) => l());
}

export function titleFrom(question: string): string {
  const q = question.trim();
  return q.length > 48 ? `${q.slice(0, 47)}…` : q;
}

/** Add a chat, or update its title / time. */
export function saveChat(id: string, patch: Partial<Omit<ChatEntry, "id">> = {}) {
  const list = read();
  const old = list.find((c) => c.id === id);
  const next: ChatEntry = { id, title: "New chat", lastTs: new Date().toISOString(), ...old, ...patch };
  write([next, ...list.filter((c) => c.id !== id)]);
}

/**
 * The chats started in this browser, newest first (kept in localStorage). There is no server-side
 * list of chats, so nobody can see anyone else's: a chat can only be opened with its session id.
 *
 * A link ending in #chats=<id>,<id> adds those chats once (used to bring over chats from the old
 * chat.md log; see backend/scripts/migrate_chat_md.py).
 */
export function useChats() {
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(KEY) ?? "[]", () => "[]");
  const chats = useMemo(() => {
    try {
      const list = JSON.parse(raw) as ChatEntry[];
      return [...list].sort((a, b) => b.lastTs.localeCompare(a.lastTs));
    } catch {
      return [];
    }
  }, [raw]);

  useEffect(() => {
    const m = /^#chats=([0-9a-f,]+)$/.exec(window.location.hash);
    if (!m) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    for (const id of m[1].split(",").filter((s) => /^[0-9a-f]{32}$/.test(s))) {
      getHistory(id)
        .then((messages) => {
          if (!messages) return;
          const first = messages.find((x) => x.kind === "question");
          saveChat(id, { title: first ? titleFrom(first.text) : "New chat", lastTs: messages.at(-1)?.ts ?? new Date().toISOString() });
        })
        .catch(() => {});
    }
  }, []);

  const remove = useCallback((id: string) => write(read().filter((c) => c.id !== id)), []);
  /** Give a chat your own name (blank keeps the old one). Its place in the list doesn't change. */
  const rename = useCallback((id: string, title: string) => {
    const name = title.trim().slice(0, 80);
    if (name) saveChat(id, { title: name });
  }, []);
  return { chats, save: saveChat, remove, rename };
}
