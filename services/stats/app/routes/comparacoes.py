import logging

from fastapi import APIRouter, Request

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

COMPARACAO_TIMES_SQL = carregar_sql("comparacao_times.sql")


@router.get("/api/stats/comparacoes/times")
@coordenar_consultas
def comparar_times(
    request: Request,
    time_a_id: str,
    time_b_id: str,
    mapa_id: str | None = None,
    torneio_id: str | None = None,
    data_inicio: str | None = None,
    data_fim: str | None = None,
):
    validar_parametros(
        request,
        {
            "time_a_id",
            "time_b_id",
            "mapa_id",
            "torneio_id",
            "data_inicio",
            "data_fim",
        },
    )

    identificadores = {
        "time_a_id": time_a_id,
        "time_b_id": time_b_id,
        "mapa_id": mapa_id,
        "torneio_id": torneio_id,
    }

    validar_identificadores(identificadores)

    if time_a_id == time_b_id:
        raise ApiError(
            400,
            "INVALID_ARGUMENT",
            "time_a_id e time_b_id devem ser distintos.",
            "time_b_id",
        )

    inicio, fim = validar_periodo(data_inicio, data_fim)

    chave_cache = (
        "gold_336_v1",
        "comparacao_times_publico_v1",
        time_a_id,
        time_b_id,
        mapa_id,
        torneio_id,
        inicio,
        fim,
    )

    resposta_cache = obter_cache(chave_cache)

    if resposta_cache is not None:
        logging.getLogger("uvicorn.error").info(
            "Comparacao times: cache HIT"
        )
        return resposta_cache

    logging.getLogger("uvicorn.error").info(
        "Comparacao times: cache MISS"
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
        ],
    )

    try:
        with conexao_bigquery() as client:
            rows = client.query(
                COMPARACAO_TIMES_SQL,
                job_config=config,
            ).result(timeout=30)

            resultado = next(iter(rows), None)

            if resultado is None:
                raise ApiError(
                    404,
                    "NOT_FOUND",
                    "Um ou ambos os times não foram encontrados.",
                )

            resposta = {
                "data": converter_resultado(resultado),
                "meta": {"atualizado_em": None},
            }

        salvar_cache(chave_cache, resposta)
        return resposta

    except ApiError:
        raise

    except Exception:
        logging.exception("Falha ao comparar times")
        raise ApiError(
            503,
            "DATA_UNAVAILABLE",
            "Comparação de times temporariamente indisponível.",
        )