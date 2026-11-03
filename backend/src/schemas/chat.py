from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from schemas.llm import validate_read_only_sql


class HistoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: str
    history: list[HistoryTurn] = Field(default_factory=list, max_length=12)


class ChartOut(BaseModel):
    type: Literal["bar", "line", "pie"]
    x: str
    y: str
    title: str


class ChatAnswer(BaseModel):
    type: Literal["answer"] = "answer"
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


ChatResponse = ChatAnswer | ChatClarification


class ChatErrorDetail(BaseModel):
    code: str
    message: str


class QueryRequest(BaseModel):
    """Re-run SQL from an earlier answer, so a past chat can show its chart and table again."""

    session_id: str
    sql: str = Field(min_length=1, max_length=20000)

    @field_validator("sql")
    @classmethod
    def _read_only(cls, v: str) -> str:
        return validate_read_only_sql(v)


class QueryResult(BaseModel):
    columns: list[str]
    rows: list[list[Any]]
    row_count: int
    truncated: bool
