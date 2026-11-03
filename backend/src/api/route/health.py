from chatapp import llm


def health() -> dict:
    """Liveness plus whether the AI service can be used. The key itself is never included."""
    configured = llm.is_configured()
    return {"status": "ok", "groq_key_configured": configured, "model": llm.MODEL if configured else None}
