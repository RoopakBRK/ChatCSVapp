"use client";

import { useEffect, useRef, useState } from "react";
import type { ChartKind } from "@/components/charts/chartKinds";
import ChatHeader from "@/components/chat/ChatHeader";
import ChatPanel from "@/components/chat/ChatPanel";
import HistorySidebar from "@/components/chat/HistorySidebar";
import ResultsPanel from "@/components/chat/ResultsPanel";
import { useChat, type ChatItem } from "@/hooks/useChat";
import { useFiles } from "@/hooks/useFiles";
import { useHistory } from "@/hooks/useHistory";
import type { HistorySession } from "@/lib/history";

type AnswerItem = Extract<ChatItem, { kind: "answer" }>;
const latestAnswer = (items: ChatItem[]) => [...items].reverse().find((i): i is AnswerItem => i.kind === "answer");

export default function ChatPage() {
  const history = useHistory();
  const files = useFiles();
  const chat = useChat(files.sessionId, history.append);

  // The results panel is closed by default. It opens when a history chat is opened, or when files
  // are added or a question is answered in the current chat. Charts only ever appear in it.
  const [resultsOpen, setResultsOpen] = useState(false);
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
  const focusOn = (id: string) => {
    setResultsOpen(true);
    setFocus({ id });
  };

  const openHistory = async (s: HistorySession) => {
    setDrawerOpen(false);
    if (s.id) files.openSession(s.id);
    else files.startNewSession();
    setFocus(null);
    setResultsOpen(true);
    const items = await chat.load(s.id, history.entries);
    const last = items && latestAnswer(items);
    if (last) setFocus({ id: last.id }); // show the chat's most recent result
  };

  const newChat = () => {
    setDrawerOpen(false);
    files.startNewSession();
    chat.reset();
    setFocus(null);
    setResultsOpen(false);
  };

  const afterUpload = (uploaded: { note: string; sessionId: string } | null) => {
    if (!uploaded) return false;
    chat.notice(uploaded.note, uploaded.sessionId); // keeps "Uploaded: ..." in the chat and chat.md
    setResultsOpen(true);
    return true;
  };

  const handleSend = async (text: string) => {
    const item = await chat.send(text);
    if (item?.kind === "answer") focusOn(item.id);
  };

  return (
    <div className="flex h-full gap-3 p-3 md:gap-2 md:p-4">
      <HistorySidebar
        sessions={history.sessions}
        activeId={files.sessionId}
        open={drawerOpen}
        sessionId={files.sessionId}
        onClose={() => setDrawerOpen(false)}
        onOpenSession={openHistory}
        onNewChat={newChat}
      />

      <main className="panel-main relative flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl">
        <ChatHeader
          resultsCount={files.files.length + answers.length}
          resultsOpen={resultsOpen}
          onToggleResults={() => {
            if (!resultsOpen && !focus) {
              const last = latestAnswer(chat.items);
              if (last) setFocus({ id: last.id });
            }
            setResultsOpen(!resultsOpen);
          }}
          onOpenHistory={() => setDrawerOpen(true)}
        />
        <ChatPanel
          items={chat.items}
          files={files.files}
          starters={files.starters}
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
          onOpenResult={focusOn}
        />
      </main>

      <ResultsPanel
        open={resultsOpen}
        files={files.files}
        relationships={files.relationships}
        answers={answers}
        focus={focus}
        views={views}
        onKind={(id, kind) => setViews((v) => ({ ...v, [id]: kind }))}
        onFocus={(id) => setFocus({ id })}
        onRemoveFile={async (name) => {
          const sid = files.sessionId;
          const note = await files.remove(name);
          if (note && sid) chat.notice(note, sid);
        }}
        onClose={() => setResultsOpen(false)}
      />
    </div>
  );
}
