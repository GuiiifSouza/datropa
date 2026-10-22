import logging

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
from app.validacoes import (
    validar_identificadores,
    validar_parametros,
    validar_periodo,
)

router = APIRouter()

COMPOSICOES_LISTA_SQL = carregar_sql("composicoes_lista.sql")


@router.get("/api/stats/composicoes")
@coordenar_consultas
def listar_composicoes(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    time_id: str | None = None,
    mapa_id: str | None = None,
    torneio_id: str | None = None,
    agente_id: str | None = None,
    data_inicio: str | None = None,
    data_fim: str | None = None,
):
    validar_parametros(
        request,
        {
            "page",
            "page_size",
            "time_id",
            "mapa_id",
            "torneio_id",
            "agente_id",
            "data_inicio",
            "data_fim",
        },
    )

    identificadores = {
        "time_id": time_id,
        "mapa_id": mapa_id,
        "torneio_id": torneio_id,
        "agente_id": agente_id,
    }

    validar_identificadores(identificadores)
    inicio, fim = validar_periodo(data_inicio, data_fim)

    chave_cache = (
        "gold_336_v1",
        "composicoes_lista_publico_v1",
        page,
        page_size,
        time_id,
        mapa_id,
        torneio_id,
        agente_id,
        inicio,
        fim,
    )

    resposta_cache = obter_cache(chave_cache)

    if resposta_cache is not None:
        logging.getLogger("uvicorn.error").info(
            "Composicoes: cache HIT"
        )
        return resposta_cache

    logging.getLogger("uvicorn.error").info(
        "Composicoes: cache MISS"
    )

    config = bigquery.QueryJobConfig(
        maximum_bytes_billed=MAXIMUM_BYTES_BILLED,
        query_parameters=[
            *[
                bigquery.ScalarQueryParameter(
                    campo, "STRING", valor
                )
                for campo, valor in identificadores.items()
            ],
            bigquery.ScalarQueryParameter(
                "data_inicio", "DATE", inicio
            ),
            bigquery.ScalarQueryParameter(
                "data_fim", "DATE", fim
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
                COMPOSICOES_LISTA_SQL,
                job_config=config,
            ).result(timeout=30)

            resultado = next(iter(rows))

            resposta = {
                "data": converter_resultado(
                    resultado["composicoes"]
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
        logging.exception("Falha ao consultar composicoes")
        raise ApiError(
            503,
            "DATA_UNAVAILABLE",
            "Composições temporariamente indisponíveis.",
        )