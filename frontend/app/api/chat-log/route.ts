import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// chat.md lives at the repo root so it survives restarts and is easy to open.
const CHAT_FILE = path.join(process.cwd(), "..", "chat.md");

// <!-- msg role=user ts=2026-01-01T00:00:00.000Z session=abc123 -->   (session is optional)
const MARKER = /^<!-- msg role=(user|assistant|system) ts=(\S+?)(?: session=([0-9a-f]{32}))? -->$/;
// <!-- result {"question":"...","sql":"...","chart":null} -->   (what is needed to redraw an answer)
const RESULT = /^<!-- result (\{.*\}) -->$/;

type Role = "user" | "assistant" | "system";
type Entry = { role: Role; ts: string; session: string | null; content: string; result?: unknown };

export async function GET() {
  let raw = "";
  try {
    raw = await readFile(CHAT_FILE, "utf8");
  } catch {
    // Create the file up front so it is visible in the project folder straight away.
    await writeFile(CHAT_FILE, "# Chat history\n\n", { flag: "a" });
    return Response.json({ messages: [] });
  }

  const messages: Entry[] = [];
  let current: (Omit<Entry, "content"> & { lines: string[] }) | null = null;
  const flush = () => {
    if (current) {
      const { lines, ...rest } = current;
      // Drop the human-readable "**You** · timestamp" header line.
      messages.push({ ...rest, content: lines.slice(1).join("\n").trim() });
    }
  };

  for (const line of raw.split("\n")) {
    const m = MARKER.exec(line);
    if (m) {
      flush();
      current = { role: m[1] as Role, ts: m[2], session: m[3] ?? null, lines: [] };
      continue;
    }
    if (!current) continue;
    const r = RESULT.exec(line);
    if (r) {
      try {
        current.result = JSON.parse(r[1]);
      } catch {
        /* a damaged result line just means that answer can't be redrawn */
      }
    } else {
      current.lines.push(line);
    }
  }
  flush();

  return Response.json({ messages });
}

export async function POST(request: Request) {
  const { role, content, ts, session, result } = (await request.json()) as {
    role: Role;
    content: string;
    ts?: string;
    session?: string | null;
    result?: unknown;
  };
  if (!["user", "assistant", "system"].includes(role) || typeof content !== "string") {
    return Response.json({ error: "Invalid message" }, { status: 400 });
  }
  if (session && !/^[0-9a-f]{32}$/.test(session)) {
    return Response.json({ error: "Invalid session" }, { status: 400 });
  }

  const stamp = ts ?? new Date().toISOString();
  const label = role === "user" ? "You" : role === "assistant" ? "Assistant" : "System";
  const marker = `<!-- msg role=${role} ts=${stamp}${session ? ` session=${session}` : ""} -->`;
  // ">" is escaped so a stray "-->" inside the SQL can never end the comment early.
  const resultLine = result ? `\n<!-- result ${JSON.stringify(result).replace(/>/g, "\\u003e")} -->` : "";
  await appendFile(CHAT_FILE, `${marker}\n**${label}** · ${stamp}\n\n${content.trim()}\n${resultLine}\n\n`, "utf8");
  return Response.json({ ok: true });
}
