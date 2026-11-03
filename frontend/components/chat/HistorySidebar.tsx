"use client";

import Link from "next/link";
import { useState } from "react";
import { SIDEBAR_RAIL, useSidebar } from "@/hooks/useSidebar";
import type { HistorySession } from "@/lib/history";
import { shortDate } from "@/lib/history";
import SettingsMenu from "./SettingsMenu";
import SidebarResizer from "./SidebarResizer";

type Props = {
  sessions: HistorySession[];
  activeId: string | null;
  open: boolean; // small screens only: the sidebar is a drawer there
  sessionId: string | null;
  onClose: () => void;
  onOpenSession: (session: HistorySession) => void;
  onNewChat: () => void;
};

const iconButton =
  "flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white shadow-sm transition-colors hover:border-pink-300 hover:bg-pink-50";

const Chevron = ({ left }: { left: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={left ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
  </svg>
);

/** Chat history. On desktop it can be collapsed to a narrow rail and dragged wider or narrower. */
export default function HistorySidebar({ sessions, activeId, open, sessionId, onClose, onOpenSession, onNewChat }: Props) {
  const sidebar = useSidebar();
  const [dragWidth, setDragWidth] = useState<number | null>(null); // live width while dragging
  const width = sidebar.collapsed ? SIDEBAR_RAIL : (dragWidth ?? sidebar.width);

  return (
    <>
      {open && <button aria-label="Close history" onClick={onClose} className="fixed inset-0 z-30 bg-slate-900/20 md:hidden" />}
      <aside
        aria-label="Chat history"
        style={{ "--sidebar-w": `${width}px` } as React.CSSProperties}
        className={`panel-sidebar fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col gap-4 p-3 md:static md:z-20 md:w-[var(--sidebar-w)] md:translate-x-0 md:rounded-2xl ${
          dragWidth === null ? "transition-[width,transform] duration-200" : ""
        } ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Collapsed rail (desktop only) */}
        <div className={`${sidebar.collapsed ? "hidden md:flex" : "hidden"} h-full flex-col items-center gap-3`}>
          <button onClick={() => sidebar.setCollapsed(false)} aria-label="Expand history" title="Expand history" className={iconButton}>
            <Chevron left={false} />
          </button>
          <button
            onClick={onNewChat}
            aria-label="New chat"
            title="New chat"
            className="bg-gradient-brand flex h-10 w-10 items-center justify-center rounded-full text-xl leading-none text-white shadow-sm"
          >
            +
          </button>
          <div className="flex-1" />
          <SettingsMenu sessionId={sessionId} onNewSession={onNewChat} compact />
        </div>

        {/* Full sidebar */}
        <div className={`${sidebar.collapsed ? "md:hidden" : ""} flex min-h-0 flex-1 flex-col gap-4`}>
          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            <Link href="/" className="truncate text-lg font-bold tracking-tight">
              <span className="text-gradient-brand">CSVChat</span>
            </Link>
            <button
              onClick={() => sidebar.setCollapsed(true)}
              aria-label="Collapse history"
              title="Collapse history"
              className={`${iconButton} hidden h-8 w-8 md:flex`}
            >
              <Chevron left />
            </button>
          </div>

          <button
            onClick={onNewChat}
            className="bg-gradient-brand rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
          >
            + New chat
          </button>

          <nav className="flex min-h-0 flex-1 flex-col" aria-label="History">
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">History</h2>
            {sessions.length === 0 ? (
              <p className="px-1 text-sm text-muted">No chats yet. Add CSV files to start one.</p>
            ) : (
              <ul className="-mx-1 flex-1 space-y-1.5 overflow-y-auto px-1">
                {sessions.map((s) => {
                  const active = s.id !== null && s.id === activeId;
                  return (
                    <li key={s.id ?? "legacy"}>
                      <button
                        onClick={() => onOpenSession(s)}
                        aria-current={active ? "true" : undefined}
                        className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                          active ? "depth border-pink-300 bg-white" : "border-transparent hover:border-sky-200 hover:bg-white/70"
                        }`}
                      >
                        <span className="block truncate text-sm font-medium">{s.title}</span>
                        <span className="block truncate text-xs text-muted">
                          {shortDate(s.lastTs)}
                          {s.files.length > 0 && ` · ${s.files.length} file${s.files.length === 1 ? "" : "s"}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>

          <SettingsMenu sessionId={sessionId} onNewSession={onNewChat} />
        </div>
      </aside>

      {!sidebar.collapsed && (
        <SidebarResizer
          width={dragWidth ?? sidebar.width}
          onDrag={setDragWidth}
          onCommit={(w) => {
            sidebar.setWidth(w);
            setDragWidth(null);
          }}
        />
      )}
    </>
  );
}
