"""One DuckDB database per upload session, stored as a file next to the session's CSVs.

    data/sessions/<id>/orders.csv ...   the raw uploads (the source of truth)
    data/sessions/<id>/session.duckdb   the cleaned tables, one per CSV
    data/sessions/<id>/manifest.json    summaries, cleaning log and links, plus a size/mtime stamp
                                        of each CSV so a changed file is noticed

Restoring a session (after a restart or idle eviction) is just opening session.duckdb and reading
the manifest; only new or changed CSVs are cleaned again. If the database file is missing or
damaged, everything is rebuilt from the CSVs (cleaning is deterministic).

Locking: every session has its own lock, so building one session never blocks another. The global
registry lock is only held for dictionary lookups.

PRODUCTION NOTES - what would change:
  * Storage: put the database files and raw uploads on shared durable storage (object storage or
    a network volume) and use one process per file, or move the cleaned tables to Parquet/a
    server database so several workers can read the same session.
  * Metadata: keep summaries and cleaning logs in a real database (Postgres/Redis) with a
    TTL/cleanup job that also deletes expired session folders.
  * Isolation: tie sessions to an authenticated user and check ownership on every request; a
    session id alone must not be the only secret. Open the database read-only when running
    model-generated SQL, and set DuckDB memory_limit / threads / per-query timeouts.
  * Scale: run cleaning in a background worker for big files and stream uploads rather than
    reading them into memory; add per-user quotas on files, rows and sessions.
"""
import json
import logging
import math
import threading
import time
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import duckdb

from chatapp.cleaning import CleaningError, CleanResult, clean_csv, safe_table_name
from chatapp.sessions import is_valid_session_id, session_dir
from schemas.files import (
    CleaningStep, ColumnInfo, FileSummary, OutlierFlag, Relationship,
)

logger = logging.getLogger(__name__)

SESSION_TTL_SECONDS = 2 * 60 * 60
DB_NAME = "session.duckdb"
MANIFEST_NAME = "manifest.json"
MANIFEST_VERSION = 1
SAMPLE_ROWS = 5
MAX_RESULT_ROWS = 500
QUERY_TIMEOUT_SECONDS = 15.0
MIN_VALUES_FOR_OUTLIERS = 20
ID_SUFFIXES = ("_id", "_key", "_code", "_number")


def _reserved_words() -> set[str]:
    con = duckdb.connect(":memory:")
    try:
        rows = con.execute("SELECT keyword_name FROM duckdb_keywords() WHERE keyword_category = 'reserved'")
        return {r[0].lower() for r in rows.fetchall()}
    finally:
        con.close()


RESERVED = _reserved_words()


