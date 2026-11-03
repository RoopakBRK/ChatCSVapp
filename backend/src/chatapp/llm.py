"""All Groq / LLM access lives here.

  generate_plan()   question + table schemas -> validated LLMResponse (SQL, chart spec, or a
                    clarifying question)
  explain_result()  question + the rows the SQL actually returned -> a short written answer

Both calls share one retry loop. Each call has its own timeout and at most one retry (connection
errors, timeouts, rate limits, 5xx responses, unparseable / invalid output), and a caller can pass a
`deadline` that caps the total time for a whole question across all calls.
"""
import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Callable, TypeVar

from dotenv import load_dotenv
from groq import APIConnectionError, APIStatusError, APITimeoutError, Groq, GroqError, RateLimitError

from schemas.files import FileSummary, Relationship
from schemas.llm import LLMResponse

logger = logging.getLogger(__name__)

MODEL = "openai/gpt-oss-20b"
TIMEOUT_SECONDS = 20.0  # per call; shortened further when a deadline is close
MAX_RETRIES = 1  # one retry after the first attempt, so at most 2 calls
BACKOFF_SECONDS = 1.0
MAX_WAIT_SECONDS = 10.0  # longest we will wait between retries, even if Groq asks for more
EXPLAIN_ROWS = 30  # rows of the result shown to the model when it writes the explanation

T = TypeVar("T")

PLAN_PROMPT = """You are a careful data analyst. You answer questions about the user's CSV files by writing DuckDB SQL.

Each CSV is a table (names below). Use only these tables and columns; never invent any.

Reply with ONE JSON object and nothing else, exactly this shape:
{
  "sql": "<one read-only DuckDB SELECT query, or null>",
  "chart": {"type": "bar|line|pie|scatter|none", "x": "<result column>", "y": "<numeric result column>", "title": "<short title>"},
  "needs_clarification": true or false,
  "question": "<question for the user, or null>"
}

SQL rules:
- A single SELECT (CTEs allowed). No semicolons, no INSERT/UPDATE/DELETE/DDL/PRAGMA/SET.
- Give every computed column a readable alias (revenue, order_count, month).
- Join tables only along the listed links. If the two columns have different types, CAST both to VARCHAR.
- NULL means the value was missing in the file; it is not zero. Do not treat missing values as 0.
- For "top N" or lists use ORDER BY and a sensible LIMIT (at most 100 unless asked). Sort time series by date ascending.
- Match text filters to the exact values listed in braces when a column has them.
- "Latest", "last year" or "recent" refer to the data's own date range (shown in brackets), not today's date.

Questions about the data itself (which columns exist, their types, how many rows) are answered with SQL too:
use information_schema.columns (table_name, column_name, data_type) or COUNT(*). Only leave sql null when
you ask for clarification.

Chart rules:
- bar: compare categories. line: a trend over time (x is a date or month, sorted ascending). pie: shares of a whole, at most 8 slices.
- scatter: the relationship between two numeric columns (both x and y numeric).
- none: a single number, a plain list of rows, or anything that does not chart well. Then set x, y and title to null.
- x and y must be column names (or aliases) of the SQL result, and y must be numeric.

Clarification rules:
- If the question is too vague, or cannot be answered from these tables, set needs_clarification to true, put one short, friendly question in "question" (name what is missing and suggest what you can answer), and set sql and chart to null.
- Otherwise set needs_clarification to false and question to null.

Data:
"""

EXPLAIN_PROMPT = """You explain query results to a non-technical user.
Write 1 to 3 plain sentences that directly answer the question, using ONLY the numbers and names in the rows provided.
Do not invent values, do not mention SQL, and do not repeat the whole table.
Round numbers for reading: at most 2 decimals, with thousands separators (510.99, 3,737,818.32). If the result has no rows, say plainly what was looked for and that none was found (for example "No column appears in all 8 tables."), not just "nothing matched".
If the rows are only part of the result (see "truncated"), say so briefly. Reply with the text only."""


class LLMError(Exception):
    """The model could not produce a usable response after all retries."""


class LLMTimeoutError(LLMError):
    """The deadline for the whole question ran out."""


class LLMRateLimitError(LLMError):
    """Groq kept answering 429 (rate limit) through every retry."""


class LLMConfigError(LLMError):
    """The Groq client could not be created (usually a missing GROQ_API_KEY)."""


def is_configured() -> bool:
    """Whether a Groq API key is available. Never returns or logs the key itself."""
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    return bool(os.getenv("GROQ_API_KEY", "").strip())


def _client() -> Groq:
    # Reads GROQ_API_KEY from the environment, loading backend/.env if present.
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    try:
        # max_retries=0: retries are handled in _complete so they also cover invalid output.
        return Groq(timeout=TIMEOUT_SECONDS, max_retries=0)
    except GroqError as exc:
        raise LLMConfigError(str(exc)) from exc


