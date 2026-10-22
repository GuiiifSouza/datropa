import logging
from typing import Literal

from fastapi import APIRouter, Query, Request

from app.cache import coordenar_consultas, obter_cache, salvar_cache
from app.database import (
    MAXIMUM_BYTES_BILLED,
    bigquery,
    carregar_sql,
    conexao_bigquery,
)
from app.erros import ApiError
from app.serializacao import converter_resultado
from app.validacoes import validar_parametros

router = APIRouter()

BUSCA_SQL = carregar_sql("busca.sql")


@router.get("/api/stats/busca")
@coordenar_consultas
def buscar(
    request: Request,
    q: str,
    tipo: Literal["time", "jogador", "mapa"] | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    validar_parametros(
        request,
        {"q", "tipo", "page", "page_size"},
    )

    termo = q.strip()

    if not 2 <= len(termo) <= 100:
        raise ApiError(
            400,
            "INVALID_ARGUMENT",
            "q deve ter de 2 a 100 caracteres após trim.",
            "q",
        )

    chave_cache = (
        "gold_336_v1",
        "busca_publica_v1",
        termo,
        tipo,
        page,
        page_size,
    )

    resposta_cache = obter_cache(chave_cache)

    if resposta_cache is not None:
        logging.getLogger("uvicorn.error").info(
            "Busca: cache HIT"
        )
        return resposta_cache

    logging.getLogger("uvicorn.error").info(
        "Busca: cache MISS"
    )

    config = bigquery.QueryJobConfig(
        maximum_bytes_billed=MAXIMUM_BYTES_BILLED,
        query_parameters=[
            bigquery.ScalarQueryParameter(
                "q", "STRING", termo
            ),
            bigquery.ScalarQueryParameter(
                "tipo", "STRING", tipo
            ),
            bigquery.ScalarQueryParameter(
                "limite", "INT64", page_size
            ),
            bigquery.ScalarQueryParameter(
                "deslocamento", "INT64", (page - 1) * page_size
            ),
        ],
    )

    try:
        with conexao_bigquery() as client:
            rows = client.query(
                BUSCA_SQL,
                job_config=config,
            ).result(timeout=30)

            resultado = next(iter(rows))

            resposta = {
                "data": converter_resultado(
                    resultado["resultados"]
                ),
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": resultado["total"],
                },
                "meta": {"atualizado_em": None},
            }

        salvar_cache(chave_cache, resposta)
        return resposta

    except ApiError:
        raise

    except Exception:
        logging.exception("Falha ao buscar entidades")
        raise ApiError(
            503,
            "DATA_UNAVAILABLE",
            "Busca temporariamente indisponível.",
        )