from chatapp import llm
from chatapp.config import settings


def health() -> dict:
    """Liveness plus whether the AI service can be used. The key itself is never included."""
    configured = llm.is_configured()
    return {
        "status": "ok",
        "groq_key_configured": configured,
        "fallback_key_configured": llm.has_fallback(),
        "model": settings.groq_model if configured else None,
    }
