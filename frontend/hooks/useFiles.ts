"use client";

import { saveChat } from "@/hooks/useChats";
import { useCallback, useEffect, useRef, useState } from "react";
import { deleteFile, errorMessage, getFiles, loadSample as fetchSample, uploadFromUrl, uploadOne } from "@/lib/api";
import type { FileSummary, Relationship, SessionFiles, UploadResponse } from "@/lib/api";

/** One file on its way in: reading (bytes being sent) -> cleaning (server at work) -> ready, or error. */
export type FileProgress = {
  name: string;
  stage: "reading" | "cleaning" | "ready" | "error";
  sent?: number; // 0..1 while reading
  rows?: number;
  reason?: string;
};

const SESSION_KEY = "chatcsv.session_id";
const GONE = "The files for this chat are no longer available. Add them again with + to see its tables and charts.";

/** A session id is 32 hex characters (the backend's uuid4().hex). */
export const isSessionId = (id: string | null | undefined): id is string => !!id && /^[0-9a-f]{32}$/.test(id);

/**
 * Owns the active upload session: its id, the table summaries, the links between tables.
 * `urlId` is the id in the address (/chat/<id>); without one, the chat you were last in is reopened.
 */
export function useFiles(urlId: string | null) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileSummary[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [starters, setStarters] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false); // the saved session (if any) has been looked up
  const [progress, setProgress] = useState<FileProgress[]>([]);
  const patch = useCallback((name: string, change: Partial<FileProgress>) => {
    setProgress((list) => list.map((p) => (p.name === name ? { ...p, ...change } : p)));
  }, []);
  /** Keep the finished cards on screen for a moment, then tidy them away. */
  const settle = useCallback(() => {
    setTimeout(() => setProgress((list) => (list.every((p) => p.stage === "ready" || p.stage === "error") ? list.filter((p) => p.stage === "error") : list)), 2500);
  }, []);

  const apply = useCallback((data: SessionFiles | null) => {
    setFiles(data?.files ?? []);
    setRelationships(data?.relationships ?? []);
    setStarters(data?.starter_questions ?? []);
  }, []);

  // On load, open the chat in the address, or else the one the user was last in.
  const firstUrlId = useRef(urlId);
  useEffect(() => {
    const fromUrl = firstUrlId.current;
    const saved = fromUrl ?? localStorage.getItem(SESSION_KEY);
    const lookup = saved ? getFiles(saved).then((d) => ({ d, e: null as unknown })).catch((e) => ({ d: null, e })) : Promise.resolve(null);
    lookup.then((res) => {
      if (saved && res) {
        if (res.e) {
          setError(errorMessage(res.e)); // backend down: keep the id so later uploads still join this session
          setSessionId(saved);
        } else if (res.d) {
          setSessionId(saved);
          localStorage.setItem(SESSION_KEY, saved);
          saveChat(saved, {});
          apply(res.d);
        } else {
          localStorage.removeItem(SESSION_KEY); // session expired on the server
          if (fromUrl) setError("That chat no longer exists (chats are removed after a day without use). Start a new one below.");
        }
      }
      setReady(true);
    });
  }, [apply]);

  /** Switch to another chat's session (a history item). */
  const openSession = useCallback(
    async (id: string) => {
      setSessionId(id);
      localStorage.setItem(SESSION_KEY, id);
      setError(null);
      apply(null);
      try {
        const data = await getFiles(id);
        apply(data);
        if (!data) setError(GONE);
      } catch (e) {
        setError(errorMessage(e));
      }
    },
    [apply],
  );

  /** Start a fresh chat: the next upload creates a new session. Earlier chats stay in the list. */
  const startNewSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    apply(null);
    setError(null);
  }, [apply]);

  const adopt = useCallback(
    (data: UploadResponse) => {
      setSessionId(data.session_id);
      localStorage.setItem(SESSION_KEY, data.session_id);
      saveChat(data.session_id); // shows in this browser's chat list
      apply(data);
    },
    [apply],
  );

  /**
   * Uploads the files one at a time so each gets a truthful progress card (bytes sent, then
   * cleaning on the server, then ready). Resolves to a note for the chat history, or null.
   */
  const upload = useCallback(
    async (picked: File[]): Promise<{ note: string; sessionId: string } | null> => {
      setError(null);
      setProgress(
        picked.map((f) =>
          f.name.toLowerCase().endsWith(".csv")
            ? { name: f.name, stage: "reading", sent: 0 }
            : { name: f.name, stage: "error", reason: "Not a .csv file" },
        ),
      );
      const csvs = picked.filter((f) => f.name.toLowerCase().endsWith(".csv"));
      if (csvs.length === 0) {
        setError("Only .csv files can be uploaded. Please choose one or more CSV files.");
        return null;
      }
      setUploading(true);
      let sid = sessionId;
      const done: string[] = [];
      for (const file of csvs) {
        try {
          const data = await uploadOne(file, sid, (sent) => patch(file.name, sent >= 1 ? { stage: "cleaning", sent: 1 } : { sent }));
          sid = data.session_id;
          adopt(data);
          done.push(file.name);
          patch(file.name, { stage: "ready", rows: data.files.find((f) => f.file_name === file.name)?.row_count });
        } catch (e) {
          patch(file.name, { stage: "error", reason: errorMessage(e).replace(/^We couldn't use that file\.\n/, "") });
        }
      }
      setUploading(false);
      settle();
      return done.length && sid ? { note: `Uploaded: ${done.join(", ")}`, sessionId: sid } : null;
    },
    [sessionId, adopt, patch, settle],
  );

  /** Load the bundled Online Shop files in one click, with a progress card per file. */
  const loadSample = useCallback(async (): Promise<{ note: string; sessionId: string } | null> => {
    setError(null);
    setProgress([]);
    setUploading(true);
    try {
      const data = await fetchSample(sessionId, (e) => {
        if (e.type === "start") setProgress(e.files.map((name) => ({ name, stage: "reading" })));
        if (e.type === "file") patch(e.name, { stage: e.stage, rows: e.rows, reason: e.reason });
      });
      adopt(data);
      return { note: `Loaded sample data: ${data.uploaded.join(", ")}`, sessionId: data.session_id };
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      setUploading(false);
      settle();
    }
  }, [sessionId, adopt, patch, settle]);

  /** Add a CSV from a link. Same result shape as upload(). */
  const uploadUrl = useCallback(
    async (url: string): Promise<{ note: string; sessionId: string } | null> => {
      setUploading(true);
      setError(null);
      const label = url.trim().replace(/^https?:\/\//, "").slice(0, 60);
      setProgress([{ name: label, stage: "reading" }]); // the server downloads and cleans in one step
      try {
        const data = await uploadFromUrl(url.trim(), sessionId);
        const name = data.uploaded[0] ?? label;
        setProgress([{ name, stage: "ready", rows: data.files.find((f) => f.file_name === name)?.row_count }]);
        settle();
        setSessionId(data.session_id);
        localStorage.setItem(SESSION_KEY, data.session_id);
      saveChat(data.session_id); // shows in this browser's chat list
        apply(data);
        return { note: `Uploaded from link: ${data.uploaded.join(", ")}`, sessionId: data.session_id };
      } catch (e) {
        setProgress([]);
        setError(errorMessage(e));
        return null;
      } finally {
        setUploading(false);
      }
    },
    [sessionId, apply, settle],
  );

  /** Remove one uploaded file from the current session. Resolves to a note for the chat, or null on failure. */
  const remove = useCallback(
    async (name: string): Promise<string | null> => {
      if (!sessionId) return null;
      setError(null);
      try {
        apply(await deleteFile(sessionId, name));
        return `Removed: ${name}`;
      } catch (e) {
        setError(errorMessage(e));
        return null;
      }
    },
    [sessionId, apply],
  );

  return {
    sessionId, files, relationships, starters, uploading, error, ready, progress, uploadUrl, remove, loadSample,
    dismissError: () => setError(null),
    upload, openSession, startNewSession,
  };
}
