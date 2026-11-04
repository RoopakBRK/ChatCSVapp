"use client";

import { useEffect, useRef, useState } from "react";
import type { ChartKind } from "@/components/charts/chartKinds";
import ChatHeader from "@/components/chat/ChatHeader";
import ChatPanel from "@/components/chat/ChatPanel";
import { COMPOSER_INPUT_ID } from "@/components/chat/Composer";
import { ChatUIContext, type ChatUI } from "@/components/chat/ChatUIContext";
import HistorySidebar from "@/components/chat/HistorySidebar";
import ResultsPanel from "@/components/chat/ResultsPanel";
import ResultsResizer from "@/components/chat/ResultsResizer";
import { useChat, type ChatItem } from "@/hooks/useChat";
import { titleFrom, useChats } from "@/hooks/useChats";
import { useFiles } from "@/hooks/useFiles";
import { useResultsWidth } from "@/hooks/useResultsWidth";
import { deleteSession, errorMessage } from "@/lib/api";

type AnswerItem = Extract<ChatItem, { kind: "answer" }>;
/** A result picked with its chip, and which answer was newest at that moment. */
type Pick = { id: string; newestAtPick: string | null; n: number };

/**
 * Three panels: chats on the left, the conversation in the middle, results on the right.
 * Results is a thread of every result in this chat. The newest is highlighted unless the user
 * clicked another one's chip since it arrived (a pick only counts while the newest is unchanged).
 */
export default function ChatPage() {
  const chats = useChats();
  const files = useFiles();
  const chat = useChat(files.sessionId);

  const [resultsOpen, setResultsOpen] = useState(false); // below 1280px only; desktop always shows results
  const [tablesOpen, setTablesOpen] = useState(false);
  const [pick, setPick] = useState<Pick | null>(null);
  const [views, setViews] = useState<Record<string, ChartKind>>({}); // chart type picked per answer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const width = useResultsWidth();
  const [dragFraction, setDragFraction] = useState<number | null>(null);
  const area = useRef<HTMLDivElement>(null);

  // Once the saved session is known, show that chat's messages (kept on the backend).
  const restored = useRef(false);
  const { load, reset } = chat;
  useEffect(() => {
    if (restored.current || !files.ready) return;
    restored.current = true;
    if (files.sessionId) load(files.sessionId);
    else reset();
  }, [files.ready, files.sessionId, load, reset]);

  const answers = chat.items.filter((i): i is AnswerItem => i.kind === "answer");
  const newestId = answers.length ? answers[answers.length - 1].id : null;
  // `picked` stays the same object until another chip is clicked, so results scrolls to it once.
  const picked = pick && pick.newestAtPick === newestId && answers.some((a) => a.id === pick.id) ? pick : null;
  const shownId = picked?.id ?? newestId;
  const title = chats.chats.find((c) => c.id === files.sessionId)?.title ?? "New chat";

  const showInResults = (id: string) => {
    setPick((p) => ({ id, newestAtPick: newestId, n: (p?.n ?? 0) + 1 }));
    setTablesOpen(false);
    setResultsOpen(true);
  };

  const openChat = async (id: string) => {
    setDrawerOpen(false);
    files.openSession(id);
    setPick(null);
    setTablesOpen(false);
    setResultsOpen(false);
    await chat.load(id);
  };

  const newChat = () => {
    setDrawerOpen(false);
    files.startNewSession();
    chat.reset();
    setPick(null);
    setTablesOpen(false);
    setResultsOpen(false);
  };

  const deleteChat = async (id: string) => {
    try {
      await deleteSession(id);
    } catch (e) {
      chat.notice(`Couldn't delete that chat: ${errorMessage(e)}`);
      return;
    }
    chats.remove(id);
    if (id === files.sessionId) newChat();
  };

  const send = (text: string) => {
    const sid = files.sessionId;
    if (sid) chats.save(sid, { lastTs: new Date().toISOString(), ...(title === "New chat" ? { title: titleFrom(text) } : {}) });
    chat.send(text);
  };

  const afterUpload = (uploaded: { note: string; sessionId: string } | null) => {
    if (!uploaded) return false;
    chat.notice(uploaded.note); // the backend saved the same note in the chat's history
    return true;
  };

  const ui: ChatUI = {
    files: files.files,
    views,
    retry: (errorId) => {
      chat.retry(errorId);
    },
    shownId,
    showInResults,
  };

  // Keyboard shortcuts: "/" focuses the question box, Cmd/Ctrl+K starts a new chat, Esc closes the
  // drawer or (below 1280px) results. Menus that use Esc themselves stop it before it gets here.
  const newChatRef = useRef(newChat);
  const drawerRef = useRef(drawerOpen);
  useEffect(() => {
    // Keep the latest values for the listener below, which is attached once.
    newChatRef.current = newChat;
    drawerRef.current = drawerOpen;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable='true']");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        newChatRef.current();
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        document.getElementById(COMPOSER_INPUT_ID)?.focus();
      } else if (e.key === "Escape" && !document.fullscreenElement) {
        if (drawerRef.current) setDrawerOpen(false);
        else setResultsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full">
      <HistorySidebar
        chats={chats.chats}
        activeId={files.sessionId}
        open={drawerOpen}
        sessionId={files.sessionId}
        onClose={() => setDrawerOpen(false)}
        onOpenChat={openChat}
        onDeleteChat={deleteChat}
        onNewChat={newChat}
      />

      <div ref={area} className="flex min-w-0 flex-1">
        <ChatUIContext.Provider value={ui}>
          <main className="surface-chat relative flex min-h-0 min-w-0 flex-1 flex-col xl:min-w-[420px]">
            <ChatHeader
              title={title}
              resultsOpen={resultsOpen}
              resultsCount={answers.length}
              onToggleResults={() => setResultsOpen(!resultsOpen)}
              onOpenHistory={() => setDrawerOpen(true)}
            />
            <ChatPanel
              items={chat.items}
              files={files.files}
              starters={files.starters}
              progress={files.progress}
              loading={chat.loading}
              step={chat.step}
              restored={chat.loaded}
              uploading={files.uploading}
              uploadError={files.error}
              onDismissError={files.dismissError}
              onSend={send}
              onStop={chat.stop}
              onFiles={async (picked) => {
                afterUpload(await files.upload(picked));
              }}
              onAddLink={async (url) => afterUpload(await files.uploadUrl(url))}
              onSample={async () => {
                afterUpload(await files.loadSample());
              }}
            />
          </main>
        </ChatUIContext.Provider>

        <ResultsResizer
          area={area}
          fraction={dragFraction ?? width.fraction}
          onDrag={setDragFraction}
          onCommit={(f) => {
            width.setFraction(f);
            setDragFraction(null);
          }}
        />
        <ResultsPanel
          open={resultsOpen}
          onClose={() => setResultsOpen(false)}
          answers={answers}
          shownId={shownId}
          focus={picked}
          tablesOpen={tablesOpen}
          onTables={setTablesOpen}
          files={files.files}
          relationships={files.relationships}
          onRemoveFile={async (name) => {
            const note = await files.remove(name);
            if (note) chat.notice(note);
          }}
          views={views}
          onKind={(id, kind) => setViews((v) => ({ ...v, [id]: kind }))}
          fraction={dragFraction ?? width.fraction}
        />
      </div>
    </div>
  );
}
