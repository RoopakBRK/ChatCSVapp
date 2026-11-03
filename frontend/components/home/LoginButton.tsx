"use client";

import { useState } from "react";

/** There is no login yet, so this says so instead of pretending. */
export default function LoginButton() {
  const [note, setNote] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setNote((n) => !n)}
        className="rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold depth transition-colors hover:border-accent hover:bg-accent-soft"
      >
        Login
      </button>
      {note && (
        <p role="status" className="absolute right-0 top-12 w-52 rounded-xl border border-border bg-card p-3 text-xs text-muted depth-2">
          Accounts aren&apos;t available yet. You can use the app without logging in.
        </p>
      )}
    </div>
  );
}
