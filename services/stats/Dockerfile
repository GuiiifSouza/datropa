FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /service

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN useradd --create-home --uid 10001 appuser

COPY --chown=appuser:appuser app/ ./app/
COPY --chown=appuser:appuser queries/ ./queries/

USER appuser

EXPOSE 8080

CMD ["sh", "-c", "exec python -m uvicorn app.main:app --host 0.0.0.0 --port \"$PORT\" --workers 1"]
