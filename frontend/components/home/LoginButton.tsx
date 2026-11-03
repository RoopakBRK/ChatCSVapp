"use client";

import { useState } from "react";

/** There is no login yet, so this says so instead of pretending. */
export default function LoginButton() {
  const [note, setNote] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setNote((n) => !n)}
        className="rounded-full border border-border bg-white px-5 py-2 text-sm font-semibold shadow-sm transition-colors hover:border-pink-300 hover:bg-pink-50"
      >
        Login
      </button>
      {note && (
        <p role="status" className="absolute right-0 top-12 w-52 rounded-xl border border-border bg-white p-3 text-xs text-muted shadow-lg">
          Accounts aren&apos;t available yet. You can use the app without logging in.
        </p>
      )}
    </div>
  );
}
