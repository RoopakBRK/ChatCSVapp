"""Per-session storage for uploaded CSV files.

Each session gets its own directory: data/sessions/<session_id>/<file>.csv
"""
import re
import uuid
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "sessions"

_SESSION_ID = re.compile(r"^[0-9a-f]{32}$")


def is_valid_session_id(value: str) -> bool:
    return bool(_SESSION_ID.match(value))


def session_dir(session_id: str) -> Path:
    if not is_valid_session_id(session_id):
        raise ValueError("Invalid session id")
    return DATA_DIR / session_id


def get_or_create_session(session_id: str | None) -> str:
    """Reuse an existing session, otherwise start a new one."""
    if session_id and is_valid_session_id(session_id) and session_dir(session_id).is_dir():
        return session_id
    new_id = uuid.uuid4().hex
    session_dir(new_id).mkdir(parents=True, exist_ok=True)
    return new_id
