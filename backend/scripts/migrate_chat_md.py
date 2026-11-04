"""One-time move of the old chat.md app log into each session's history.json.

    cd backend/src && ../.venv/bin/python ../scripts/migrate_chat_md.py ../../chat.md [http://localhost:3000]

Only sessions whose folder still exists are migrated, and an existing history.json is never
overwritten. Questions that never got an answer (and the error notices after them) are left out,
the same rule the app now follows.

Prints the migrated chats and a one-time link (…/chat#chats=<id>,<id>) that adds them to the chat
list of the browser that opens it. The ids are never put in the app's code, so no other visitor
gets them.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from chatapp import history  # noqa: E402
from chatapp.sessions import session_dir  # noqa: E402

MARKER = re.compile(r"^<!-- msg role=(user|assistant|system) ts=(\S+?)(?: session=([0-9a-f]{32}))? -->$")
RESULT = re.compile(r"^<!-- result (\{.*\}) -->$")
KEEP_NOTICES = ("Uploaded", "Loaded sample data", "Removed")


def parse(text: str) -> list[dict]:
    """The app-log messages of chat.md: {role, ts, session, content, result?}."""
    messages, current = [], None
    for line in text.split("\n"):
        m = MARKER.match(line)
        if m:
            if current:
                messages.append(current)
            current = {"role": m[1], "ts": m[2], "session": m[3], "lines": []}
            continue
        if current is None:
            continue
        r = RESULT.match(line)
        if r:
            try:
                current["result"] = json.loads(r[1])
            except ValueError:
                pass
        else:
            current["lines"].append(line)
    if current:
        messages.append(current)
    for m in messages:
        m["content"] = "\n".join(m.pop("lines")[1:]).strip()  # drop the "**You** · ts" header line
    return messages


def to_history(messages: list[dict]) -> list[dict]:
    out = []
    for i, m in enumerate(messages):
        nxt = messages[i + 1] if i + 1 < len(messages) else None
        if m["role"] == "user":
            if nxt is None or nxt["role"] != "assistant":
                continue  # never answered
            out.append(history.entry("user", "question", m["content"], ts=m["ts"]))
        elif m["role"] == "assistant":
            result = m.get("result")
            if result and result.get("sql"):
                text = m["content"].split("\n\n```sql")[0].strip()
                out.append(history.entry("assistant", "answer", text, ts=m["ts"], answer={
                    "question": result.get("question", ""), "sql": result["sql"], "chart": result.get("chart"), "row_count": None,
                }))
            else:
                out.append(history.entry("assistant", "reply", m["content"], ts=m["ts"]))
        elif m["content"].startswith(KEEP_NOTICES):
            out.append(history.entry("system", "notice", m["content"], ts=m["ts"]))
    return out


def migrate(chat_md: Path) -> list[dict]:
    by_session: dict[str, list[dict]] = {}
    for m in parse(chat_md.read_text()):
        if m["session"]:
            by_session.setdefault(m["session"], []).append(m)
    chats = []
    for sid, messages in by_session.items():
        folder = session_dir(sid)
        if not folder.is_dir() or (folder / history.FILE_NAME).exists():
            continue
        items = to_history(messages)
        if not items:
            continue
        history.append(sid, *items)
        first = next((i["text"] for i in items if i["kind"] == "question"), None)
        title = (first[:47] + "…" if len(first) > 48 else first) if first else "New chat"
        chats.append({"id": sid, "title": title, "lastTs": items[-1]["ts"]})
    return sorted(chats, key=lambda c: c["lastTs"], reverse=True)


if __name__ == "__main__":
    source = Path(sys.argv[1] if len(sys.argv) > 1 else "../../chat.md")
    site = (sys.argv[2] if len(sys.argv) > 2 else "http://localhost:3000").rstrip("/")
    chats = migrate(source)
    print(json.dumps(chats, indent=2, ensure_ascii=False))
    if chats:
        print(f"\nOpen once to add them to your chat list:\n{site}/chat#chats={','.join(c['id'] for c in chats)}")
