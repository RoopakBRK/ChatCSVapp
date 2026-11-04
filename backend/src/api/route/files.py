import json
import os
import uuid
from pathlib import Path, PurePath
from typing import IO, Iterator

from fastapi import UploadFile

from api.errors import fail
from chatapp import history
from chatapp.cleaning import CleaningError
from chatapp.config import settings
from chatapp.remote import RemoteFileError, fetch_csv
from chatapp.session_db import get_session
from chatapp.sessions import get_or_create_session, is_valid_session_id, session_dir
from chatapp.suggestions import starter_questions
from schemas.files import RejectedFile, SessionFiles, UploadResponse, UrlUploadRequest

CHUNK_BYTES = 1024 * 1024  # files are copied to disk 1 MB at a time, never held in memory whole


class _TooLarge(Exception):
    pass


def _too_large_reason() -> str:
    return f"File is larger than {settings.max_upload_mb:g} MB"


def _incoming_path() -> Path:
    """A temporary file next to the session folders (same disk, so the final move is instant)."""
    folder = settings.data_dir / ".incoming"
    folder.mkdir(parents=True, exist_ok=True)
    return folder / f"{uuid.uuid4().hex}.part"


def _copy_in_chunks(source: IO[bytes], part: Path) -> bool:
    """Copy a stream to `part` in chunks, stopping at the size limit. True if it holds anything but whitespace."""
    size, has_content = 0, False
    with part.open("wb") as out:
        while chunk := source.read(CHUNK_BYTES):
            size += len(chunk)
            if size > settings.max_upload_bytes:
                raise _TooLarge
            has_content = has_content or bool(chunk.strip())
            out.write(chunk)
    return has_content


def _has_content(path: Path) -> bool:
    with path.open("rb") as f:
        while chunk := f.read(CHUNK_BYTES):
            if chunk.strip():
                return True
    return False


def _install(db, target: Path, name: str, part: Path) -> RejectedFile | None:
    """Move a received file into the session and clean it into a table.
    A file that can't be read puts back whatever was there before, so a bad re-upload loses nothing."""
    dest = target / name
    backup = target / f".previous-{uuid.uuid4().hex}" if dest.exists() else None
    if backup:
        os.replace(dest, backup)
    os.replace(part, dest)
    try:
        db.load_csv(dest)
    except CleaningError as exc:
        dest.unlink(missing_ok=True)
        if backup:
            os.replace(backup, dest)
        return RejectedFile(name=name, reason=f"Could not parse as CSV: {exc}")
    if backup:
        backup.unlink(missing_ok=True)
    return None


def _receive(db, target: Path, name: str, source: IO[bytes]) -> RejectedFile | None:
    """Check, save (in chunks) and load one CSV. Returns why it was rejected, if it was."""
    if not name.lower().endswith(".csv"):
        return RejectedFile(name=name or "(unnamed)", reason="Only .csv files are supported")
    part = _incoming_path()
    try:
        try:
            if not _copy_in_chunks(source, part):
                return RejectedFile(name=name, reason="File is empty")
        except _TooLarge:
            return RejectedFile(name=name, reason=_too_large_reason())
        return _install(db, target, name, part)
    finally:
        part.unlink(missing_ok=True)


def _session_files(sid: str, db) -> SessionFiles:
    return SessionFiles(
        session_id=sid, files=db.summaries(), relationships=db.relationships,
        starter_questions=starter_questions(db.summaries(), db.relationships),
    )


def _rejected_error(rejected: list[RejectedFile]):
    return fail(400, "no_valid_files", "None of the files could be used.", rejected=[r.model_dump() for r in rejected])


def _check_session_id(session_id: str | None) -> None:
    if session_id is not None and not is_valid_session_id(session_id):
        raise fail(400, "invalid_session", "That session isn't valid. Please upload your files again.")


def _existing_session(session_id: str):
    _check_session_id(session_id)
    db = get_session(session_id)
    if db is None:
        raise fail(404, "session_not_found", "This session has expired. Please upload your CSV files again.")
    return db


