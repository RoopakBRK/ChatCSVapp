import { Suspense } from "react";
import ChatApp from "@/components/chat/ChatApp";

/**
 * /chat and /chat/<session id> are one route (an optional catch-all), so switching chats only
 * changes the address and never reloads the page. ChatApp reads the id from the address, which is
 * only known at request time, so it renders inside Suspense (the shell is prerendered).
 */
export default function ChatPage() {
  return (
    <Suspense fallback={<div className="surface-chat h-full" />}>
      <ChatApp />
    </Suspense>
  );
}
