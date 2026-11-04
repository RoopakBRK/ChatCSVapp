from typing import Literal

import duckdb
from pydantic import BaseModel, Field, model_validator


def validate_read_only_sql(sql: str) -> str:
    """Return the SQL if DuckDB's own parser sees exactly one SELECT statement; raise ValueError otherwise.

    Parsing (instead of searching for banned words) means values and names such as
    WHERE category = 'call center', status = 'set' or a column called "update" are fine, while
    INSERT/UPDATE/DELETE, DDL, COPY, ATTACH, PRAGMA, SET, EXPLAIN, a CTE wrapping a write, or a
    second statement are all rejected. (DESCRIBE/SHOW/SUMMARIZE parse as SELECT and only read.)
    Running the query is protected separately: see SessionDB.run_query."""
    statement = sql.strip()
    if not statement:
        raise ValueError("sql is empty")
    con = duckdb.connect(":memory:")
    try:
        parsed = con.extract_statements(statement)
    except duckdb.Error as exc:
        raise ValueError(f"sql could not be parsed: {str(exc).splitlines()[0]}") from None
    finally:
        con.close()
    if len(parsed) != 1:
        raise ValueError(f"sql must be exactly one statement (found {len(parsed)})")
    if parsed[0].type != duckdb.StatementType.SELECT:
        raise ValueError(f"sql must be a read-only SELECT query (found {parsed[0].type.name})")
    return statement.rstrip(";").strip()


class ChartSpec(BaseModel):
    type: Literal["bar", "line", "pie", "scatter", "none"]
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
    """Exactly one of three outcomes:
      * sql (+ optional chart): a question the data can answer;
      * needs_clarification + question: the request is unclear;
      * reply: a plain text answer that needs no data (a greeting, "what can you do?")."""

    sql: str | None = None
    chart: ChartSpec | None = None
    needs_clarification: bool = False
    question: str | None = None
    reply: str | None = None

    @model_validator(mode="after")
    def _check_consistency(self) -> "LLMResponse":
        if self.needs_clarification:
            if not (self.question and self.question.strip()):
                raise ValueError("needs_clarification is true but no question was given")
            return self
        if self.reply and self.reply.strip():
            if self.sql and self.sql.strip():
                raise ValueError("give either sql or reply, not both")
            self.reply = self.reply.strip()
            return self
        if not (self.sql and self.sql.strip()):
            raise ValueError("sql is required unless you ask for clarification or give a plain reply")
        self.sql = validate_read_only_sql(self.sql)
        return self
