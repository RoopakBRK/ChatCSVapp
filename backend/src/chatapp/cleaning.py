"""CSV cleaning. Pure pandas, no DuckDB.

Principles:
  * Never guess. Missing values stay NULL, ambiguous types stay text.
  * Never delete silently. Every change is returned as a CleaningStep.
  * Outliers are flagged elsewhere (session_db), never removed.

clean_csv() returns every column as text (None = missing) plus the chosen DuckDB type for each
column; session_db then casts into a real table.
"""
import csv
import io
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from schemas.files import CleaningStep

# Tokens that mean "missing". Deliberately short: "NA" or "none" can be real values (a country
# code, a name), so they are left alone.
NULL_TOKENS = {"null", "nan", "n/a", "#n/a"}

_INT = r"-?(0|[1-9]\d{0,17})"
_NUM = r"-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?"
_FIXED = r"-?(0|[1-9]\d*)(\.\d+)?"
_ISO_DATE = r"\d{4}-\d{2}-\d{2}"
_ISO_TS = r"\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?"
_YMD_SLASH = r"\d{4}/\d{2}/\d{2}"
_DMY_OR_MDY = r"\d{1,2}([/.-])\d{1,2}\1\d{4}"


class CleaningError(Exception):
    pass


@dataclass
class ColumnPlan:
    name: str
    original_name: str
    sql_type: str  # target DuckDB type
    cast_sql: str  # expression with {col} placeholder for the quoted source column


@dataclass
class CleanResult:
    df: pd.DataFrame  # all-text, None for missing
    columns: list[ColumnPlan]
    rows_read: int
    steps: list[CleaningStep] = field(default_factory=list)


def snake_case(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s)
    s = re.sub(r"[^0-9a-zA-Z]+", "_", s).strip("_").lower()
    return s


def safe_table_name(file_name: str) -> str:
    s = snake_case(Path(file_name).stem) or "table"
    return f"t_{s}" if s[0].isdigit() else s


def _read(path: Path, steps: list[CleaningStep]) -> pd.DataFrame:
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
        steps.append(CleaningStep(action="decode_latin1", count=1, changes_data=False,
                                  detail="File is not valid UTF-8; read as Latin-1."))

    sep = ","
    try:
        sep = csv.Sniffer().sniff(text[:8192], delimiters=",;\t|").delimiter
    except csv.Error:
        pass
    if sep != ",":
        steps.append(CleaningStep(action="detect_delimiter", count=1, changes_data=False,
                                  detail=f"Delimiter detected as {sep!r} instead of a comma."))
    reader = csv.reader(io.StringIO(text), delimiter=sep)
    try:
        header = next(reader)
    except StopIteration:
        raise CleaningError("file has no header row") from None
    width = len(header)
    rows, short = [], []
    try:
        for n, row in enumerate(reader, start=1):
            if len(row) > width:
                # Dropping the extra fields would silently lose data, so refuse the file.
                raise CleaningError(f"row {n} has {len(row)} fields but the header has {width}")
            if 0 < len(row) < width:
                short.append(n)
            rows.append(row + [""] * (width - len(row)))
    except csv.Error as exc:
        raise CleaningError(str(exc)) from exc
    if short:
        steps.append(CleaningStep(
            action="pad_short_rows", count=len(short), changes_data=True,
            detail=f"{len(short)} row(s) had fewer fields than the header; missing fields set to NULL "
                   f"(data rows {', '.join(map(str, short[:5]))}{', ...' if len(short) > 5 else ''})."))
    return pd.DataFrame(rows, columns=header, dtype=object)


def _clean_headers(df: pd.DataFrame, steps: list[CleaningStep]) -> dict[str, str]:
    """Rename to unique snake_case. Returns {new_name: original_name}."""
    originals = [str(c) for c in df.columns]
    seen: dict[str, int] = {}
    new_names: list[str] = []
    for i, orig in enumerate(originals, start=1):
        base = snake_case(orig) or f"column_{i}"
        if base[0].isdigit():
            base = f"col_{base}"
        seen[base] = seen.get(base, 0) + 1
        new_names.append(base if seen[base] == 1 else f"{base}_{seen[base]}")
    for orig, new in zip(originals, new_names):
        if orig != new:
            steps.append(CleaningStep(action="rename_column", column=new, count=1, changes_data=True,
                                      detail=f"'{orig}' -> '{new}'"))
    df.columns = new_names
    return dict(zip(new_names, originals))


def _tidy_values(df: pd.DataFrame, steps: list[CleaningStep]) -> pd.DataFrame:
    for col in df.columns:
        s = df[col]
        tidy = s.str.strip().str.replace(r"\s+", " ", regex=True)
        # Whitespace-only cells become empty here and are counted under blank_to_null instead.
        changed = int(((tidy != s) & (tidy != "")).sum())
        if changed:
            steps.append(CleaningStep(action="trim_whitespace", column=col, count=changed,
                                      changes_data=True,
                                      detail="Trimmed leading/trailing spaces and collapsed repeated spaces."))
        blanks = int((tidy == "").sum())
        if blanks:
            steps.append(CleaningStep(action="blank_to_null", column=col, count=blanks, changes_data=True,
                                      detail="Empty or whitespace-only cells kept as NULL (not filled)."))
        tokens = tidy.str.lower().isin(NULL_TOKENS)
        if tokens.any():
            found = sorted(set(tidy[tokens]))
            steps.append(CleaningStep(action="null_token_to_null", column=col, count=int(tokens.sum()),
                                      changes_data=True,
                                      detail=f"Text meaning missing ({', '.join(found)}) converted to NULL."))
        tidy = tidy.mask((tidy == "") | tokens, None)
        df[col] = tidy
    return df


