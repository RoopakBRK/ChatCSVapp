"""Answers written in code, so short results don't need a second AI call.

quick_explanation() returns the text for a result that is easy to say exactly (no rows, a single
number, one short row, a few labelled numbers, a short list, or a list of columns), or None when
the result needs the AI to explain it (llm.explain_result).
"""
import datetime as dt
from decimal import Decimal
from typing import Any

MAX_SHORT_ROWS = 5  # "a few labelled numbers" / "a short list"
MAX_ROW_COLUMNS = 4  # one row with up to this many values


def label(column: str) -> str:
    """total_revenue -> "Total revenue"."""
    words = column.replace("_", " ").strip()
    return words[:1].upper() + words[1:] if words else column


def _is_number(v: Any) -> bool:
    return isinstance(v, (int, float, Decimal)) and not isinstance(v, bool)


def value_text(v: Any) -> str:
    """Numbers with thousands separators and at most 2 decimals; dates as YYYY-MM-DD."""
    if v is None:
        return "missing"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return f"{v:,}"
    if isinstance(v, (float, Decimal)):
        f = float(v)
        if f != f:  # NaN
            return "missing"
        if f.is_integer() and abs(f) < 1e15:
            return f"{int(f):,}"
        return f"{f:,.2f}"
    if isinstance(v, dt.datetime):
        return v.strftime("%Y-%m-%d %H:%M") if (v.hour, v.minute, v.second) != (0, 0, 0) else v.strftime("%Y-%m-%d")
    if isinstance(v, dt.date):
        return v.isoformat()
    return str(v)


def is_column_listing(sql: str, columns: list[str]) -> bool:
    """A list of columns (from _columns or information_schema)."""
    s = sql.lower()
    return "_columns" in s or "information_schema" in s or "column_name" in {c.lower() for c in columns}


def column_listing(columns: list[str], rows: list[list[Any]]) -> str | None:
    """Every column, one per line, grouped by table when there are several."""
    idx = {c.lower(): i for i, c in enumerate(columns)}
    if "column_name" not in idx:
        return None

    def get(row, name):
        i = idx.get(name)
        return None if i is None else row[i]

    def line(row) -> str:
        text = f"- {get(row, 'column_name')}"
        header = get(row, "original_header")
        if header and str(header) != str(get(row, "column_name")):
            text += f' (original header: "{header}")'
        kind = get(row, "type") or get(row, "data_type")
        return text + (f" - {kind}" if kind else "")

    if not rows:
        return "No columns matched that question."
    tables: dict[str, list[str]] = {}
    for row in rows:
        tables.setdefault(str(get(row, "table_name") or ""), []).append(line(row))
    if len(tables) == 1:
        name, lines = next(iter(tables.items()))
        head = f"**{name}** has {len(lines)} column{'s' if len(lines) != 1 else ''}:" if name else \
            f"{len(lines)} column{'s' if len(lines) != 1 else ''}:"
        return "\n".join([head, *lines])
    parts = []
    for name, lines in tables.items():
        parts.append("\n".join([f"**{name}** ({len(lines)} column{'s' if len(lines) != 1 else ''}):", *lines]))
    return "\n\n".join(parts)


def quick_explanation(sql: str, columns: list[str], rows: list[list[Any]], truncated: bool) -> str | None:
    if is_column_listing(sql, columns):
        return column_listing(columns, rows)
    if truncated:
        return None
    if not rows:
        return "No rows matched that question."
    if len(rows) == 1 and len(columns) == 1:
        return f"{label(columns[0])}: **{value_text(rows[0][0])}**"
    if len(rows) == 1 and len(columns) <= MAX_ROW_COLUMNS:
        return "\n".join(f"- {label(c)}: **{value_text(v)}**" for c, v in zip(columns, rows[0]))
    if len(rows) <= MAX_SHORT_ROWS and len(columns) == 2 and all(_is_number(r[1]) or r[1] is None for r in rows):
        head = f"{label(columns[1])} by {label(columns[0]).lower()}:"
        return "\n".join([head, *(f"- {value_text(r[0])}: **{value_text(r[1])}**" for r in rows)])
    if len(rows) <= MAX_SHORT_ROWS and len(columns) == 1:
        return "\n".join([f"{label(columns[0])}:", *(f"- {value_text(r[0])}" for r in rows)])
    return None
