"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage, getFiles, uploadFiles } from "@/lib/api";
import type { FileSummary, Relationship, SessionFiles } from "@/lib/api";

const SESSION_KEY = "chatcsv.session_id";
const GONE = "The files for this chat are no longer available. Add them again with + to see its tables and charts.";

/** Owns the active upload session: its id, the table summaries, the links between tables. */
export function useFiles() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileSummary[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false); // the saved session (if any) has been looked up

  const apply = useCallback((data: SessionFiles | null) => {
    setFiles(data?.files ?? []);
    setRelationships(data?.relationships ?? []);
  }, []);

  // After a reload, pick up the session the user was last in.
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    const lookup = saved ? getFiles(saved).then((d) => ({ d, e: null as unknown })).catch((e) => ({ d: null, e })) : Promise.resolve(null);
    lookup.then((res) => {
      if (saved && res) {
        if (res.e) {
          setError(errorMessage(res.e)); // backend down: keep the id so later uploads still join this session
          setSessionId(saved);
        } else if (res.d) {
          setSessionId(saved);
          apply(res.d);
        } else {
          localStorage.removeItem(SESSION_KEY); // session expired on the server
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

  /** Start a fresh chat: the next upload creates a new session. chat.md is left alone. */
  const startNewSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    apply(null);
    setError(null);
  }, [apply]);

  /** Uploads the files. Resolves to a note for the chat history plus the session id, or null if nothing was uploaded. */
  const upload = useCallback(
    async (picked: File[]): Promise<{ note: string; sessionId: string } | null> => {
      const csvs = picked.filter((f) => f.name.toLowerCase().endsWith(".csv"));
      if (csvs.length === 0) {
        setError("Only .csv files can be uploaded. Please choose one or more CSV files.");
        return null;
      }
      setUploading(true);
      setError(null);
      try {
        const data = await uploadFiles(csvs, sessionId);
        setSessionId(data.session_id);
        localStorage.setItem(SESSION_KEY, data.session_id);
        apply(data);
        const skipped = [...data.rejected, ...picked.filter((f) => !csvs.includes(f)).map((f) => ({ name: f.name, reason: "not a .csv file" }))];
        if (skipped.length) setError(`Some files were skipped: ${skipped.map((r) => `${r.name} (${r.reason})`).join(", ")}`);
        return { note: `Uploaded: ${data.uploaded.join(", ")}`, sessionId: data.session_id };
      } catch (e) {
        setError(errorMessage(e));
        return null;
      } finally {
        setUploading(false);
      }
    },
    [sessionId, apply],
  );

  return {
    sessionId, files, relationships, uploading, error, ready,
    dismissError: () => setError(null),
    upload, openSession, startNewSession,
  };
}
