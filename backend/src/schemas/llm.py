import re
from typing import Literal

from pydantic import BaseModel, Field, model_validator

# Read-only: a single SELECT (optionally with CTEs). Nothing that writes or changes state.
_READ_ONLY = re.compile(r"^\s*(select|with)\b", re.IGNORECASE)
_FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|create|attach|detach|copy|export|pragma|install|load|call|set)\b",
    re.IGNORECASE,
)


def validate_read_only_sql(sql: str) -> str:
    """Return the statement without a trailing semicolon, or raise ValueError if it isn't a single read-only SELECT."""
    statement = sql.strip().rstrip(";").strip()
    if not statement:
        raise ValueError("sql is empty")
    if ";" in statement:
        raise ValueError("sql must be a single statement")
    if not _READ_ONLY.match(statement) or _FORBIDDEN.search(statement):
        raise ValueError("sql must be a read-only SELECT query")
    return statement


class ChartSpec(BaseModel):
    type: Literal["bar", "line", "pie", "none"]
    x: str | None = Field(default=None, description="Result column for the x axis (or pie labels)")
    y: str | None = Field(default=None, description="Numeric result column for the y axis (or pie values)")
    title: str | None = None

    @model_validator(mode="after")
    def _need_fields_unless_none(self) -> "ChartSpec":
        if self.type != "none":
            for name in ("x", "y", "title"):
                value = getattr(self, name)
                if not (value and value.strip()):
                    raise ValueError(f"chart.{name} is required for a {self.type} chart")
        return self


class LLMResponse(BaseModel):
    sql: str | None = None
    chart: ChartSpec | None = None
    needs_clarification: bool = False
    question: str | None = None

    @model_validator(mode="after")
    def _check_consistency(self) -> "LLMResponse":
        if self.needs_clarification:
            if not (self.question and self.question.strip()):
                raise ValueError("needs_clarification is true but no question was given")
            return self

        if not (self.sql and self.sql.strip()):
            raise ValueError("sql is required when needs_clarification is false")
        self.sql = validate_read_only_sql(self.sql)
        return self