def _drop_rows(df: pd.DataFrame, steps: list[CleaningStep]) -> pd.DataFrame:
    def rows(idx) -> str:
        nums = [str(i + 1) for i in list(idx)[:5]]
        more = ", ..." if len(idx) > 5 else ""
        return f"data rows {', '.join(nums)}{more}"

    empty = df.isna().all(axis=1)
    if empty.any():
        steps.append(CleaningStep(action="drop_empty_rows", count=int(empty.sum()), changes_data=True,
                                  detail=f"Removed rows with no values at all ({rows(df.index[empty])})."))
        df = df[~empty]
    dup = df.duplicated(keep="first")
    if dup.any():
        steps.append(CleaningStep(action="drop_duplicate_rows", count=int(dup.sum()), changes_data=True,
                                  detail="Removed exact duplicate rows, keeping the first "
                                         f"occurrence ({rows(df.index[dup])})."))
        df = df[~dup]
    return df.reset_index(drop=True)


def _parse_dates(s: pd.Series, fmt: str) -> pd.Series:
    return pd.to_datetime(s, format=fmt, errors="coerce")


def _detect_type(col: str, s: pd.Series, steps: list[CleaningStep]) -> tuple[str, str]:
    """Returns (duckdb_type, cast_sql). s holds the non-null text values."""
    text = ("VARCHAR", "{col}")
    if s.empty:
        steps.append(CleaningStep(action="flag_empty_column", column=col, count=0, changes_data=False,
                                  detail="Column has no values; kept as text."))
        return text

    def converted(sql_type: str, expr: str, note: str = ""):
        steps.append(CleaningStep(action="convert_type", column=col, count=len(s), changes_data=True,
                                  detail=f"text -> {sql_type}{note}"))
        return sql_type, expr

    if s.str.lower().isin(["true", "false"]).all():
        return converted("BOOLEAN", "CAST(lower({col}) AS BOOLEAN)")

    if s.str.fullmatch(_INT).all():
        return converted("BIGINT", "CAST({col} AS BIGINT)")

    if s.str.fullmatch(_NUM).all():
        if s.str.fullmatch(_FIXED).all():
            decimals = int(s.str.extract(r"\.(\d+)$")[0].str.len().max())
            digits = int(s.str.lstrip("-").str.split(".").str[0].str.len().max())
            if decimals <= 6 and digits + decimals <= 18:
                return converted(f"DECIMAL(18,{decimals})", f"CAST({{col}} AS DECIMAL(18,{decimals}))",
                                 " (exact decimal, so sums are not subject to float rounding)")
        return converted("DOUBLE", "CAST({col} AS DOUBLE)")

    share = s.str.fullmatch(_NUM).mean()
    if share >= 0.9:
        bad = s[~s.str.fullmatch(_NUM)]
        steps.append(CleaningStep(
            action="kept_as_text", column=col, count=len(bad), changes_data=False,
            detail=f"{share:.0%} of values look numeric but {len(bad)} do not "
                   f"(e.g. {', '.join(repr(v) for v in bad.unique()[:3])}); kept as text instead of guessing."))
        return text

    if s.str.fullmatch(_ISO_DATE).all() and _parse_dates(s, "%Y-%m-%d").notna().all():
        return converted("DATE", "CAST({col} AS DATE)")
    if s.str.fullmatch(_ISO_TS).all() and pd.to_datetime(s, errors="coerce", format="ISO8601").notna().all():
        return converted("TIMESTAMP", "CAST({col} AS TIMESTAMP)")
    if s.str.fullmatch(_YMD_SLASH).all() and _parse_dates(s, "%Y/%m/%d").notna().all():
        return converted("DATE", "strptime({col}, '%Y/%m/%d')::DATE")

    if s.str.fullmatch(_DMY_OR_MDY).all():
        sep = s.iloc[0][re.search(r"[/.-]", s.iloc[0]).start()]
        if s.str.count(re.escape(sep)).eq(2).all():
            dmy, mdy = f"%d{sep}%m{sep}%Y", f"%m{sep}%d{sep}%Y"
            ok_dmy = _parse_dates(s, dmy).notna().all()
            ok_mdy = _parse_dates(s, mdy).notna().all()
            if ok_dmy != ok_mdy:
                fmt = dmy if ok_dmy else mdy
                return converted("DATE", f"strptime({{col}}, '{fmt}')::DATE",
                                 f" (day/month order {'day first' if ok_dmy else 'month first'} is the only valid reading)")
            if ok_dmy and ok_mdy:
                steps.append(CleaningStep(
                    action="kept_as_text", column=col, count=len(s), changes_data=False,
                    detail="Dates could be day/month or month/day; kept as text instead of guessing."))
    return text


def clean_csv(path: Path) -> CleanResult:
    steps: list[CleaningStep] = []
    df = _read(path, steps)
    if len(df.columns) == 0:
        raise CleaningError("no columns found")
    rows_read = len(df)

    originals = _clean_headers(df, steps)
    df = _tidy_values(df, steps)
    df = _drop_rows(df, steps)

    plans = []
    for col in df.columns:
        sql_type, cast_sql = _detect_type(col, df[col].dropna(), steps)
        plans.append(ColumnPlan(col, originals[col], sql_type, cast_sql))

    df = df.astype(object).where(df.notna(), None)
    return CleanResult(df=df, columns=plans, rows_read=rows_read, steps=steps)
