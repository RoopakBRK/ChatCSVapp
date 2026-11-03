"use client";

import { useEffect, useRef, useState } from "react";
import ChatHeader from "@/components/chat/ChatHeader";
import ChatPanel from "@/components/chat/ChatPanel";
import HistorySidebar from "@/components/chat/HistorySidebar";
import ResultsPanel from "@/components/chat/ResultsPanel";
import { useChat, type ChatItem } from "@/hooks/useChat";
import { useFiles } from "@/hooks/useFiles";
import { useHistory } from "@/hooks/useHistory";
import type { HistorySession } from "@/lib/history";

export default function ChatPage() {
  const history = useHistory();
  const files = useFiles();
  const chat = useChat(files.sessionId, history.append);

  // The results panel is closed by default. It opens when a history chat is opened, or when
  // files are added or a question is answered in the current chat.
  const [resultsOpen, setResultsOpen] = useState(false);
  const [focus, setFocus] = useState<{ id: string } | null>(null);
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

  const answers = chat.items.filter((i): i is Extract<ChatItem, { kind: "answer" }> => i.kind === "answer");

  const openHistory = (s: HistorySession) => {
    setDrawerOpen(false);
    if (s.id) files.openSession(s.id);
    else files.startNewSession();
    chat.load(s.id, history.entries);
    setFocus(null);
    setResultsOpen(true);
  };

  const newChat = () => {
    setDrawerOpen(false);
    files.startNewSession();
    chat.reset();
    setFocus(null);
    setResultsOpen(false);
  };

  const handleFiles = async (picked: File[]) => {
    const uploaded = await files.upload(picked);
    if (uploaded) {
      chat.notice(uploaded.note, uploaded.sessionId); // keeps "Uploaded: ..." in the chat and chat.md
      setResultsOpen(true);
    }
  };

  const handleSend = async (text: string) => {
    const item = await chat.send(text);
    if (item?.kind === "answer") {
      setResultsOpen(true);
      setFocus({ id: item.id });
    }
  };

  return (
    <div className="flex h-full gap-3 p-3 md:gap-4 md:p-4">
      <HistorySidebar
        sessions={history.sessions}
        activeId={files.sessionId}
        open={drawerOpen}
        sessionId={files.sessionId}
        onClose={() => setDrawerOpen(false)}
        onOpenSession={openHistory}
        onNewChat={newChat}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <ChatHeader
          resultsCount={files.files.length + answers.length}
          resultsOpen={resultsOpen}
          onToggleResults={() => setResultsOpen((o) => !o)}
          onOpenHistory={() => setDrawerOpen(true)}
        />
        <div className="flex min-h-0 flex-1 gap-4">
          <main className="panel-main flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl">
            <ChatPanel
              items={chat.items}
              loading={chat.loading}
              restored={chat.loaded}
              hasFiles={files.files.length > 0}
              uploading={files.uploading}
              uploadError={files.error}
              onDismissError={files.dismissError}
              onSend={handleSend}
              onFiles={handleFiles}
              onOpenResult={(id) => {
                setResultsOpen(true);
                setFocus({ id });
              }}
            />
          </main>
          <ResultsPanel
            open={resultsOpen}
            files={files.files}
            relationships={files.relationships}
            answers={answers}
            focus={focus}
            onClose={() => setResultsOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
