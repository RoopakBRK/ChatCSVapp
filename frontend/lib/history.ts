import type { ChatLogEntry } from "@/lib/api";

export type HistorySession = {
  id: string | null; // null: messages saved before chats were tracked by session
  title: string;
  files: string[];
  lastTs: string;
  messageCount: number;
};

const UPLOADED = /^Uploaded: (.+)$/m;

/** Turn the flat chat.md log into a list of chats, newest first. */
export function groupSessions(entries: ChatLogEntry[]): HistorySession[] {
  const groups = new Map<string | null, ChatLogEntry[]>();
  for (const e of entries) groups.set(e.session, [...(groups.get(e.session) ?? []), e]);

  const sessions = [...groups].map(([id, list]): HistorySession => {
    const files = new Set<string>();
    for (const e of list) {
      const m = e.role === "system" ? UPLOADED.exec(e.content) : null;
      m?.[1].split(", ").forEach((f) => files.add(f));
    }
    const firstQuestion = list.find((e) => e.role === "user")?.content;
    const title = firstQuestion
      ? firstQuestion.length > 48 ? `${firstQuestion.slice(0, 47)}…` : firstQuestion
      : files.size ? [...files].join(", ") : id ? "New chat" : "Earlier messages";
    return { id, title, files: [...files], lastTs: list[list.length - 1].ts, messageCount: list.length };
  });
  return sessions.sort((a, b) => b.lastTs.localeCompare(a.lastTs));
}

export function shortDate(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
