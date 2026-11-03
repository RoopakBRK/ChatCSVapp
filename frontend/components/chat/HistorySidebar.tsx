"use client";

import Link from "next/link";
import { useState } from "react";
import { useMinuteClock } from "@/hooks/useClock";
import { usePanelWidth } from "@/hooks/usePanelWidth";
import type { FileSummary } from "@/lib/api";
import { formatCount } from "@/lib/format";
import type { HistorySession } from "@/lib/history";
import { timeAgo } from "@/lib/history";
import EdgeResizer from "./EdgeResizer";
import SettingsMenu from "./SettingsMenu";

const RAIL = 60;

type Props = {
  sessions: HistorySession[];
  activeId: string | null;
  files: FileSummary[];
  open: boolean; // small screens only: the sidebar is a drawer there
  sessionId: string | null;
  onClose: () => void;
  onOpenSession: (session: HistorySession) => void;
  onNewChat: () => void;
};

const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

/** Slim sidebar: new chat, past chats ("2h ago"), and the tables loaded in this chat. A drawer on phones. */
export default function HistorySidebar({ sessions, activeId, files, open, sessionId, onClose, onOpenSession, onNewChat }: Props) {
  const panel = usePanelWidth({ key: "chatcsv.sidebar", min: 200, max: 420, initial: 248 });
  const now = useMinuteClock();
  const [collapsed, setCollapsed] = useState(false); // open by default on every visit
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const width = collapsed ? RAIL : (dragWidth ?? panel.width);

  return (
    <>
      {open && <button aria-label="Close history" onClick={onClose} className="fixed inset-0 z-30 bg-scrim md:hidden" />}
      <aside
        aria-label="Chat history"
        style={{ "--sidebar-w": `${width}px` } as React.CSSProperties}
        className={`glass max-md:bg-panel fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col gap-3 p-3 md:static md:z-20 md:w-[var(--sidebar-w)] md:translate-x-0 md:rounded-2xl ${
          dragWidth === null ? "transition-[width,transform] duration-200" : ""
        } ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Collapsed rail (desktop only) */}
        <div className={`${collapsed ? "hidden md:flex" : "hidden"} h-full flex-col items-center gap-2`}>
          <button onClick={() => setCollapsed(false)} aria-label="Expand sidebar" title="Expand sidebar" className="btn-ghost flex h-9 w-9 items-center justify-center rounded-full">
            <Icon d="M9 18l6-6-6-6" />
          </button>
          <button onClick={onNewChat} aria-label="New chat" title="New chat (⌘K)" className="btn-accent flex h-9 w-9 items-center justify-center rounded-full">
            <Icon d="M12 5v14M5 12h14" />
          </button>
          <div className="flex-1" />
          <SettingsMenu sessionId={sessionId} onNewSession={onNewChat} compact />
        </div>

        {/* Full sidebar */}
        <div className={`${collapsed ? "md:hidden" : ""} flex min-h-0 flex-1 flex-col gap-3`}>
          <div className="flex items-center justify-between gap-2 px-1">
            <Link href="/" className="font-display truncate text-2xl leading-none">
              CSV<span className="text-accent-ink">Chat</span>
            </Link>
            <button onClick={() => setCollapsed(true)} aria-label="Collapse sidebar" title="Collapse sidebar" className="btn-ghost hidden h-7 w-7 items-center justify-center rounded-full md:flex">
              <Icon d="M15 18l-6-6 6-6" size={14} />
            </button>
          </div>

          <button onClick={onNewChat} className="btn-accent flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm">
            <Icon d="M12 5v14M5 12h14" size={14} />
            New chat
            <kbd className="ml-auto hidden rounded-sm border border-current/25 px-1 font-mono text-[10px] opacity-70 md:inline">⌘K</kbd>
          </button>

          <nav className="flex min-h-0 flex-1 flex-col" aria-label="Past chats">
            <h2 className="mb-1.5 px-1 font-sans text-[11px] font-semibold uppercase tracking-wider text-muted">Chats</h2>
            {sessions.length === 0 ? (
              <p className="px-1 text-xs text-muted">No chats yet. Add CSV files to start one.</p>
            ) : (
              <ul className="-mx-1 flex-1 space-y-0.5 overflow-y-auto px-1">
                {sessions.map((s) => {
                  const active = s.id !== null && s.id === activeId;
                  return (
                    <li key={s.id ?? "legacy"}>
                      <button
                        onClick={() => onOpenSession(s)}
                        aria-current={active ? "true" : undefined}
                        className={`flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                          active ? "bg-accent-soft text-foreground" : "text-foreground/85 hover:bg-hover"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{s.title}</span>
                        <span className={`shrink-0 font-mono text-[10px] ${active ? "text-foreground" : "text-muted"}`}>{timeAgo(s.lastTs, now)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>

          {files.length > 0 && (
            <section aria-label="Loaded tables">
              <h2 className="mb-1.5 px-1 font-sans text-[11px] font-semibold uppercase tracking-wider text-muted">Tables</h2>
              <div className="flex flex-wrap gap-1.5">
                {files.map((f) => (
                  <span key={f.file_name} className="chip" title={f.file_name}>
                    <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
                    <span className="max-w-[9rem] truncate">{f.table_name}</span>
                    <span className="font-mono text-muted">{formatCount(f.row_count)}</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          <SettingsMenu sessionId={sessionId} onNewSession={onNewChat} />
        </div>
      </aside>

      {!collapsed && (
        <div className="hidden md:block">
          <EdgeResizer
            edge="right"
            label="Resize sidebar"
            width={dragWidth ?? panel.width}
            min={panel.min}
            max={panel.max}
            initial={panel.initial}
            clamp={panel.clamp}
            onDrag={setDragWidth}
            onCommit={(w) => {
              panel.setWidth(w);
              setDragWidth(null);
            }}
          />
        </div>
      )}
    </>
  );
}
