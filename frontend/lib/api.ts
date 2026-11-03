/**
 * Every network call the app makes lives in this file, together with types that mirror the
 * backend's pydantic models (backend/src/schemas/*.py).
 */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

/* ───────────── Types: files ───────────── */

export type ColumnInfo = {
  name: string;
  original_name: string;
  type: string;
  missing: number;
  missing_pct: number;
  distinct_values: string[] | null;
  min: string | null;
  max: string | null;
};

export type CleaningStep = {
  action: string;
  column: string | null;
  count: number;
  detail: string;
  changes_data: boolean;
};

export type OutlierFlag = {
  column: string;
  count: number;
  lower_fence: number;
  upper_fence: number;
  examples: number[];
};

export type CellValue = string | number | boolean | null;

export type FileSummary = {
  file_name: string;
  table_name: string;
  size: number;
  rows_read: number;
  row_count: number;
  column_count: number;
  columns: ColumnInfo[];
  missing_total: number;
  sample_rows: Record<string, CellValue>[];
  cleaning_steps: CleaningStep[];
  outliers: OutlierFlag[];
};

export type Relationship = {
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
  cardinality: "many_to_one" | "one_to_one";
  match_pct: number;
  unmatched_values: number;
  confidence: "high" | "medium" | "low";
  reason: string;
  type_mismatch: boolean;
  join: string;
};

export type RejectedFile = { name: string; reason: string };

export type SessionFiles = {
  session_id: string;
  files: FileSummary[];
  relationships: Relationship[];
  starter_questions: string[];
};

export type UploadResponse = SessionFiles & {
  uploaded: string[];
  rejected: RejectedFile[];
};

/* ───────────── Types: chat ───────────── */

export type ChartType = "bar" | "line" | "pie" | "scatter";
export type ChartSpec = { type: ChartType; x: string; y: string; title: string };

export type HistoryTurn = { role: "user" | "assistant"; content: string };
export type ChatRequest = { message: string; session_id: string; history: HistoryTurn[] };

export type ChatAnswer = {
  type: "answer";
  explanation: string;
  sql: string;
  chart: ChartSpec | null;
  columns: string[];
  rows: CellValue[][];
  row_count: number;
  truncated: boolean;
};
export type ChatClarification = { type: "clarification"; question: string };
export type ChatResponse = ChatAnswer | ChatClarification;

/** The stages the backend reports while it works on one question. */
export type ChatStep = "reading" | "querying" | "running" | "explaining";
type StreamEvent =
  | { type: "step"; step: ChatStep }
  | { type: "result"; data: ChatResponse }
  | { type: "error"; status: number; code: string; message: string };

export type QueryResult = { columns: string[]; rows: CellValue[][]; row_count: number; truncated: boolean };

/** What chat.md keeps about an answer so it can be redrawn later (the rows are re-queried, not stored). */
export type SavedResult = { question: string; sql: string; chart: ChartSpec | null };

/** One saved message of the chat.md log (served by the Next route handler, not the Python backend). */
export type ChatLogEntry = {
  role: "user" | "assistant" | "system";
  content: string;
  ts: string;
  session: string | null; // which upload session (chat) it belongs to
  result?: SavedResult;
};

/* ───────────── Errors ───────────── */

export type ApiErrorKind = "network" | "client" | "server" | "aborted";

/** Always carries a message that is safe to show to the user as is. */
export class ApiError extends Error {
  constructor(
    public kind: ApiErrorKind,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something unexpected went wrong. Please try again.";
}

async function toApiError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null);
  const detail = body?.detail;
  const kind: ApiErrorKind = res.status >= 500 ? "server" : "client";

  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const rejected = detail.rejected as RejectedFile[] | undefined;
    if (rejected?.length) {
      const reasons = rejected.map((r) => `${r.name}: ${r.reason}`).join("\n");
      return new ApiError(kind, `We couldn't use ${rejected.length === 1 ? "that file" : "those files"}.\n${reasons}`, "rejected");
    }
    if (typeof detail.message === "string") return new ApiError(kind, detail.message, detail.code);
  }
  if (typeof detail === "string") {
    if (res.status === 404) return new ApiError(kind, "This session has expired. Please upload your CSV files again.", "session_not_found");
    return new ApiError(kind, detail);
  }
  if (res.status >= 500) return new ApiError(kind, "The server ran into a problem. Please try again in a moment.");
  return new ApiError(kind, "That request wasn't accepted. Please check it and try again.");
}

