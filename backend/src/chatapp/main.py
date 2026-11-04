import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, File, Form, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from api import errors
from api.route import chat as chat_route
from api.route import files as files_route
from api.route import health as health_route
from api.route import query as query_route
from api.route import sessions as sessions_route
from schemas.chat import ChatRequest, ChatResponse, QueryRequest, QueryResult, SessionHistory
from chatapp.config import settings
from chatapp.session_db import CleanupThread
from schemas.files import SampleRequest, SessionFiles, UploadResponse, UrlUploadRequest

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Delete session folders idle longer than SESSION_TTL_SECONDS: once now, then every
    # CLEANUP_INTERVAL_SECONDS (see chatapp/config.py).
    cleanup = CleanupThread()
    cleanup.start()
    yield
    cleanup.stop()


app = FastAPI(title="ChatAPP", lifespan=lifespan)
errors.install(app)  # every error: {"detail": {"code", "message"}}

# Browser origins allowed to call the API: CORS_ORIGINS in chatapp/config.py.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- Endpoints. The logic lives in api/route/*.py; the routes are declared here. ----

@app.get("/")
def welcome():
    return {"message": "Welcome to the ChatAPP"}


@app.get("/health")
def health():
    return health_route.health()


@app.post("/files", response_model=UploadResponse, responses={400: {}})
def upload_files(
    files: list[UploadFile] = File(...),
    session_id: str | None = Form(None),
):
    """Upload several CSVs (multipart, field `files`). Each is cleaned into its own table."""
    return files_route.upload_files(files, session_id)


@app.post("/files/url", response_model=UploadResponse, responses={400: {}})
def upload_from_url(req: UrlUploadRequest):
    """Add a CSV from a link: a direct URL, or a Google Drive / Sheets, Dropbox or GitHub share link."""
    return files_route.upload_from_url(req)


@app.post("/files/sample")
def load_sample(req: SampleRequest):
    """Load the bundled "Online Shop 2024" CSVs. Streams newline-delimited JSON:
    {"type":"start"}, then {"type":"file","name","stage":"reading|cleaning|ready|error"} per file,
    then {"type":"result","data":UploadResponse} (or {"type":"error"})."""
    return StreamingResponse(
        files_route.stream_sample(req.session_id),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@app.delete("/files/{name}", response_model=SessionFiles, responses={400: {}, 404: {}})
def delete_file(name: str, session_id: str = Query(...)):
    """Remove an uploaded file: its table, its CSV on disk, and any links to other tables."""
    return files_route.delete_file(session_id, name)


@app.get("/files", response_model=SessionFiles, responses={400: {}, 404: {}})
def list_files(session_id: str = Query(...)):
    """Tables, cleaning steps and links between tables for a session."""
    return files_route.list_files(session_id)


@app.post("/chat", response_model=ChatResponse, responses={400: {}, 404: {}, 409: {}, 422: {}, 429: {}, 502: {}, 503: {}, 504: {}})
def chat(req: ChatRequest):
    """Ask a question about the session's tables."""
    return chat_route.answer_question(req)


@app.post("/chat/stream")
def chat_stream(req: ChatRequest):
    """Same as /chat, but streams progress as newline-delimited JSON:
    {"type":"step","step":"reading|querying|running|explaining"} ... then {"type":"result","data":...} or {"type":"error",...}."""
    return StreamingResponse(
        chat_route.stream_answer(req),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@app.post("/query", response_model=QueryResult, responses={400: {}, 404: {}, 422: {}})
def query(req: QueryRequest):
    """Re-run a saved answer by its id (used to redraw charts and tables when a past chat is opened)."""
    return query_route.run_saved_query(req)


@app.get("/sessions/{session_id}/history", response_model=SessionHistory, responses={400: {}, 404: {}})
def session_history(session_id: str):
    """The messages of this one chat (session). There is no way to list other people's chats."""
    return sessions_route.get_history(session_id)


@app.delete("/sessions/{session_id}", responses={400: {}, 404: {}})
def delete_session(session_id: str):
    """Delete a chat for good: its files, tables and history."""
    return sessions_route.remove_session(session_id)


if __name__ == "__main__":
    uvicorn.run("chatapp.main:app", host="127.0.0.1", port=8000, reload=True)
