"""One error format for the whole API: {"detail": {"code": "...", "message": "..."}}.

`message` is written for people and can be shown as is; `code` is for programs. Some errors add
extra fields next to them (e.g. `rejected` for uploads)."""
import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


def fail(status: int, code: str, message: str, **extra) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message, **extra})


def _body(code: str, message: str, **extra) -> dict:
    return {"detail": {"code": code, "message": message, **extra}}


def install(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        if isinstance(exc.detail, dict) and "code" in exc.detail:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
        code = {404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, f"http_{exc.status_code}")
        message = exc.detail if isinstance(exc.detail, str) and exc.detail else "The request could not be completed."
        return JSONResponse(status_code=exc.status_code, content=_body(code, message))

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_: Request, exc: RequestValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        field = ".".join(str(p) for p in first.get("loc", ())[1:]) or "request"
        message = f"Invalid {field}: {first.get('msg', 'the value is not allowed')}."
        return JSONResponse(status_code=422, content=_body("invalid_request", message))

    @app.exception_handler(Exception)
    async def unexpected(_: Request, exc: Exception):
        logger.exception("Unhandled error")
        return JSONResponse(status_code=500, content=_body("internal_error", "Something went wrong on the server. Please try again."))
