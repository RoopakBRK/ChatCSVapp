"""Every setting in one place, read from the environment (and backend/.env if present).

    GROQ_API_KEY                  the AI service key (never logged or returned)
    GROQ_FALLBACK_API_KEY         a second key, used when the first is rate limited, refused or down
    GROQ_MODEL                    model name                                  openai/gpt-oss-20b
    LLM_TIMEOUT_SECONDS           timeout for one AI call                     20
    LLM_MAX_RETRIES               retries after a failed AI call              1
    QUESTION_DEADLINE_SECONDS     total time budget for one question          60
    QUERY_TIMEOUT_SECONDS         time limit for running one SQL query        15
    MAX_RESULT_ROWS               rows returned to the browser per answer     500
    MAX_UPLOAD_MB                 largest CSV accepted, uploaded or linked    50
    LINK_FETCH_TIMEOUT_SECONDS    time limit for downloading a linked file    20
    SESSION_TTL_SECONDS           idle time before a session folder is
                                  deleted from disk                           86400 (24 h)
    SESSION_MEMORY_TTL_SECONDS    idle time before a session is unloaded
                                  from memory (it reopens from disk)          7200 (2 h)
    CLEANUP_INTERVAL_SECONDS      how often idle sessions are cleaned up      1800 (30 min)
    CORS_ORIGINS                  comma-separated browser origins allowed     http://localhost:3000,http://127.0.0.1:3000
    DATA_DIR                      where session folders live                  backend/data/sessions
    SAMPLE_DATA_DIR               the "Online Shop 2024" sample CSVs          <repo>/innowhytetakehomeassignment/Online Shop 2024
"""
import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")  # values already in the environment win


def _float(name: str, default: float) -> float:
    return float(os.getenv(name) or default)


def _int(name: str, default: int) -> int:
    return int(os.getenv(name) or default)


@dataclass
class Settings:
    groq_model: str = field(default_factory=lambda: os.getenv("GROQ_MODEL") or "openai/gpt-oss-20b")
    llm_timeout_seconds: float = field(default_factory=lambda: _float("LLM_TIMEOUT_SECONDS", 20))
    llm_max_retries: int = field(default_factory=lambda: _int("LLM_MAX_RETRIES", 1))
    question_deadline_seconds: float = field(default_factory=lambda: _float("QUESTION_DEADLINE_SECONDS", 60))
    query_timeout_seconds: float = field(default_factory=lambda: _float("QUERY_TIMEOUT_SECONDS", 15))
    max_result_rows: int = field(default_factory=lambda: _int("MAX_RESULT_ROWS", 500))
    max_upload_mb: float = field(default_factory=lambda: _float("MAX_UPLOAD_MB", 50))
    link_fetch_timeout_seconds: float = field(default_factory=lambda: _float("LINK_FETCH_TIMEOUT_SECONDS", 20))
    session_ttl_seconds: float = field(default_factory=lambda: _float("SESSION_TTL_SECONDS", 24 * 3600))
    session_memory_ttl_seconds: float = field(default_factory=lambda: _float("SESSION_MEMORY_TTL_SECONDS", 2 * 3600))
    cleanup_interval_seconds: float = field(default_factory=lambda: _float("CLEANUP_INTERVAL_SECONDS", 30 * 60))
    cors_origins: list[str] = field(
        default_factory=lambda: [
            o.strip() for o in (os.getenv("CORS_ORIGINS") or "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()
        ]
    )
    data_dir: Path = field(default_factory=lambda: Path(os.getenv("DATA_DIR") or BACKEND_DIR / "data" / "sessions"))
    sample_data_dir: Path = field(
        default_factory=lambda: Path(os.getenv("SAMPLE_DATA_DIR") or BACKEND_DIR.parent / "innowhytetakehomeassignment" / "Online Shop 2024")
    )

    @property
    def max_upload_bytes(self) -> int:
        return int(self.max_upload_mb * 1024 * 1024)


settings = Settings()