def describe_schema(files: list[FileSummary], relationships: list[Relationship]) -> str:
    """Compact text description of the tables, their joins and what cleaning did."""

    def column(c) -> str:
        text = f"{c.name} {c.type}"
        if c.distinct_values:
            text += " {" + " | ".join(c.distinct_values) + "}"
        elif c.min is not None:
            text += f" [{c.min} .. {c.max}]"
        if c.missing:
            text += f" ({c.missing} missing)"
        return text

    lines = ["Tables:"]
    for f in files:
        lines.append(f"- {f.table_name} ({f.row_count} rows): " + ", ".join(column(c) for c in f.columns))

    if relationships:
        lines.append("\nLinks between tables:")
        for r in relationships:
            note = f"{r.cardinality.replace('_', '-')}, {r.match_pct:g}% of values match"
            if r.unmatched_values:
                note += f", {r.unmatched_values} unmatched"
            if r.type_mismatch:
                note += ", different types: CAST both to VARCHAR"
            lines.append(f"- {r.join} ({note})")

    notes = []
    for f in files:
        for s in f.cleaning_steps:
            if s.action in ("drop_empty_rows", "drop_duplicate_rows"):
                notes.append(f"{f.table_name}: {s.count} rows removed ({s.action.replace('drop_', '').replace('_', ' ')})")
            elif s.action == "kept_as_text":
                notes.append(f"{f.table_name}.{s.column}: kept as text ({s.detail})")
        for o in f.outliers:
            notes.append(f"{f.table_name}.{o.column}: {o.count} outliers flagged but kept in the data")
    if notes:
        lines.append("\nCleaning notes:")
        lines += [f"- {n}" for n in notes]
    return "\n".join(lines)


def _is_retryable(exc: Exception) -> bool:
    if isinstance(exc, (APIConnectionError, APITimeoutError, RateLimitError)):
        return True
    return isinstance(exc, APIStatusError) and exc.status_code >= 500


def _retry_after(exc: Exception | None) -> float:
    """Seconds Groq asks us to wait (Retry-After header on a 429), else 0."""
    if isinstance(exc, RateLimitError):
        try:
            return float(exc.response.headers.get("retry-after", 0))
        except (TypeError, ValueError):
            return 0.0
    return 0.0


def _complete(
    client: Groq,
    messages: list[dict[str, str]],
    parse: Callable[[str], T],
    *,
    json_mode: bool,
    reasoning_effort: str | None = None,
    max_tokens: int = 2048,
    deadline: float | None = None,  # time.monotonic() value after which we give up
) -> T:
    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES + 1):
        timeout = TIMEOUT_SECONDS
        if deadline is not None:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise LLMTimeoutError("Ran out of time before the AI service answered")
            timeout = min(timeout, remaining)
        try:
            kwargs: dict[str, Any] = dict(
                model=MODEL, messages=messages, temperature=0, max_completion_tokens=max_tokens, timeout=timeout)
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            if reasoning_effort:
                kwargs["reasoning_effort"] = reasoning_effort
            completion = client.chat.completions.create(**kwargs)
            content = completion.choices[0].message.content or ""
            try:
                return parse(content)
            except ValueError as exc:  # bad JSON, failed pydantic validation, empty text
                last_error = exc
                logger.warning("LLM output invalid (attempt %d): %s", attempt + 1, exc)
                # Asking again with the same prompt would just repeat the mistake, so say what was wrong.
                problem = str(exc).strip().splitlines()[-2:] if json_mode else ["it was empty"]
                messages = messages + [
                    {"role": "assistant", "content": content or "(empty reply)"},
                    {"role": "user", "content": "That reply was not valid: " + " ".join(p.strip() for p in problem)
                     + (". Reply again with ONE valid JSON object in the required format." if json_mode
                        else ". Reply with the answer text only.")},
                ]
        except Exception as exc:
            if not _is_retryable(exc):
                raise LLMError(f"Groq request failed: {exc}") from exc
            last_error = exc
            logger.warning("Groq call failed (attempt %d): %s", attempt + 1, exc)

        if attempt < MAX_RETRIES:
            wait = min(MAX_WAIT_SECONDS, max(BACKOFF_SECONDS * 2**attempt, _retry_after(last_error)))
            if deadline is not None and time.monotonic() + wait >= deadline:
                raise LLMTimeoutError("Ran out of time before the AI service answered")
            time.sleep(wait)

    if isinstance(last_error, RateLimitError):
        raise LLMRateLimitError(f"Rate limited after {MAX_RETRIES + 1} attempts: {last_error}")
    raise LLMError(f"No valid response after {MAX_RETRIES + 1} attempts: {last_error}")


def generate_plan(
    question: str,
    files: list[FileSummary],
    relationships: list[Relationship],
    history: list[dict[str, str]] | None = None,
    feedback: list[dict[str, str]] | None = None,
    client: Groq | None = None,
    deadline: float | None = None,
) -> LLMResponse:
    """Ask for SQL / chart / clarification. `feedback` carries a failed attempt back to the model."""
    client = client or _client()
    messages = [{"role": "system", "content": PLAN_PROMPT + describe_schema(files, relationships)}]
    messages += history or []
    messages.append({"role": "user", "content": question})
    messages += feedback or []
    return _complete(
        client, messages, lambda text: LLMResponse.model_validate(json.loads(text)), json_mode=True, deadline=deadline)


def explain_result(
    question: str,
    columns: list[str],
    rows: list[list[Any]],
    total_rows: int,
    truncated: bool,
    client: Groq | None = None,
    deadline: float | None = None,
) -> str:
    """Write a short answer grounded in the rows that the query really returned."""
    client = client or _client()
    payload = {
        "question": question,
        "columns": columns,
        "rows": rows[:EXPLAIN_ROWS],
        "rows_shown": min(len(rows), EXPLAIN_ROWS),
        "total_rows": total_rows,
        "truncated": truncated or total_rows > EXPLAIN_ROWS,
    }
    messages = [
        {"role": "system", "content": EXPLAIN_PROMPT},
        {"role": "user", "content": json.dumps(payload, default=str)},
    ]

    def parse(text: str) -> str:
        text = text.strip()
        if not text:
            raise ValueError("empty explanation")
        return text[:1200]

    return _complete(client, messages, parse, json_mode=False, reasoning_effort="low", max_tokens=1024, deadline=deadline)
