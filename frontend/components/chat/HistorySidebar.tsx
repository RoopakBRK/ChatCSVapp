import Link from "next/link";
import type { HistorySession } from "@/lib/history";
import { shortDate } from "@/lib/history";
import SettingsMenu from "./SettingsMenu";

type Props = {
  sessions: HistorySession[];
  activeId: string | null;
  open: boolean; // small screens only: the sidebar is a drawer there
  sessionId: string | null;
  onClose: () => void;
  onOpenSession: (session: HistorySession) => void;
  onNewChat: () => void;
};

export default function HistorySidebar({ sessions, activeId, open, sessionId, onClose, onOpenSession, onNewChat }: Props) {
  return (
    <>
      {open && <button aria-label="Close history" onClick={onClose} className="fixed inset-0 z-30 bg-slate-900/20 md:hidden" />}
      <aside
        aria-label="Chat history"
        className={`panel-sidebar fixed inset-y-0 left-0 z-40 flex w-72 flex-col gap-4 p-3 transition-transform md:static md:z-auto md:translate-x-0 md:rounded-2xl ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SettingsMenu sessionId={sessionId} onNewSession={onNewChat} />

        <Link href="/" className="px-1 text-lg font-bold tracking-tight">
          <span className="text-gradient-brand">CSV Chat</span>
        </Link>

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
                        active ? "border-pink-300 bg-white shadow-sm" : "border-transparent hover:border-sky-200 hover:bg-white/70"
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
      </aside>
    </>
  );
}
