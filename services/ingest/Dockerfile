# Ingest no Cloud Run, chamado pelo Eventarc. Build: docker build -t ingest services/ingest
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.9.5 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1 PATH="/app/.venv/bin:$PATH"

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY ingest ./ingest

RUN useradd --uid 10001 --no-create-home ingest
USER ingest

# O Cloud Run define PORT (8080 por padrão).
CMD ["sh", "-c", "exec uvicorn ingest.app:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1 --no-access-log"]