/** Turn a failed fetch into the right error: stopped by the user, timed out, or the backend is unreachable. */
function interrupted(signal?: AbortSignal): ApiError {
  if (signal?.aborted) {
    const reason = signal.reason;
    if (reason instanceof DOMException && reason.name === "TimeoutError") {
      return new ApiError(
        "aborted",
        "That took longer than a minute, so I stopped waiting. Try a simpler question, or try again.",
        "timeout",
      );
    }
    return new ApiError("aborted", "Stopped.", "stopped");
  }
  return new ApiError(
    "network",
    `I can't reach the server right now. Make sure the backend is running at ${API_URL}, then try again.`,
    "network",
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw interrupted(init?.signal ?? undefined);
  }
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

/* ───────────── Backend calls ───────────── */

export function uploadFiles(files: File[], sessionId: string | null): Promise<UploadResponse> {
  const form = new FormData();
  if (sessionId) form.append("session_id", sessionId);
  files.forEach((f) => form.append("files", f));
  return request<UploadResponse>("/files", { method: "POST", body: form });
}

/**
 * Upload one file, reporting how much of it has been sent (0..1). Uses XMLHttpRequest because fetch
 * can't report upload progress.
 */
export function uploadOne(file: File, sessionId: string | null, onProgress: (sent: number) => void): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    if (sessionId) form.append("session_id", sessionId);
    form.append("files", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/files`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.upload.onload = () => onProgress(1);
    xhr.onerror = () => reject(interrupted());
    xhr.onload = async () => {
      const res = new Response(xhr.responseText, { status: xhr.status, headers: { "Content-Type": "application/json" } });
      if (res.ok) resolve((await res.json()) as UploadResponse);
      else reject(await toApiError(res));
    };
    xhr.send(form);
  });
}

export type SampleEvent =
  | { type: "start"; session_id: string; files: string[] }
  | { type: "file"; name: string; stage: "reading" | "cleaning" | "ready" | "error"; rows?: number; reason?: string }
  | { type: "result"; data: UploadResponse }
  | { type: "error"; status: number; message: string };

/** Load the bundled "Online Shop 2024" sample files, reporting each file's progress as it happens. */
export async function loadSample(sessionId: string | null, onEvent: (e: SampleEvent) => void): Promise<UploadResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/files/sample`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
  } catch {
    throw interrupted();
  }
  if (!res.ok) throw await toApiError(res);
  let result: UploadResponse | null = null;
  await readNdjson(res, undefined, (raw) => {
    const event = raw as SampleEvent;
    if (event.type === "error") throw new ApiError(event.status >= 500 ? "server" : "client", event.message);
    if (event.type === "result") result = event.data;
    onEvent(event);
  });
  if (!result) throw new ApiError("server", "Loading the sample data was cut off. Please try again.");
  return result;
}

/** Add a CSV from a link: a direct URL, or a Google Drive / Sheets, Dropbox or GitHub share link. */
export function uploadFromUrl(url: string, sessionId: string | null): Promise<UploadResponse> {
  return request<UploadResponse>("/files/url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, session_id: sessionId }),
  });
}

/** Remove an uploaded file (its table, its CSV and its links). Returns what is left in the session. */
export function deleteFile(sessionId: string, name: string): Promise<SessionFiles> {
  return request<SessionFiles>(`/files/${encodeURIComponent(name)}?session_id=${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

export type Health = { status: string; groq_key_configured: boolean; model: string | null };

export function getHealth(): Promise<Health> {
  return request<Health>("/health");
}

/** Returns null when the backend no longer knows the session. */
export async function getFiles(sessionId: string): Promise<SessionFiles | null> {
  try {
    return await request<SessionFiles>(`/files?session_id=${encodeURIComponent(sessionId)}`);
  } catch (e) {
    if (e instanceof ApiError && e.code === "session_not_found") return null;
    throw e;
  }
}

/** Read a newline-delimited JSON stream, calling `handle` for each object. */
async function readNdjson(res: Response, signal: AbortSignal | undefined, handle: (event: unknown) => void): Promise<void> {
  if (!res.body) throw new ApiError("server", "The server sent an empty reply. Please try again.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) handle(JSON.parse(line));
      }
    }
    if (buffer.trim()) handle(JSON.parse(buffer.trim()));
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw interrupted(signal);
  } finally {
    reader.cancel().catch(() => {});
  }
}

/**
 * Ask a question. The backend streams its progress, so `onStep` fires as each stage starts.
 * Pass an AbortSignal to stop waiting: the request is cancelled and the backend does no further work.
 */
export async function sendChat(
  req: ChatRequest,
  opts: { signal?: AbortSignal; onStep?: (step: ChatStep) => void } = {},
): Promise<ChatResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: opts.signal,
    });
  } catch {
    throw interrupted(opts.signal);
  }
  if (!res.ok || !res.body) throw await toApiError(res);

  let result: ChatResponse | null = null;
  await readNdjson(res, opts.signal, (raw) => {
    const event = raw as StreamEvent;
    if (event.type === "step") opts.onStep?.(event.step);
    else if (event.type === "result") result = event.data;
    else throw new ApiError(event.status >= 500 ? "server" : "client", event.message, event.code);
  });

  if (!result) throw new ApiError("server", "The answer was cut off before it finished. Please try again.");
  return result;
}

/** Re-runs the SQL of an earlier answer against the session's tables. */
export function runQuery(sessionId: string, sql: string): Promise<QueryResult> {
  return request<QueryResult>("/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, sql }),
  });
}

/* ───────────── chat.md log (same-origin Next route) ───────────── */

export async function loadChatLog(): Promise<ChatLogEntry[]> {
  try {
    const res = await fetch("/api/chat-log");
    return res.ok ? ((await res.json()) as { messages: ChatLogEntry[] }).messages : [];
  } catch {
    return [];
  }
}

/** Fire and forget: failing to save history must never get in the user's way. */
export function appendChatLog(entry: ChatLogEntry): void {
  fetch("/api/chat-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  }).catch(() => {});
}