def q(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def jsonable(v):
    """Convert a DuckDB value to something JSON can carry (and a browser can read exactly)."""
    if v is None or isinstance(v, (str, bool)):
        return v
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    if isinstance(v, Decimal):
        v = float(v)
    if isinstance(v, int):
        return v if abs(v) < 2**53 else str(v)
    if isinstance(v, float):
        return v if math.isfinite(v) else None
    return str(v)


def _is_numeric(sql_type: str) -> bool:
    return sql_type in ("BIGINT", "DOUBLE") or sql_type.startswith("DECIMAL")


def _is_id_like(name: str) -> bool:
    return name == "id" or name.endswith(ID_SUFFIXES)


def _singular(table: str) -> str:
    if table.endswith("ies"):
        return table[:-3] + "y"
    return table[:-1] if table.endswith("s") else table


class SessionDB:
    def __init__(self, session_id: str, db_file: Path | None = None):
        self.session_id = session_id
        self.db_file = db_file  # None: keep everything in memory (used by tests)
        # Model-written SQL runs on this connection, so lock it down: no reading or writing files,
        # and the settings can't be changed afterwards.
        self.con = duckdb.connect(
            str(db_file) if db_file else ":memory:",
            config={"enable_external_access": False, "lock_configuration": True},
        )
        self.lock = threading.RLock()  # this session only; other sessions are never blocked by it
        self.last_used = time.time()
        self.files: dict[str, FileSummary] = {}  # keyed by file name
        self.sources: dict[str, dict[str, int]] = {}  # file name -> {"size", "mtime_ns"} when it was cleaned
        self.relationships: list[Relationship] = []

    # ---- persistence -----------------------------------------------------------------------

    def _save_manifest(self) -> None:
        if not self.db_file:
            return
        manifest = {
            "version": MANIFEST_VERSION,
            "sources": self.sources,
            "files": [f.model_dump(mode="json") for f in self.files.values()],
            "relationships": [r.model_dump(mode="json") for r in self.relationships],
        }
        target = self.db_file.parent / MANIFEST_NAME
        tmp = target.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(manifest))
        tmp.replace(target)  # atomic: a crash never leaves a half-written manifest

    def adopt(self, manifest: dict) -> bool:
        """Take over summaries saved earlier, for tables that really exist in the database file."""
        try:
            if manifest.get("version") != MANIFEST_VERSION:
                return False
            tables = {r[0] for r in self.con.execute("SELECT table_name FROM duckdb_tables()").fetchall()}
            for raw in manifest["files"]:
                summary = FileSummary.model_validate(raw)
                if summary.table_name in tables and summary.file_name in manifest["sources"]:
                    self.files[summary.file_name] = summary
                    self.sources[summary.file_name] = manifest["sources"][summary.file_name]
            self.relationships = [Relationship.model_validate(r) for r in manifest["relationships"]]
            return True
        except Exception:
            logger.warning("Ignoring unreadable manifest for session %s", self.session_id, exc_info=True)
            self.files.clear()
            self.sources.clear()
            return False

    def remove_file(self, file_name: str) -> bool:
        """Delete an uploaded file for good: table, CSV on disk, links. False if it isn't here."""
        with self.lock:
            if file_name not in self.files:
                return False
            self.forget(file_name)
            if self.db_file:
                (self.db_file.parent / file_name).unlink(missing_ok=True)
            else:
                (session_dir(self.session_id) / file_name).unlink(missing_ok=True)
            self.relationships = self._detect_relationships()
            self._save_manifest()
            self.last_used = time.time()
            return True

    def is_current(self, path: Path) -> bool:
        """True if this CSV is already loaded and hasn't changed since."""
        st = path.stat()
        return self.sources.get(path.name) == {"size": st.st_size, "mtime_ns": st.st_mtime_ns}

    def forget(self, file_name: str) -> None:
        """Drop a file whose CSV has been deleted from disk."""
        with self.lock:
            summary = self.files.pop(file_name, None)
            self.sources.pop(file_name, None)
            if summary:
                self.con.execute(f"DROP TABLE IF EXISTS {q(summary.table_name)}")

    # ---- loading ---------------------------------------------------------------------------

    def _table_name_for(self, file_name: str) -> str:
        if file_name in self.files:  # re-upload of the same file replaces its table
            return self.files[file_name].table_name
        taken = {f.table_name for f in self.files.values()}
        base = safe_table_name(file_name)
        if base in RESERVED:
            base = f"{base}_data"
        name, n = base, 2
        while name in taken:
            name, n = f"{base}_{n}", n + 1
        return name

    def load_csv(self, path: Path) -> FileSummary:
        """Clean one CSV and load it as a table. Raises CleaningError if it can't be read."""
        result = clean_csv(path)
        with self.lock:
            table = self._table_name_for(path.name)
            summary = self._build_table(table, path, result)
            self.files[path.name] = summary
            st = path.stat()
            self.sources[path.name] = {"size": st.st_size, "mtime_ns": st.st_mtime_ns}
            self.relationships = self._detect_relationships()
            self._save_manifest()
            self.last_used = time.time()
        return summary

    def _build_table(self, table: str, path: Path, r: CleanResult) -> FileSummary:
        select = ", ".join(f"{c.cast_sql.format(col=q(c.name))} AS {q(c.name)}" for c in r.columns)
        self.con.register("_incoming", r.df)
        try:
            self.con.execute(f"CREATE OR REPLACE TABLE {q(table)} AS SELECT {select} FROM _incoming")
        finally:
            self.con.unregister("_incoming")

        steps = list(r.steps)
        outliers = self._flag_outliers(table, r)
        steps += [CleaningStep(
            action="flag_outliers", column=o.column, count=o.count, changes_data=False,
            detail=f"{o.count} value(s) outside [{o.lower_fence:g}, {o.upper_fence:g}] "
                   "(1.5 x IQR). Flagged only; no rows removed.") for o in outliers]

        ranged = [c for c in r.columns if _is_numeric(c.sql_type) or c.sql_type in ("DATE", "TIMESTAMP")]
        stats = self.con.execute(
            "SELECT count(*), " + ", ".join(f"count({q(c.name)})" for c in r.columns)
            + "".join(f", min({q(c.name)}), max({q(c.name)})" for c in ranged) + f" FROM {q(table)}"
        ).fetchall()[0]
        row_count = stats[0]
        counts = stats[1:1 + len(r.columns)]
        bounds = {c.name: (stats[1 + len(r.columns) + 2 * i], stats[2 + len(r.columns) + 2 * i])
                  for i, c in enumerate(ranged)}
        columns = []
        for c, n in zip(r.columns, counts):
            lo, hi = bounds.get(c.name, (None, None))
            columns.append(ColumnInfo(
                name=c.name, original_name=c.original_name, type=c.sql_type,
                missing=row_count - n,
                missing_pct=round((row_count - n) / row_count * 100, 2) if row_count else 0.0,
                distinct_values=self._small_domain(table, c.name) if c.sql_type == "VARCHAR" else None,
                min=None if lo is None else str(lo), max=None if hi is None else str(hi)))
        cur = self.con.execute(f"SELECT * FROM {q(table)} LIMIT {SAMPLE_ROWS}")
        names = [d[0] for d in cur.description]
        sample = [{n: jsonable(v) for n, v in zip(names, row)} for row in cur.fetchall()]

        return FileSummary(
            file_name=path.name, table_name=table, size=path.stat().st_size,
            rows_read=r.rows_read, row_count=row_count, column_count=len(columns), columns=columns,
            missing_total=sum(c.missing for c in columns), sample_rows=sample,
            cleaning_steps=steps, outliers=outliers,
        )

    def _small_domain(self, table: str, column: str, limit: int = 20) -> list[str] | None:
        """All distinct values of a text column, if there are few and they are short."""
        vals = [v[0] for v in self.con.execute(
            f"SELECT DISTINCT {q(column)} FROM {q(table)} WHERE {q(column)} IS NOT NULL "
            f"ORDER BY 1 LIMIT {limit + 1}").fetchall()]
        if not vals or len(vals) > limit or any(len(v) > 40 for v in vals):
            return None
        return vals

    def _flag_outliers(self, table: str, r: CleanResult) -> list[OutlierFlag]:
        flags = []
        for c in r.columns:
            if not _is_numeric(c.sql_type) or _is_id_like(c.name):
                continue
            col = q(c.name)
            n, q1, q3, distinct = self.con.execute(
                f"SELECT count({col}), quantile_cont({col}, 0.25), quantile_cont({col}, 0.75), "
                f"count(DISTINCT {col}) FROM {q(table)}").fetchall()[0]
            if n < MIN_VALUES_FOR_OUTLIERS or distinct == n:  # too few values, or looks like a key
                continue
            q1, q3 = float(q1), float(q3)
            iqr = q3 - q1
            if iqr <= 0:
                continue
            lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
            cnt = self.con.execute(
                f"SELECT count(*) FROM {q(table)} WHERE {col} < ? OR {col} > ?", [lo, hi]).fetchall()[0][0]
            if cnt:
                ex = self.con.execute(
                    f"SELECT DISTINCT {col} FROM {q(table)} WHERE {col} < ? OR {col} > ? "
                    f"ORDER BY abs({col} - ?) DESC LIMIT 5", [lo, hi, (q1 + q3) / 2]).fetchall()
                flags.append(OutlierFlag(column=c.name, count=cnt, lower_fence=round(lo, 4),
                                         upper_fence=round(hi, 4), examples=[float(x[0]) for x in ex]))
        return flags

    # ---- relationships ---------------------------------------------------------------------

    def _detect_relationships(self) -> list[Relationship]:
        """Find columns that link tables: same name (or id <-> <table>_id), at least one side
        a key (near-unique), and the values actually overlap."""
        tables = {f.table_name: {c.name: c for c in f.columns} for f in self.files.values()}
        rows = {f.table_name: f.row_count for f in self.files.values()}
        found: list[Relationship] = []
        names = sorted(tables)
        for i, ta in enumerate(names):
            for tb in names[i + 1:]:
                pairs = [(c, c, "same column name") for c in tables[ta] if c in tables[tb]]
                if "id" in tables[ta] and f"{_singular(ta)}_id" in tables[tb]:
                    pairs.append(("id", f"{_singular(ta)}_id", "id naming convention"))
                if "id" in tables[tb] and f"{_singular(tb)}_id" in tables[ta]:
                    pairs.append((f"{_singular(tb)}_id", "id", "id naming convention"))
                for ca, cb, reason in pairs:
                    rel = self._assess(ta, ca, tb, cb, reason, rows, tables)
                    if rel:
                        found.append(rel)
        order = {"high": 0, "medium": 1, "low": 2}
        return sorted(found, key=lambda r: (order[r.confidence], r.from_table, r.to_table))

    def _assess(self, ta, ca, tb, cb, reason, rows, tables) -> Relationship | None:
        def stats(t, c):
            return self.con.execute(
                f"SELECT count({q(c)}), count(DISTINCT {q(c)}) FROM {q(t)}").fetchall()[0]

        nn_a, d_a = stats(ta, ca)
        nn_b, d_b = stats(tb, cb)
        if not d_a or not d_b:
            return None
        uniq_a, uniq_b = d_a / nn_a, d_b / nn_b
        if max(uniq_a, uniq_b) < 0.9:  # neither side is a key, e.g. "status" or "city"
            return None
        common = self.con.execute(
            f"SELECT count(*) FROM (SELECT DISTINCT CAST({q(ca)} AS VARCHAR) v FROM {q(ta)} WHERE {q(ca)} IS NOT NULL) a "
            f"JOIN (SELECT DISTINCT CAST({q(cb)} AS VARCHAR) v FROM {q(tb)} WHERE {q(cb)} IS NOT NULL) b USING (v)"
        ).fetchall()[0][0]
        in_b, in_a = common / d_a, common / d_b  # share of A's values found in B, and vice versa

        # Decide which side is the "from" (many) side and which is the key ("to").
        a_is_key, b_is_key = uniq_a >= 0.9, uniq_b >= 0.9
        if a_is_key and b_is_key:
            cardinality = "one_to_one"
            a_from = (in_b, rows[ta], tb) > (in_a, rows[tb], ta)
        else:
            cardinality = "many_to_one"
            a_from = b_is_key
        if a_from:
            ft, fc, tt, tc, match, frm_distinct = ta, ca, tb, cb, in_b, d_a
        else:
            ft, fc, tt, tc, match, frm_distinct = tb, cb, ta, ca, in_a, d_b
        if match < 0.5:
            return None
        confidence = "high" if match >= 0.95 else "medium" if match >= 0.8 else "low"
        return Relationship(
            from_table=ft, from_column=fc, to_table=tt, to_column=tc, cardinality=cardinality,
            match_pct=round(match * 100, 2), unmatched_values=frm_distinct - common,
            confidence=confidence, reason=reason,
            type_mismatch=tables[ta][ca].type != tables[tb][cb].type,
            join=f"{ft}.{fc} = {tt}.{tc}",
        )

    # ---- running model-written SQL ---------------------------------------------------------

    def run_query(self, sql: str, max_rows: int = MAX_RESULT_ROWS, timeout: float = QUERY_TIMEOUT_SECONDS):
        """Run read-only SQL on its own cursor. Returns (columns, rows, truncated).

        Raises duckdb.Error on a bad query or when the timeout interrupts it."""
        cur = self.con.cursor()
        timer = threading.Timer(timeout, cur.interrupt)
        timer.start()
        try:
            cur.execute(sql)
            columns = [d[0] for d in cur.description]
            fetched = cur.fetchmany(max_rows + 1)
        finally:
            timer.cancel()
            cur.close()
        rows = [[jsonable(v) for v in row] for row in fetched[:max_rows]]
        return columns, rows, len(fetched) > max_rows

    # ---- access ----------------------------------------------------------------------------

    def summaries(self) -> list[FileSummary]:
        return sorted(self.files.values(), key=lambda f: f.table_name)


