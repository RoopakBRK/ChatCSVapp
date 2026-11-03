import logging

import duckdb
from fastapi import HTTPException

from chatapp import llm
from chatapp.session_db import get_session
from chatapp.sessions import is_valid_session_id
from schemas.chat import ChartOut, ChatAnswer, ChatClarification, ChatRequest, ChatResponse
from schemas.llm import ChartSpec

logger = logging.getLogger(__name__)

MAX_PIE_SLICES = 12
SQL_ATTEMPTS = 2  # the first try, plus one repair after a failed query


def fail(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})


def _is_number(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def check_chart(spec: ChartSpec | None, columns: list[str], rows: list[list]) -> ChartOut | None:
    """Keep the model's chart only if it matches the data it will be drawn from."""
    if spec is None or spec.type == "none" or not rows:
        return None
    lookup = {c.lower(): c for c in columns}
    x, y = lookup.get((spec.x or "").lower()), lookup.get((spec.y or "").lower())
    if x is None or y is None or x == y:
        return None
    y_values = [r[columns.index(y)] for r in rows if r[columns.index(y)] is not None]
    if not y_values or not all(_is_number(v) for v in y_values):
        return None
    kind = spec.type
    if kind == "pie" and (len(rows) > MAX_PIE_SLICES or any(v < 0 for v in y_values)):
        kind = "bar"
    return ChartOut(type=kind, x=x, y=y, title=spec.title or "")


def answer_question(req: ChatRequest) -> ChatResponse:
    """Question in, validated answer (SQL result + chart + explanation) or a clarifying question out."""
    if not is_valid_session_id(req.session_id):
        raise fail(400, "invalid_session", "That session isn't valid. Please upload your files again.")
    db = get_session(req.session_id)
    if db is None:
        raise fail(404, "session_not_found", "This session has expired. Please upload your CSV files again.")
    files = db.summaries()
    if not files:
        raise fail(409, "no_files", "Upload at least one CSV file before asking a question.")

    history = [t.model_dump() for t in req.history]
    feedback: list[dict[str, str]] = []
    plan = None
    result = None

    try:
        for attempt in range(SQL_ATTEMPTS):
            plan = llm.generate_plan(req.message, files, db.relationships, history, feedback)
            if plan.needs_clarification:
                return ChatClarification(question=plan.question or "Could you tell me more about what you need?")
            try:
                result = db.run_query(plan.sql)
                break
            except duckdb.Error as exc:
                logger.info("SQL failed (attempt %d): %s | %s", attempt + 1, exc, plan.sql)
                feedback = [
                    {"role": "assistant", "content": plan.model_dump_json()},
                    {"role": "user", "content": f"That SQL failed in DuckDB with: {exc}\n"
                                                "Fix the query using only the listed tables and columns, "
                                                "and reply in the same JSON format."},
                ]
        if result is None:
            raise fail(422, "cannot_answer",
                       "I couldn't work out a query that answers that from your data. Try rephrasing, "
                       "or ask about columns that appear in your uploaded files.")

        columns, rows, truncated = result
        try:
            explanation = llm.explain_result(req.message, columns, rows, len(rows), truncated)
        except llm.LLMError:
            logger.exception("Explanation failed; returning the data without it")
            explanation = "Here is what I found." if rows else "No rows matched that question."
    except llm.LLMConfigError as exc:
        logger.error("LLM not configured: %s", exc)
        raise fail(503, "llm_not_configured", "The AI service isn't set up on the server (missing API key).")
    except llm.LLMRateLimitError as exc:
        logger.warning("LLM rate limited: %s", exc)
        raise fail(429, "rate_limited", "The AI service is busy right now (rate limit reached). "
                                        "Please wait a few seconds and try again.")
    except llm.LLMError as exc:
        logger.error("LLM failed: %s", exc)
        raise fail(502, "llm_unavailable", "The AI service didn't respond properly. Please try again in a moment.")

    return ChatAnswer(
        explanation=explanation, sql=plan.sql, chart=check_chart(plan.chart, columns, rows),
        columns=columns, rows=rows, row_count=len(rows), truncated=truncated,
    )
