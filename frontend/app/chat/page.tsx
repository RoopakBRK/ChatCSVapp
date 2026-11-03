"use client";

import { useEffect, useRef, useState } from "react";
import type { ChartKind } from "@/components/charts/chartKinds";
import CanvasPanel from "@/components/chat/CanvasPanel";
import ChatHeader from "@/components/chat/ChatHeader";
import ChatPanel from "@/components/chat/ChatPanel";
import { COMPOSER_INPUT_ID } from "@/components/chat/Composer";
import { ChatUIContext, type ChatUI } from "@/components/chat/ChatUIContext";
import HistorySidebar from "@/components/chat/HistorySidebar";
import { useChat, type ChatItem } from "@/hooks/useChat";
import { useFiles } from "@/hooks/useFiles";
import { useHistory } from "@/hooks/useHistory";
import { pinKey, usePins } from "@/hooks/usePins";
import type { HistorySession } from "@/lib/history";

type AnswerItem = Extract<ChatItem, { kind: "answer" }>;

export default function ChatPage() {
  const history = useHistory();
  const files = useFiles();
  const chat = useChat(files.sessionId, history.append);

  // The canvas is closed by default. It opens when a past chat is opened, when files are added, or
  // when an answer is pinned. Answers carry their own chart; the canvas keeps the pinned ones.
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [focus, setFocus] = useState<{ id: string } | null>(null);
  const [views, setViews] = useState<Record<string, ChartKind>>({}); // chart type picked per answer
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Once chat.md and the saved session are both known, show the chat the user was last in.
  const restored = useRef(false);
  const { load, reset } = chat;
  useEffect(() => {
    if (restored.current || !history.ready || !files.ready) return;
    restored.current = true;
    if (files.sessionId) load(files.sessionId, history.entries);
    else reset();
  }, [history.ready, history.entries, files.ready, files.sessionId, load, reset]);

  const answers = chat.items.filter((i): i is AnswerItem => i.kind === "answer");
  const { pins, toggle: togglePinKey } = usePins(files.sessionId);
  const pinned = answers.filter((a) => pins.has(pinKey(a.question, a.answer)));
  const active = history.sessions.find((s) => s.id !== null && s.id === files.sessionId);
  const title = active?.title ?? "New chat";

  const focusOn = (id: string) => {
    setCanvasOpen(true);
    setFocus({ id });
  };

  const openHistory = async (s: HistorySession) => {
    setDrawerOpen(false);
    if (s.id) files.openSession(s.id);
    else files.startNewSession();
    setFocus(null);
    setCanvasOpen(true);
    await chat.load(s.id, history.entries);
  };

  const newChat = () => {
    setDrawerOpen(false);
    files.startNewSession();
    chat.reset();
    setFocus(null);
    setCanvasOpen(false);
  };

  const toggleCanvas = () => {
    setCanvasOpen(!canvasOpen);
  };

  const afterUpload = (uploaded: { note: string; sessionId: string } | null) => {
    if (!uploaded) return false;
    chat.notice(uploaded.note, uploaded.sessionId); // keeps "Uploaded: ..." in the chat and chat.md
    setCanvasOpen(true);
    return true;
  };

  const handleSend = (text: string) => {
    chat.send(text);
  };

  const ui: ChatUI = {
    files: files.files,
    views,
    setKind: (id, kind) => setViews((v) => ({ ...v, [id]: kind })),
    isPinned: (answer, question) => pins.has(pinKey(question, answer)),
    togglePin: (id, answer, question) => {
      if (togglePinKey(pinKey(question, answer))) focusOn(id); // pinning shows it in the canvas
    },
    retry: (errorId) => {
      chat.retry(errorId);
    },
    openInCanvas: focusOn,
  };

  // Keyboard shortcuts: "/" focuses the question box, Cmd/Ctrl+K starts a new chat, Esc closes the
  // drawer or the canvas. Menus that use Esc themselves stop it before it gets here.
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
      } else if (e.key === "Escape") {
        if (drawerRef.current) setDrawerOpen(false);
        else setCanvasOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full gap-2 p-2 md:p-3">
      <HistorySidebar
        sessions={history.sessions}
        activeId={files.sessionId}
        files={files.files}
        open={drawerOpen}
        sessionId={files.sessionId}
        onClose={() => setDrawerOpen(false)}
        onOpenSession={openHistory}
        onNewChat={newChat}
      />

      <ChatUIContext.Provider value={ui}>
      <main className="glass relative flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl">
        <ChatHeader
          title={title}
          files={files.files}
          canvasOpen={canvasOpen}
          canvasCount={files.files.length + pinned.length}
          onToggleCanvas={toggleCanvas}
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
          onSend={handleSend}
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

      <CanvasPanel
        open={canvasOpen}
        files={files.files}
        relationships={files.relationships}
        answers={pinned}
        focus={focus}
        views={views}
        onKind={(id, kind) => setViews((v) => ({ ...v, [id]: kind }))}
        onUnpin={(a) => togglePinKey(pinKey(a.question, a.answer))}
        onRemoveFile={async (name) => {
          const sid = files.sessionId;
          const note = await files.remove(name);
          if (note && sid) chat.notice(note, sid);
        }}
        onClose={() => setCanvasOpen(false)}
      />
    </div>
  );
}