def upload_files(files: list[UploadFile], session_id: str | None) -> UploadResponse:
    """Accept several CSVs, clean each into its own table, and summarise what was done."""
    _check_session_id(session_id)
    sid = get_or_create_session(session_id)
    db = get_session(sid)
    target = session_dir(sid)

    uploaded: list[str] = []
    rejected: list[RejectedFile] = []
    for upload in files:
        # Strip any directory components from the client-supplied name.
        name = PurePath((upload.filename or "").replace("\\", "/")).name
        problem = _receive(db, target, name, upload.file)
        if problem:
            rejected.append(problem)
        else:
            uploaded.append(name)

    if not uploaded:
        raise _rejected_error(rejected)
    history.notice(sid, f"Uploaded: {', '.join(uploaded)}")
    return UploadResponse(**_session_files(sid, db).model_dump(), uploaded=uploaded, rejected=rejected)


def upload_from_url(req: UrlUploadRequest) -> UploadResponse:
    """Download a CSV from a link (direct, Google Drive/Sheets, Dropbox, GitHub) into the session."""
    _check_session_id(req.session_id)
    part = _incoming_path()
    try:
        # Download before touching the session, so a bad link creates nothing.
        try:
            name = fetch_csv(req.url, part)
        except RemoteFileError as exc:
            raise _rejected_error([RejectedFile(name=req.url[:80], reason=str(exc))])
        if not _has_content(part):
            raise _rejected_error([RejectedFile(name=name, reason="File is empty")])
        sid = get_or_create_session(req.session_id)
        db = get_session(sid)
        problem = _install(db, session_dir(sid), name, part)
        if problem:
            raise _rejected_error([problem])
        history.notice(sid, f"Uploaded from link: {name}")
        return UploadResponse(**_session_files(sid, db).model_dump(), uploaded=[name], rejected=[])
    finally:
        part.unlink(missing_ok=True)


def delete_file(session_id: str, name: str) -> SessionFiles:
    """Remove one uploaded file: its table, its CSV on disk, and any links to it."""
    _check_session_id(session_id)
    if name != PurePath(name.replace("\\", "/")).name:
        raise fail(400, "invalid_file_name", "That file name isn't valid.")
    db = _existing_session(session_id)
    if not db.remove_file(name):
        raise fail(404, "file_not_found", "That file isn't in this session.")
    history.notice(session_id, f"Removed {name}")
    return _session_files(session_id, db)


def list_files(session_id: str) -> SessionFiles:
    """Details of every file in a session, so the UI can restore itself after a reload."""
    return _session_files(session_id, _existing_session(session_id))


def sample_events(session_id: str | None) -> Iterator[dict]:
    """Load the sample CSVs into a session, reporting each file as it is read, cleaned and ready."""
    if session_id is not None and not is_valid_session_id(session_id):
        yield {"type": "error", "status": 400, "code": "invalid_session", "message": "That session isn't valid."}
        return
    sample_dir = settings.sample_data_dir
    csvs = sorted(sample_dir.glob("*.csv")) if sample_dir.is_dir() else []
    if not csvs:
        yield {"type": "error", "status": 404, "code": "sample_unavailable", "message": "The sample data isn't available on this server."}
        return

    sid = get_or_create_session(session_id)
    db = get_session(sid)
    target = session_dir(sid)
    yield {"type": "start", "session_id": sid, "files": [p.name for p in csvs]}
    uploaded: list[str] = []
    rejected: list[RejectedFile] = []
    for path in csvs:
        yield {"type": "file", "name": path.name, "stage": "reading"}
        part = _incoming_path()
        try:
            with path.open("rb") as source:
                try:
                    has_content = _copy_in_chunks(source, part)
                    problem = None if has_content else RejectedFile(name=path.name, reason="File is empty")
                except _TooLarge:
                    problem = RejectedFile(name=path.name, reason=_too_large_reason())
            if problem is None:
                yield {"type": "file", "name": path.name, "stage": "cleaning"}
                problem = _install(db, target, path.name, part)
        finally:
            part.unlink(missing_ok=True)
        if problem:
            rejected.append(problem)
            yield {"type": "file", "name": path.name, "stage": "error", "reason": problem.reason}
        else:
            uploaded.append(path.name)
            yield {"type": "file", "name": path.name, "stage": "ready", "rows": db.files[path.name].row_count}
    if uploaded:
        history.notice(sid, f"Loaded sample data: {', '.join(uploaded)}")
    result = UploadResponse(**_session_files(sid, db).model_dump(), uploaded=uploaded, rejected=rejected)
    yield {"type": "result", "data": result.model_dump(mode="json")}


def stream_sample(session_id: str | None) -> Iterator[str]:
    """Newline-delimited JSON version of sample_events, for a live progress display."""
    for event in sample_events(session_id):
        yield json.dumps(event) + "\n"
