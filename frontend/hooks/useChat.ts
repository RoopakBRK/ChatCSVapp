"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError, errorMessage, getHistory, runQuery, sendChat } from "@/lib/api";
import type { ChatAnswer, ChatStep, HistoryMessage } from "@/lib/api";
import { readEffort } from "./useEffort";

/** `fresh` marks items created in this visit (they animate in); restored history does not. */
type Base = { id: string; fresh?: boolean };
export type ChatItem =
  | (Base & { kind: "user"; text: string })
  | (Base & { kind: "answer"; question: string; answer: ChatAnswer })
  | (Base & { kind: "clarification"; text: string })
  | (Base & { kind: "text"; role: "assistant" | "system"; text: string }) // replies, notices
  | (Base & { kind: "error"; text: string; retry?: string }); // retry: the question to ask again

const CLIENT_DEADLINE_MS = 65_000; // the backend gives up at 60 s; this is the browser-side backstop
const newId = () => crypto.randomUUID();

/** Rebuild a saved chat. Answers are redrawn by re-running them by id; if that fails they stay as text. */
async function restore(sessionId: string, messages: HistoryMessage[]): Promise<ChatItem[]> {
  return Promise.all(
    messages.map(async (m): Promise<ChatItem> => {
      if (m.kind === "question") return { id: m.id, kind: "user", text: m.text };
      if (m.kind === "clarification") return { id: m.id, kind: "clarification", text: m.text };
      if (m.kind === "answer" && m.answer) {
        try {
          const data = await runQuery(sessionId, m.id);
          return {
            id: m.id,
            kind: "answer",
            question: m.answer.question,
            answer: { type: "answer", id: m.id, explanation: m.text, sql: m.answer.sql, chart: m.answer.chart, ...data },
          };
        } catch {
          /* files gone or query no longer valid: fall through to plain text */
        }
      }
      return { id: m.id, kind: "text", role: m.role === "system" ? "system" : "assistant", text: m.text };
    }),
  );
}

/**
 * The messages of the active chat, and asking questions. Everything is saved by the backend in the
 * session's own folder; the browser never sends earlier messages, so a retried question is only
 * ever in the model's history once (the backend saves a question only when it was answered).
 */
export function useChat(sessionId: string | null) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState<ChatStep | null>(null);
  const latestLoad = useRef(0);
  const controller = useRef<AbortController | null>(null);

  /** Show a saved chat. Returns false when it no longer exists on the server. */
  const load = useCallback(async (id: string): Promise<boolean> => {
    const ticket = ++latestLoad.current;
    let built: ChatItem[] = [];
    let exists = true;
    try {
      const messages = await getHistory(id);
      exists = messages !== null;
      built = messages ? await restore(id, messages) : [];
    } catch (e) {
      built = [{ id: newId(), kind: "error", text: errorMessage(e) }];
    }
    if (ticket !== latestLoad.current) return exists; // the user already moved on to another chat
    setItems(built);
    setLoaded(true);
    return exists;
  }, []);

  const reset = useCallback(() => {
    latestLoad.current++;
    setItems([]);
    setLoaded(true);
  }, []);

  const add = useCallback((item: ChatItem) => setItems((prev) => [...prev, { ...item, fresh: true }]), []);

  /** A note in the chat ("Uploaded: ..."). The backend saves upload notices itself. */
  const notice = useCallback((text: string) => add({ id: newId(), kind: "text", role: "system", text }), [add]);

  const send = useCallback(
    async (text: string, again = false): Promise<ChatItem | null> => {
      if (!sessionId || loading) return null;
      if (!again) add({ id: newId(), kind: "user", text });
      setLoading(true);
      setStep("reading");
      const abort = new AbortController();
      controller.current = abort;
      const timer = setTimeout(() => abort.abort(new DOMException("Timed out", "TimeoutError")), CLIENT_DEADLINE_MS);
      try {
        const res = await sendChat({ message: text, session_id: sessionId, effort: readEffort() }, { signal: abort.signal, onStep: setStep });
        if (res.type === "clarification") {
          add({ id: newId(), kind: "clarification", text: res.question });
          return null;
        }
        if (res.type === "reply") {
          add({ id: newId(), kind: "text", role: "assistant", text: res.text });
          return null;
        }
        const item: ChatItem = { id: res.id, kind: "answer", question: text, answer: res };
        add(item);
        return item;
      } catch (e) {
        if (e instanceof ApiError && e.code === "stopped") {
          add({ id: newId(), kind: "text", role: "system", text: "Stopped. No answer was produced for that question." });
          return null;
        }
        add({ id: newId(), kind: "error", text: errorMessage(e), retry: text });
        return null;
      } finally {
        clearTimeout(timer);
        controller.current = null;
        setLoading(false);
        setStep(null);
      }
    },
    [sessionId, loading, add],
  );

  /** Ask a failed question again: the error card goes away and no second copy of the question is added. */
  const retry = useCallback(
    (errorId: string) => {
      const failed = items.find((i) => i.id === errorId);
      if (!failed || failed.kind !== "error" || !failed.retry) return Promise.resolve(null);
      setItems((prev) => prev.filter((i) => i.id !== errorId));
      return send(failed.retry, true);
    },
    [items, send],
  );

  /** Stop waiting for the current answer. */
  const stop = useCallback(() => controller.current?.abort(), []);

  return { items, loading, step, loaded, send, retry, stop, notice, load, reset };
}
