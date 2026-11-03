"use client";

import { useState } from "react";
import { API_URL, getHealth } from "@/lib/api";

type Props = { sessionId: string | null; onNewSession: () => void; compact?: boolean };

export default function SettingsMenu({ sessionId, onNewSession, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [ai, setAi] = useState<"checking" | "ready" | "no-key" | "offline">("checking");

  const toggle = () => {
    if (!open) {
      setAi("checking");
      getHealth()
        .then((h) => setAi(h.groq_key_configured ? "ready" : "no-key"))
        .catch(() => setAi("offline"));
    }
    setOpen(!open);
  };

  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-label="Settings"
        title="Settings"
        className={`flex items-center gap-2 rounded-full ${compact ? "h-10 w-10 justify-center" : "w-full px-4 py-2"} border border-border bg-white text-sm font-medium shadow-sm transition-colors hover:border-pink-300 hover:bg-pink-50`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
        {!compact && "Settings"}
      </button>

      {open && (
        <>
          <button aria-label="Close settings" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute bottom-12 left-0 z-50 w-72 space-y-3 rounded-2xl border border-border bg-white p-4 text-sm shadow-xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Backend</p>
              <p className="break-all font-mono text-xs">{API_URL}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">AI service</p>
              <p className="flex items-center gap-1.5 text-xs">
                <span
                  aria-hidden
                  className={`h-2 w-2 rounded-full ${ai === "ready" ? "bg-emerald-500" : ai === "checking" ? "bg-slate-300" : "bg-rose-500"}`}
                />
                {{ checking: "Checking…", ready: "Ready (Groq key configured)", "no-key": "Not set up: GROQ_API_KEY is missing on the server", offline: "Backend unreachable" }[ai]}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Session</p>
              <p className="break-all font-mono text-xs">{sessionId ?? "No files uploaded yet"}</p>
            </div>
            <button
              onClick={() => {
                onNewSession();
                setOpen(false);
              }}
              disabled={!sessionId}
              className="w-full rounded-xl border border-border px-3 py-2 font-medium transition-colors hover:border-pink-300 hover:bg-pink-50 disabled:opacity-40"
            >
              Start a new chat
            </button>
            <p className="text-xs text-muted">A new chat starts with no files. Your earlier chats stay in History and in chat.md.</p>
          </div>
        </>
      )}
    </div>
  );
}
