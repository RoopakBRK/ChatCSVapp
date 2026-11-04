"""Chat history, kept per session in data/sessions/<id>/history.json.

Only the browser that holds a session id can read that session's history (GET /sessions/{id}/history),
so nobody sees anyone else's chats. Deleting the session folder (idle cleanup or the bin icon)
deletes its history with it.

A question is saved together with its reply, and only when it was answered (an answer, a
clarifying question or a plain reply). Failed or stopped questions are never saved, so asking one
again can't put it in the model's history twice.
"""
import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from chatapp.sessions import is_valid_session_id, session_dir

FILE_NAME = "history.json"
LLM_TURNS = 8  # earlier messages the model sees with each new question

_locks: dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


def _lock(session_id: str) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(session_id, threading.Lock())


def _path(session_id: str) -> Path:
    return session_dir(session_id) / FILE_NAME


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def new_id() -> str:
    return uuid.uuid4().hex


def entry(role: str, kind: str, text: str, answer: dict[str, Any] | None = None, *, id: str | None = None,
          ts: str | None = None) -> dict[str, Any]:
    """One message. kind: question | answer | clarification | reply | notice."""
    item: dict[str, Any] = {"id": id or new_id(), "role": role, "kind": kind, "text": text, "ts": ts or now()}
    if answer is not None:
        item["answer"] = answer
    return item


def load(session_id: str) -> list[dict[str, Any]]:
    """Every saved message of the session, oldest first ([] when there are none or the file is unreadable)."""
    if not is_valid_session_id(session_id):
        return []
    try:
        data = json.loads(_path(session_id).read_text())
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def append(session_id: str, *entries: dict[str, Any]) -> None:
    """Add messages. The file is rewritten atomically, so a crash never leaves half a history."""
    folder = session_dir(session_id)
    if not folder.is_dir():
        return  # the session was deleted meanwhile
    with _lock(session_id):
        items = load(session_id) + list(entries)
        tmp = folder / f".{FILE_NAME}.{uuid.uuid4().hex}.tmp"
        tmp.write_text(json.dumps(items, default=str))
        tmp.replace(folder / FILE_NAME)


def notice(session_id: str, text: str) -> None:
    append(session_id, entry("system", "notice", text))


def find_answer(session_id: str, answer_id: str) -> dict[str, Any] | None:
    """The saved answer with this id ({question, sql, chart, ...}), or None."""
    for item in load(session_id):
        if item.get("kind") == "answer" and item.get("id") == answer_id and item.get("answer"):
            return item["answer"]
    return None


def llm_turns(session_id: str, limit: int = LLM_TURNS) -> list[dict[str, str]]:
    """The last few questions and replies, in the shape the model expects."""
    turns: list[dict[str, str]] = []
    for item in load(session_id):
        kind = item.get("kind")
        if kind == "question":
            turns.append({"role": "user", "content": item["text"]})
        elif kind == "answer":
            sql = (item.get("answer") or {}).get("sql", "")
            turns.append({"role": "assistant", "content": f"{item['text']}\n(SQL used: {sql})" if sql else item["text"]})
        elif kind in ("clarification", "reply"):
            turns.append({"role": "assistant", "content": item["text"]})
    return turns[-limit:]
