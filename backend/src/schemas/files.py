from typing import Any, Literal

from pydantic import BaseModel


class RejectedFile(BaseModel):
    name: str
    reason: str


class ColumnInfo(BaseModel):
    name: str  # cleaned snake_case name, as used in SQL
    original_name: str  # header as it appeared in the CSV
    type: str  # DuckDB type: BIGINT, DECIMAL(18,2), DOUBLE, DATE, TIMESTAMP, BOOLEAN, VARCHAR
    missing: int
    missing_pct: float
    distinct_values: list[str] | None = None  # every value, for text columns with <= 20 distinct values
    min: str | None = None  # numeric and date columns
    max: str | None = None


class CleaningStep(BaseModel):
    """One thing the cleaner did (or noticed). Every step is recorded so nothing changes silently."""

    action: str
    column: str | None = None
    count: int  # cells / rows / columns affected
    detail: str
    changes_data: bool  # False for steps that only flag something and leave the data as-is


class OutlierFlag(BaseModel):
    """Values outside the 1.5 x IQR fences. They are flagged only; no row is removed."""

    column: str
    count: int
    lower_fence: float
    upper_fence: float
    examples: list[float]


class FileSummary(BaseModel):
    file_name: str
    table_name: str
    size: int
    rows_read: int  # data rows in the CSV
    row_count: int  # rows in the table after cleaning
    column_count: int
    columns: list[ColumnInfo]
    missing_total: int
    sample_rows: list[dict[str, Any]]
    cleaning_steps: list[CleaningStep]
    outliers: list[OutlierFlag]


class Relationship(BaseModel):
    """A likely join between two tables: from_table.from_column -> to_table.to_column."""

    from_table: str
    from_column: str
    to_table: str
    to_column: str
    cardinality: Literal["many_to_one", "one_to_one"]
    match_pct: float  # share of distinct from-values that exist in the to-table
    unmatched_values: int  # distinct from-values with no match (they drop out of an inner join)
    confidence: Literal["high", "medium", "low"]
    reason: str
    type_mismatch: bool  # the two columns have different types; compare as text
    join: str  # ready-to-use join condition


class SessionFiles(BaseModel):
    session_id: str
    files: list[FileSummary]
    relationships: list[Relationship]


class UploadResponse(SessionFiles):
    uploaded: list[str]  # file names accepted in this request
    rejected: list[RejectedFile] = []
