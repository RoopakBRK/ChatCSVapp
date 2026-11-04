# Backend: the Python API that cleans CSV files and answers questions.
# Python 3.13 with uv (the package installer) already inside.
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1

# 1. Install the libraries first. This step is cached, so changing code doesn't reinstall them.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

# 2. Add the app code and install the app itself.
COPY README.md ./
COPY src ./src
RUN uv sync --locked --no-dev

# 3. The sample "Online Shop 2024" files, for the "Try sample data" button.
COPY ["Online Shop 2024", "./sample_data"]

# 4. Run as a normal user, not root. Uploaded files are kept in /app/data.
RUN useradd --create-home app && mkdir -p /app/data/sessions && chown -R app:app /app/data
USER app

ENV PATH="/app/.venv/bin:$PATH" \
    DATA_DIR=/app/data/sessions \
    SAMPLE_DATA_DIR=/app/sample_data

EXPOSE 8000
CMD ["uvicorn", "chatapp.main:app", "--host", "0.0.0.0", "--port", "8000"]
