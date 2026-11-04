import json
import logging
import time
from typing import Iterator

import duckdb
from fastapi import HTTPException

from api.errors import fail
from chatapp import history, llm
from chatapp.explain import quick_explanation
from chatapp.config import settings
from chatapp.session_db import get_session
from chatapp.sessions import is_valid_session_id
from schemas.chat import ChartOut, ChatAnswer, ChatClarification, ChatReply, ChatRequest, ChatResponse
from schemas.llm import ChartSpec

logger = logging.getLogger(__name__)

MAX_PIE_SLICES = 12
SQL_ATTEMPTS = 2  # the first try, plus one repair after a failed query


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
    if kind == "scatter":
        x_values = [r[columns.index(x)] for r in rows if r[columns.index(x)] is not None]
        if not x_values or not all(_is_number(v) for v in x_values):
            kind = "bar"  # a scatter needs a numeric x; fall back to something that still reads
    if kind == "pie" and (len(rows) > MAX_PIE_SLICES or any(v < 0 for v in y_values)):
        kind = "bar"
    return ChartOut(type=kind, x=x, y=y, title=spec.title or "")


def _step(name: str) -> dict:
    return {"type": "step", "step": name}


def answer_events(req: ChatRequest) -> Iterator[dict]:
    """Work out an answer, yielding progress steps and finally a result (or an error) event.

    Both /chat and /chat/stream use this. The work is lazy: if the client goes away, nothing
    after the step it is on gets done."""
    try:
        yield from _answer(req)
    except HTTPException as exc:
        yield {"type": "error", "status": exc.status_code, **exc.detail}


def _answer(req: ChatRequest) -> Iterator[dict]:
    if not is_valid_session_id(req.session_id):
        raise fail(400, "invalid_session", "That session isn't valid. Please upload your files again.")
    yield _step("reading")  # open the session's tables and describe them for the model
    db = get_session(req.session_id)
    if db is None:
        raise fail(404, "session_not_found", "This session has expired. Please upload your CSV files again.")
    files = db.summaries()
    if not files:
        raise fail(409, "no_files", "Upload at least one CSV file before asking a question.")

    deadline = time.monotonic() + settings.question_deadline_seconds  # one budget for the whole question
    turns = history.llm_turns(req.session_id)  # earlier questions and replies, saved on the server
    feedback: list[dict[str, str]] = []
    plan = None
    result = None

    try:
        for attempt in range(SQL_ATTEMPTS):
            yield _step("querying")  # the model reads the question and writes the SQL
            plan = llm.generate_plan(req.message, files, db.relationships, turns, feedback, deadline=deadline,
                                     effort=req.effort)
            if plan.needs_clarification:
                question = plan.question or "Could you tell me more about what you need?"
                _save(req, history.entry("assistant", "clarification", question))
                yield {"type": "result", "data": ChatClarification(question=question)}
                return
            if plan.reply:  # "hi", "what can you do?": answered in words, no data needed
                _save(req, history.entry("assistant", "reply", plan.reply))
                yield {"type": "result", "data": ChatReply(text=plan.reply)}
                return
            # The SQL is written; it is checked (read-only, single statement) and run against the tables.
            yield _step("running")
            left = deadline - time.monotonic()
            if left <= 0:
                raise llm.LLMTimeoutError("deadline reached before the query could run")
            try:
                result = db.run_query(plan.sql, timeout=min(settings.query_timeout_seconds, left))
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
        chart = check_chart(plan.chart, columns, rows)  # keep the suggested chart only if it fits the data
        yield _step("explaining")
        # A single number, a short list or a list of columns is written in code: no second AI call.
        explanation = quick_explanation(plan.sql, columns, rows, truncated)
        if explanation is None:
            try:
                explanation = llm.explain_result(req.message, columns, rows, len(rows), truncated, deadline=deadline)
            except llm.LLMError:
                logger.exception("Explanation failed; returning the data without it")
                explanation = "Here is what I found." if rows else "No rows matched that question."
    except llm.LLMConfigError as exc:
        logger.error("LLM not configured: %s", exc)
        raise fail(503, "llm_not_configured", "The AI service isn't set up on the server (missing API key).")
    except llm.LLMTimeoutError:
        raise fail(504, "timeout", "That took longer than a minute, so I stopped. Try a simpler question, or try again.")
    except llm.LLMRateLimitError as exc:
        logger.warning("LLM rate limited: %s", exc)
        if exc.wait:
            secs = max(1, round(exc.wait))
            raise fail(429, "rate_limited", f"The AI service is busy (rate limit reached). Groq asked us to wait {secs} s, "
                                            f"which is longer than this question has left. Please try again in {secs} s.")
        raise fail(429, "rate_limited", "The AI service is busy right now (rate limit reached). "
                                        "Please wait a few seconds and try again.")
    except llm.LLMError as exc:
        if "read-only SELECT" in str(exc):  # the model kept writing SQL that changes data; it was blocked
            logger.info("Blocked a request to change data: %s", exc)
            raise fail(422, "read_only", "I can only read and analyse your files, not change them. "
                                         "Try asking a question about the data instead.")
        logger.error("LLM failed: %s", exc)
        raise fail(502, "llm_unavailable", "The AI service didn't respond properly. Please try again in a moment.")

    answer_id = history.new_id()
    _save(req, history.entry("assistant", "answer", explanation, id=answer_id, answer={
        "question": req.message, "sql": plan.sql, "chart": chart.model_dump() if chart else None, "row_count": len(rows),
    }))
    yield {"type": "result", "data": ChatAnswer(
        id=answer_id, explanation=explanation, sql=plan.sql, chart=chart,
        columns=columns, rows=rows, row_count=len(rows), truncated=truncated,
    )}


def _save(req: ChatRequest, reply: dict) -> None:
    """Save the question with its reply. Only answered questions are saved: a failed or stopped one is
    not, so asking it again never puts it in the model's history twice."""
    history.append(req.session_id, history.entry("user", "question", req.message), reply)


def answer_question(req: ChatRequest) -> ChatResponse:
    """One-shot version: returns the final answer (or raises an HTTP error)."""
    for event in answer_events(req):
        if event["type"] == "error":
            raise fail(event["status"], event["code"], event["message"])
        if event["type"] == "result":
            return event["data"]
    raise fail(502, "llm_unavailable", "No answer was produced. Please try again.")


def stream_answer(req: ChatRequest) -> Iterator[str]:
    """Newline-delimited JSON: {"type":"step",...} lines, then one {"type":"result"} or {"type":"error"}."""
    for event in answer_events(req):
        if event["type"] == "result":
            event = {"type": "result", "data": event["data"].model_dump(mode="json")}
        yield json.dumps(event) + "\n"