_sessions: dict[str, SessionDB] = {}
_session_locks: dict[str, threading.Lock] = {}  # one per session id, so builds don't block each other
_registry_lock = threading.Lock()  # only ever held for quick dictionary operations


def _evict_idle() -> None:
    cutoff = time.time() - SESSION_TTL_SECONDS
    for sid in [s for s, db in _sessions.items() if db.last_used < cutoff]:
        _sessions.pop(sid).con.close()  # the files stay on disk; reopening is cheap


def _read_manifest(folder: Path) -> dict | None:
    try:
        return json.loads((folder / MANIFEST_NAME).read_text())
    except (OSError, ValueError):
        return None


def _open_session(session_id: str) -> SessionDB | None:
    """Open a session from disk. Only new or changed CSVs are cleaned again."""
    folder = session_dir(session_id)
    if not folder.is_dir():
        return None
    db_file = folder / DB_NAME
    manifest = _read_manifest(folder) if db_file.exists() else None
    try:
        db = SessionDB(session_id, db_file)
    except duckdb.Error:
        logger.warning("Session database %s is damaged; rebuilding from the CSVs", db_file)
        for stale in folder.glob(f"{DB_NAME}*"):
            stale.unlink(missing_ok=True)
        manifest = None
        db = SessionDB(session_id, db_file)

    if manifest and not db.adopt(manifest):
        manifest = None

    csvs = sorted(folder.glob("*.csv"))
    gone = set(db.files) - {p.name for p in csvs}
    for name in gone:
        db.forget(name)
    changed = False
    for path in csvs:
        if db.is_current(path):
            continue
        try:
            db.load_csv(path)  # also refreshes the links and the manifest
            changed = True
        except CleaningError:
            logger.warning("Skipping unreadable file %s while restoring session", path)
    if gone and not changed:
        db.relationships = db._detect_relationships()
        db._save_manifest()
    return db


def get_session(session_id: str) -> SessionDB | None:
    """Return the session's database, opening it from disk if it isn't loaded."""
    if not is_valid_session_id(session_id):
        return None
    with _registry_lock:
        _evict_idle()
        db = _sessions.get(session_id)
        if db:
            db.last_used = time.time()
            return db
        lock = _session_locks.setdefault(session_id, threading.Lock())

    with lock:  # one thread opens this session; other sessions carry on
        with _registry_lock:
            db = _sessions.get(session_id)
        if db is None:
            db = _open_session(session_id)
            if db is None:
                return None
            with _registry_lock:
                _sessions[session_id] = db
        db.last_used = time.time()
        return db
