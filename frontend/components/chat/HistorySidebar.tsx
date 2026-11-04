"use client";

import Link from "next/link";
import { useState } from "react";
import { useMinuteClock } from "@/hooks/useClock";
import type { ChatEntry } from "@/hooks/useChats";
import { usePanelWidth } from "@/hooks/usePanelWidth";
import { timeAgo } from "@/lib/history";
import EdgeResizer from "./EdgeResizer";
import SettingsMenu from "./SettingsMenu";

const RAIL = 60;

type Props = {
  chats: ChatEntry[];
  activeId: string | null;
  open: boolean; // small screens only: the sidebar is a drawer there
  sessionId: string | null;
  onClose: () => void;
  onOpenChat: (id: string) => void;
  onDeleteChat: (id: string) => Promise<void>;
  onNewChat: () => void;
};

const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const BIN = "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6";

/** Slim sidebar: new chat and the chats started in this browser ("2h ago"). A drawer on phones. */
export default function HistorySidebar({ chats, activeId, open, sessionId, onClose, onOpenChat, onDeleteChat, onNewChat }: Props) {
  const panel = usePanelWidth({ key: "chatcsv.sidebar", min: 200, max: 420, initial: 248 });
  const now = useMinuteClock();
  const [collapsed, setCollapsed] = useState(false); // open by default on every visit
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null); // chat id waiting for "Delete?"
  const [deleting, setDeleting] = useState(false);
  const width = collapsed ? RAIL : (dragWidth ?? panel.width);

  return (
    <>
      {open && <button aria-label="Close history" onClick={onClose} className="fixed inset-0 z-30 bg-scrim md:hidden" />}
      <aside
        aria-label="Chat history"
        style={{ "--sidebar-w": `${width}px` } as React.CSSProperties}
        className={`surface-side fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col gap-3 border-r border-border p-3 md:static md:z-20 md:w-[var(--sidebar-w)] md:translate-x-0 ${
          dragWidth === null ? "transition-[width,transform] duration-200" : ""
        } ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Collapsed rail (desktop only) */}
        <div className={`${collapsed ? "hidden md:flex" : "hidden"} h-full flex-col items-center gap-2`}>
          <button onClick={() => setCollapsed(false)} aria-label="Expand sidebar" title="Expand sidebar" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-foreground">
            <Icon d="M9 18l6-6-6-6" />
          </button>
          <button onClick={onNewChat} aria-label="New chat" title="New chat (⌘K)" className="btn-accent flex h-8 w-8 items-center justify-center rounded-lg">
            <Icon d="M12 5v14M5 12h14" />
          </button>
          <div className="flex-1" />
          <SettingsMenu sessionId={sessionId} onNewSession={onNewChat} compact />
        </div>

        {/* Full sidebar */}
        <div className={`${collapsed ? "md:hidden" : ""} flex min-h-0 flex-1 flex-col gap-3`}>
          <div className="flex items-center justify-between gap-2 px-1">
            <Link href="/" className="font-display truncate text-head">
              CSV<span className="text-accent-ink">Chat</span>
            </Link>
            <button onClick={() => setCollapsed(true)} aria-label="Collapse sidebar" title="Collapse sidebar" className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-foreground md:flex">
              <Icon d="M15 18l-6-6 6-6" size={14} />
            </button>
          </div>

          <button onClick={onNewChat} className="btn-accent flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-ui">
            <Icon d="M12 5v14M5 12h14" size={14} />
            New chat
          </button>

          <nav className="flex min-h-0 flex-1 flex-col" aria-label="Chats">
            <h2 className="mb-2 px-1 text-ui font-semibold text-foreground">Chats</h2>
            {chats.length === 0 ? (
              <p className="px-1 text-ui text-muted">No chats yet</p>
            ) : (
              <ul className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1">
                {chats.map((c) => {
                  const active = c.id === activeId;
                  if (confirming === c.id) {
                    return (
                      <li key={c.id} role="alertdialog" aria-label="Delete this chat?" className="rounded-lg bg-error-soft px-2 py-2 text-ui">
                        <p className="font-medium text-foreground">Delete this chat?</p>
                        <p className="text-muted">Its files and answers are removed for good.</p>
                        <div className="mt-2 flex justify-end gap-2">
                          <button onClick={() => setConfirming(null)} className="rounded-lg px-3 py-1 font-medium text-foreground hover:bg-hover">
                            Cancel
                          </button>
                          <button
                            disabled={deleting}
                            onClick={async () => {
                              setDeleting(true);
                              try {
                                await onDeleteChat(c.id);
                              } finally {
                                setDeleting(false);
                                setConfirming(null);
                              }
                            }}
                            className="rounded-lg bg-error px-3 py-1 font-semibold text-white disabled:opacity-50"
                          >
                            {deleting ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </li>
                    );
                  }
                  return (
                    <li key={c.id} className="group relative">
                      <button
                        onClick={() => onOpenChat(c.id)}
                        aria-current={active ? "true" : undefined}
                        className={`flex w-full items-baseline gap-2 rounded-lg py-2 pl-2 pr-10 text-left text-ui transition-colors ${
                          active ? "bg-accent-soft font-medium text-foreground" : "text-foreground hover:bg-hover"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{c.title}</span>
                        <span className="shrink-0 font-mono text-muted group-hover:invisible group-focus-within:invisible">{timeAgo(c.lastTs, now)}</span>
                      </button>
                      <button
                        onClick={() => setConfirming(c.id)}
                        aria-label={`Delete chat: ${c.title}`}
                        title="Delete chat"
                        className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted opacity-0 transition-opacity hover:bg-error-soft hover:text-error-ink focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                      >
                        <Icon d={BIN} size={15} />
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
