import duckdb

from api.errors import fail
from chatapp import history
from chatapp.session_db import get_session
from chatapp.sessions import is_valid_session_id
from schemas.chat import QueryRequest, QueryResult


def run_saved_query(req: QueryRequest) -> QueryResult:
    """Re-run the query of an answer saved in this session's history (never SQL sent by the browser)."""
    if not is_valid_session_id(req.session_id):
        raise fail(400, "invalid_session", "That session isn't valid.")
    saved = history.find_answer(req.session_id, req.answer_id)
    if saved is None:
        raise fail(404, "answer_not_found", "That answer isn't in this chat.")
    db = get_session(req.session_id)
    if db is None:
        raise fail(404, "session_not_found", "The files for this chat are no longer available. Upload them again to see the results.")
    try:
        columns, rows, truncated = db.run_query(saved["sql"])  # parser check + rolled-back transaction
    except duckdb.Error:
        raise fail(422, "query_failed", "That earlier query can't be run against the current data.")
    return QueryResult(columns=columns, rows=rows, row_count=len(rows), truncated=truncated)
