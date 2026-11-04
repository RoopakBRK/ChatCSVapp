from api.errors import fail
from chatapp import history
from chatapp.session_db import delete_session
from chatapp.sessions import is_valid_session_id, session_dir
from schemas.chat import SessionHistory


def _check(session_id: str) -> None:
    if not is_valid_session_id(session_id):
        raise fail(400, "invalid_session", "That session isn't valid.")


def get_history(session_id: str) -> SessionHistory:
    """This session's messages only. Only someone who already holds the session id can ask for it."""
    _check(session_id)
    if not session_dir(session_id).is_dir():
        raise fail(404, "session_not_found", "This chat no longer exists.")
    return SessionHistory(session_id=session_id, messages=history.load(session_id))


def remove_session(session_id: str) -> dict:
    """Delete a chat for good: its files, tables and history."""
    _check(session_id)
    if not delete_session(session_id):
        raise fail(404, "session_not_found", "This chat no longer exists.")
    return {"deleted": session_id}
