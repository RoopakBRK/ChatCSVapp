import os

import uvicorn
from fastapi import FastAPI, File, Form, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from api.route import chat as chat_route
from api.route import files as files_route
from api.route import health as health_route
from api.route import query as query_route
from schemas.chat import ChatRequest, ChatResponse, QueryRequest, QueryResult
from schemas.files import SessionFiles, UploadResponse, UrlUploadRequest

app = FastAPI(title="ChatAPP")

# Frontend origins allowed to call the API. Override with CORS_ORIGINS="a,b".
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
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
    {"type":"step","step":"understanding|running|writing"} ... then {"type":"result","data":...} or {"type":"error",...}."""
    return StreamingResponse(
        chat_route.stream_answer(req),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@app.post("/query", response_model=QueryResult, responses={400: {}, 404: {}, 422: {}})
def query(req: QueryRequest):
    """Re-run read-only SQL from an earlier answer (used to restore charts and tables in chat history)."""
    return query_route.run_saved_query(req)


if __name__ == "__main__":
    uvicorn.run("chatapp.main:app", host="127.0.0.1", port=8000, reload=True)
