"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError, errorMessage, runQuery, sendChat } from "@/lib/api";
import type { ChatAnswer, ChatLogEntry, ChatStep, HistoryTurn } from "@/lib/api";

export type ChatItem =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "answer"; question: string; answer: ChatAnswer }
  | { id: string; kind: "clarification"; text: string }
  | { id: string; kind: "text"; role: "assistant" | "system"; text: string } // restored history, notices
  | { id: string; kind: "error"; text: string };

const HISTORY_TURNS = 8;
const CLIENT_DEADLINE_MS = 65_000; // the backend gives up at 60 s; this is the browser-side backstop
const newId = () => crypto.randomUUID();

function toHistory(items: ChatItem[]): HistoryTurn[] {
  const turns: HistoryTurn[] = [];
  for (const m of items) {
    if (m.kind === "user") turns.push({ role: "user", content: m.text });
    else if (m.kind === "answer") turns.push({ role: "assistant", content: `${m.answer.explanation}\n(SQL used: ${m.answer.sql})` });
    else if (m.kind === "clarification" || (m.kind === "text" && m.role === "assistant")) turns.push({ role: "assistant", content: m.text });
  }
  return turns.slice(-HISTORY_TURNS);
}

/** Rebuild a saved chat. Answers are redrawn by re-running their SQL; if that fails they stay as text. */
async function restore(sessionId: string | null, entries: ChatLogEntry[]): Promise<ChatItem[]> {
  const mine = entries.filter((e) => e.session === sessionId);
  return Promise.all(
    mine.map(async (e, i): Promise<ChatItem> => {
      const id = `log-${sessionId ?? "legacy"}-${i}`;
      if (e.role === "user") return { id, kind: "user", text: e.content };
      if (e.role === "assistant" && e.result && sessionId) {
        try {
          const data = await runQuery(sessionId, e.result.sql);
          const explanation = e.content.split("\n\n```sql")[0];
          return { id, kind: "answer", question: e.result.question, answer: { type: "answer", explanation, sql: e.result.sql, chart: e.result.chart, ...data } };
        } catch {
          /* files gone or query no longer valid: fall through to plain text */
        }
      }
      return { id, kind: "text", role: e.role, text: e.content };
    }),
  );
}

/** The messages of the active chat; sending questions; saving everything to chat.md. */
export function useChat(sessionId: string | null, save: (entry: ChatLogEntry) => void) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState<ChatStep | null>(null);
  const latestLoad = useRef(0);
  const controller = useRef<AbortController | null>(null);

  /** Show a saved chat. `id` null means messages saved before chats were tracked by session. */
  const load = useCallback(async (id: string | null, entries: ChatLogEntry[]): Promise<ChatItem[] | null> => {
    const ticket = ++latestLoad.current;
    const built = await restore(id, entries);
    if (ticket !== latestLoad.current) return null; // the user already moved on to another chat
    setItems(built);
    setLoaded(true);
    return built;
  }, []);

  const reset = useCallback(() => {
    latestLoad.current++;
    setItems([]);
    setLoaded(true);
  }, []);

  const add = useCallback(
    (item: ChatItem, entry: Pick<ChatLogEntry, "role" | "content" | "result">, sid: string | null) => {
      setItems((prev) => [...prev, item]);
      save({ ...entry, session: sid, ts: new Date().toISOString() });
    },
    [save],
  );

  const notice = useCallback(
    (text: string, sid: string) => add({ id: newId(), kind: "text", role: "system", text }, { role: "system", content: text }, sid),
    [add],
  );

  const send = useCallback(
    async (text: string): Promise<ChatItem | null> => {
      if (!sessionId || loading) return null;
      const history = toHistory(items);
      add({ id: newId(), kind: "user", text }, { role: "user", content: text }, sessionId);
      setLoading(true);
      setStep("understanding");
      const abort = new AbortController();
      controller.current = abort;
      const timer = setTimeout(() => abort.abort(new DOMException("Timed out", "TimeoutError")), CLIENT_DEADLINE_MS);
      try {
        const res = await sendChat(
          { message: text, session_id: sessionId, history },
          { signal: abort.signal, onStep: setStep },
        );
        if (res.type === "clarification") {
          add({ id: newId(), kind: "clarification", text: res.question }, { role: "assistant", content: res.question }, sessionId);
          return null;
        }
        const item: ChatItem = { id: newId(), kind: "answer", question: text, answer: res };
        add(
          item,
          {
            role: "assistant",
            content: `${res.explanation}\n\n\`\`\`sql\n${res.sql}\n\`\`\``,
            result: { question: text, sql: res.sql, chart: res.chart },
          },
          sessionId,
        );
        return item;
      } catch (e) {
        if (e instanceof ApiError && e.code === "stopped") {
          const note = "Stopped. No answer was produced for that question.";
          add({ id: newId(), kind: "text", role: "system", text: note }, { role: "system", content: note }, sessionId);
          return null;
        }
        const message = errorMessage(e);
        add({ id: newId(), kind: "error", text: message }, { role: "system", content: message }, sessionId);
        return null;
      } finally {
        clearTimeout(timer);
        controller.current = null;
        setLoading(false);
        setStep(null);
      }
    },
    [sessionId, loading, items, add],
  );

  /** Stop waiting for the current answer. */
  const stop = useCallback(() => controller.current?.abort(), []);

  return { items, loading, step, loaded, send, stop, notice, load, reset };
}
