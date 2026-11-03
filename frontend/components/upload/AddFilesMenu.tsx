"use client";

import { useRef, useState } from "react";

type Props = {
  uploading: boolean;
  onFiles: (files: File[]) => void;
  onLink: (url: string) => Promise<boolean>; // true when the file was added
};

type Mode = "closed" | "menu" | "link" | "drive";

const HINT: Record<"link" | "drive", { title: string; placeholder: string; help: string }> = {
  link: {
    title: "Upload from a link",
    placeholder: "https://example.com/data.csv",
    help: "A direct link to a .csv file. GitHub and Dropbox file links work too.",
  },
  drive: {
    title: "Upload from Google Drive",
    placeholder: "https://drive.google.com/file/d/… or a Google Sheets link",
    help: "Paste the share link of a CSV file or a Google Sheet. Share it as “Anyone with the link” first.",
  },
};

const Icon = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

/** The + button: upload from this computer, from a link, or from Google Drive. */
export default function AddFilesMenu({ uploading, onFiles, onLink }: Props) {
  const [mode, setMode] = useState<Mode>("closed");
  const [url, setUrl] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const close = () => {
    setMode("closed");
    setUrl("");
  };
  // This sits inside the composer's <form>, and forms can't be nested, so the link "form" is a plain
  // group: Enter and the button both call this, and Enter is stopped from submitting the composer.
  const submitLink = async () => {
    if (!url.trim() || uploading) return;
    if (await onLink(url)) close();
  };

  const item =
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-pink-50";

  return (
    <div className="group relative" onKeyDown={(e) => e.key === "Escape" && close()}>
      <button
        type="button"
        aria-label="Add files"
        aria-haspopup="menu"
        aria-expanded={mode !== "closed"}
        onClick={() => setMode(mode === "closed" ? "menu" : "closed")}
        disabled={uploading}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-white text-2xl leading-none text-pink-500 shadow-sm transition-colors hover:border-pink-300 hover:bg-pink-50 disabled:opacity-50"
      >
        {uploading ? <span className="text-xs text-muted">…</span> : "+"}
      </button>
      {mode === "closed" && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-0 mb-2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
        >
          Add files
        </span>
      )}
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        multiple
        hidden
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = ""; // lets the same file be picked again
        }}
      />

      {mode !== "closed" && (
        <>
          <button aria-label="Close menu" tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={close} />
          <div
            role="menu"
            className="depth absolute bottom-14 left-0 z-40 w-80 rounded-2xl border border-border bg-white p-2"
          >
            {mode === "menu" ? (
              <>
                <button role="menuitem" className={item} onClick={() => {
                    close();
                    fileInput.current?.click();
                  }}>
                  <Icon d="M4 17v3h16v-3M12 3v12m0-12-4 4m4-4 4 4" />
                  Upload from computer
                </button>
                <button role="menuitem" className={item} onClick={() => setMode("link")}>
                  <Icon d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
                  Upload from a link
                </button>
                <button role="menuitem" className={item} onClick={() => setMode("drive")}>
                  <Icon d="M8 3h8l6 10-4 7H6l-4-7 6-10zM8 3l6 10M16 3 10 13M2 13h20" />
                  Upload from Google Drive
                </button>
              </>
            ) : (
              <div role="group" aria-label={HINT[mode].title} className="space-y-2 p-2">
                <p className="text-sm font-semibold">{HINT[mode].title}</p>
                <input
                  autoFocus
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitLink();
                    }
                  }}
                  placeholder={HINT[mode].placeholder}
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-pink-300"
                />
                <p className="text-xs text-muted">{HINT[mode].help}</p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setMode("menu")} className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted hover:bg-slate-100">
                    Back
                  </button>
                  <button type="button" onClick={submitLink} disabled={uploading || !url.trim()} className="bg-gradient-brand rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    {uploading ? "Adding…" : "Add file"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
