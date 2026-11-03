from pathlib import PurePath

from fastapi import HTTPException, UploadFile

from chatapp.cleaning import CleaningError
from chatapp.session_db import get_session
from chatapp.sessions import get_or_create_session, is_valid_session_id, session_dir
from schemas.files import RejectedFile, SessionFiles, UploadResponse

MAX_FILE_BYTES = 50 * 1024 * 1024


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
        if not name.lower().endswith(".csv"):
            rejected.append(RejectedFile(name=name or "(unnamed)", reason="Only .csv files are supported"))
            continue

        content = upload.file.read(MAX_FILE_BYTES + 1)
        if len(content) > MAX_FILE_BYTES:
            rejected.append(RejectedFile(name=name, reason="File is larger than 50 MB"))
            continue
        if not content.strip():
            rejected.append(RejectedFile(name=name, reason="File is empty"))
            continue

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
            rejected.append(RejectedFile(name=name, reason=f"Could not parse as CSV: {exc}"))
            continue
        uploaded.append(name)

    if not uploaded:
        raise HTTPException(
            status_code=400,
            detail={"message": "No valid CSV files uploaded", "rejected": [r.model_dump() for r in rejected]},
        )

    return UploadResponse(
        session_id=sid, files=db.summaries(), relationships=db.relationships,
        uploaded=uploaded, rejected=rejected,
    )


def list_files(session_id: str) -> SessionFiles:
    """Details of every file in a session, so the UI can restore itself after a reload."""
    if not is_valid_session_id(session_id):
        raise HTTPException(status_code=400, detail="Invalid session_id")
    db = get_session(session_id)
    if db is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionFiles(session_id=session_id, files=db.summaries(), relationships=db.relationships)
