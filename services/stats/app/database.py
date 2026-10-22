from contextlib import contextmanager
from pathlib import Path
from threading import BoundedSemaphore

from google.cloud import bigquery

from app.erros import ApiError

MAXIMUM_BYTES_BILLED = 1073741824
CONSULTAS_SIMULTANEAS = BoundedSemaphore(4)
QUERIES_DIR = Path(__file__).resolve().parent.parent / "queries"


def carregar_sql(nome):
    return (QUERIES_DIR / nome).read_text(encoding="utf-8")


@contextmanager
def conexao_bigquery():
    """Reserva uma vaga por chamada e a libera mesmo se ocorrer uma falha."""
    if not CONSULTAS_SIMULTANEAS.acquire(blocking=False):
        raise ApiError(
            503,
            "DATA_UNAVAILABLE",
            "Servidor ocupado. Tente novamente em alguns instantes.",
        )

    try:
        with bigquery.Client(
            project="datropa",
            location="southamerica-east1",
        ) as client:
            yield client
    finally:
        CONSULTAS_SIMULTANEAS.release()
