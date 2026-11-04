from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """One question. Earlier messages come from the session's saved history, never from the browser."""

    message: str = Field(min_length=1, max_length=2000)
    session_id: str


class ChartOut(BaseModel):
    type: Literal["bar", "line", "pie", "scatter"]
    x: str
    y: str
    title: str


class ChatAnswer(BaseModel):
    type: Literal["answer"] = "answer"
    id: str  # saved in the session's history; POST /query re-runs it by this id
    explanation: str
    sql: str
    chart: ChartOut | None  # None when no chart suits the result
    columns: list[str]
    rows: list[list[Any]]
    row_count: int  # rows returned (capped at the row limit)
    truncated: bool  # more rows existed than were returned


class ChatClarification(BaseModel):
    type: Literal["clarification"] = "clarification"
    question: str


class ChatReply(BaseModel):
    """A plain text answer that needed no data (a greeting, "what can you do?")."""

    type: Literal["reply"] = "reply"
    text: str


ChatResponse = ChatAnswer | ChatClarification | ChatReply


class ChatErrorDetail(BaseModel):
    code: str
    message: str


class QueryRequest(BaseModel):
    """Re-run a saved answer's query by its id, so a past chat can show its chart and table again.
    Raw SQL is not accepted: only queries the app itself saved can run."""

    model_config = {"extra": "forbid"}

    session_id: str
    answer_id: str = Field(pattern=r"^[0-9a-f]{32}$")


class HistoryMessage(BaseModel):
    id: str
    role: Literal["user", "assistant", "system"]
    kind: Literal["question", "answer", "clarification", "reply", "notice"]
    text: str
    ts: str
    answer: dict[str, Any] | None = None  # answers: {question, sql, chart, row_count}


class SessionHistory(BaseModel):
    session_id: str
    messages: list[HistoryMessage]


class QueryResult(BaseModel):
    columns: list[str]
    rows: list[list[Any]]
    row_count: int
    truncated: bool
