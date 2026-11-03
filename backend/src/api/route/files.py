import json
import os
from pathlib import Path, PurePath
from typing import Iterator

from fastapi import HTTPException, UploadFile

from chatapp.cleaning import CleaningError
from chatapp.remote import RemoteFileError, fetch_csv
from chatapp.session_db import get_session
from chatapp.suggestions import starter_questions
from chatapp.sessions import get_or_create_session, is_valid_session_id, session_dir
from schemas.files import RejectedFile, SessionFiles, UploadResponse, UrlUploadRequest

MAX_FILE_BYTES = 50 * 1024 * 1024

# The "Online Shop 2024" sample shipped with the project (override with SAMPLE_DATA_DIR).
SAMPLE_DIR = Path(os.getenv("SAMPLE_DATA_DIR") or Path(__file__).resolve().parents[4] / "innowhytetakehomeassignment" / "Online Shop 2024")


def _store(db, target, name: str, content: bytes) -> RejectedFile | None:
    """Save one CSV into the session and clean it into a table. Returns why it was rejected, if it was."""
    if not name.lower().endswith(".csv"):
        return RejectedFile(name=name or "(unnamed)", reason="Only .csv files are supported")
    if len(content) > MAX_FILE_BYTES:
        return RejectedFile(name=name, reason="File is larger than 50 MB")
    if not content.strip():
        return RejectedFile(name=name, reason="File is empty")
    dest = target / name
    previous = dest.read_bytes() if dest.exists() else None
    dest.write_bytes(content)
    try:
        db.load_csv(dest)
    except CleaningError as exc:
        # Put back whatever was there before so a bad re-upload doesn't destroy a good file.
        if previous is None:
            dest.unlink(missing_ok=True)
        else:
            dest.write_bytes(previous)
        return RejectedFile(name=name, reason=f"Could not parse as CSV: {exc}")
    return None


def _session_files(sid: str, db) -> SessionFiles:
    return SessionFiles(
        session_id=sid, files=db.summaries(), relationships=db.relationships,
        starter_questions=starter_questions(db.summaries(), db.relationships),
    )


def _rejected_error(rejected: list[RejectedFile]) -> HTTPException:
    return HTTPException(
        status_code=400,
        detail={"message": "No valid CSV files uploaded", "rejected": [r.model_dump() for r in rejected]},
    )


def upload_files(files: list[UploadFile], session_id: str | None) -> UploadResponse:
    """Accept several CSVs, clean each into its own table, and summarise what was done."""
    if session_id is not None and not is_valid_session_id(session_id):
        raise HTTPException(status_code=400, detail="Invalid session_id")

    sid = get_or_create_session(session_id)
    db = get_session(sid)
    target = session_dir(sid)

    uploaded: list[str] = []
    rejected: list[RejectedFile] = []

    for upload in files:
        # Strip any directory components from the client-supplied name.
        name = PurePath((upload.filename or "").replace("\\", "/")).name
        problem = _store(db, target, name, upload.file.read(MAX_FILE_BYTES + 1))
        if problem:
            rejected.append(problem)
        else:
            uploaded.append(name)

    if not uploaded:
        raise _rejected_error(rejected)
    return UploadResponse(**_session_files(sid, db).model_dump(), uploaded=uploaded, rejected=rejected)


def upload_from_url(req: UrlUploadRequest) -> UploadResponse:
    """Download a CSV from a link (direct, Google Drive/Sheets, Dropbox, GitHub) into the session."""
    if req.session_id is not None and not is_valid_session_id(req.session_id):
        raise HTTPException(status_code=400, detail="Invalid session_id")
    try:
        name, content = fetch_csv(req.url)  # before touching the session, so a bad link creates nothing
    except RemoteFileError as exc:
        raise _rejected_error([RejectedFile(name=req.url[:80], reason=str(exc))])

    sid = get_or_create_session(req.session_id)
    db = get_session(sid)
    problem = _store(db, session_dir(sid), name, content)
    if problem:
        raise _rejected_error([problem])
    return UploadResponse(**_session_files(sid, db).model_dump(), uploaded=[name], rejected=[])


def delete_file(session_id: str, name: str) -> SessionFiles:
    """Remove one uploaded file: its table, its CSV on disk, and any links to it."""
    if not is_valid_session_id(session_id):
        raise HTTPException(status_code=400, detail="Invalid session_id")
    if name != PurePath(name.replace("\\", "/")).name:
        raise HTTPException(status_code=400, detail="Invalid file name")
    db = get_session(session_id)
    if db is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if not db.remove_file(name):
        raise HTTPException(status_code=404, detail="That file isn't in this session")
    return _session_files(session_id, db)


def list_files(session_id: str) -> SessionFiles:
    """Details of every file in a session, so the UI can restore itself after a reload."""
    if not is_valid_session_id(session_id):
        raise HTTPException(status_code=400, detail="Invalid session_id")
    db = get_session(session_id)
    if db is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return _session_files(session_id, db)


def sample_events(session_id: str | None) -> Iterator[dict]:
    """Load the sample CSVs into a session, reporting each file as it is read, cleaned and ready."""
    if session_id is not None and not is_valid_session_id(session_id):
        yield {"type": "error", "status": 400, "message": "That session isn't valid."}
        return
    csvs = sorted(SAMPLE_DIR.glob("*.csv")) if SAMPLE_DIR.is_dir() else []
    if not csvs:
        yield {"type": "error", "status": 404, "message": "The sample data isn't available on this server."}
        return

    sid = get_or_create_session(session_id)
    db = get_session(sid)
    target = session_dir(sid)
    yield {"type": "start", "session_id": sid, "files": [p.name for p in csvs]}
    uploaded: list[str] = []
    rejected: list[RejectedFile] = []
    for path in csvs:
        yield {"type": "file", "name": path.name, "stage": "reading"}
        content = path.read_bytes()
        yield {"type": "file", "name": path.name, "stage": "cleaning"}
        problem = _store(db, target, path.name, content)
        if problem:
            rejected.append(problem)
            yield {"type": "file", "name": path.name, "stage": "error", "reason": problem.reason}
        else:
            uploaded.append(path.name)
            yield {"type": "file", "name": path.name, "stage": "ready", "rows": db.files[path.name].row_count}
    result = UploadResponse(**_session_files(sid, db).model_dump(), uploaded=uploaded, rejected=rejected)
    yield {"type": "result", "data": result.model_dump(mode="json")}


def stream_sample(session_id: str | None) -> Iterator[str]:
    """Newline-delimited JSON version of sample_events, for a live progress display."""
    for event in sample_events(session_id):
        yield json.dumps(event) + "\n"
