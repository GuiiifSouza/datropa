import logging

from fastapi import APIRouter, Path, Query, Request

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

PARTIDAS_LISTA_SQL = carregar_sql("partidas_lista.sql")
PARTIDA_DETALHE_SQL = carregar_sql("partida_detalhe.sql")
ROUND_EVENTOS_SQL = carregar_sql("round_eventos.sql")


@router.get("/api/stats/partidas")
@coordenar_consultas
def listar_partidas(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    mapa_id: str | None = None,
    torneio_id: str | None = None,
    time_id: str | None = None,
    jogador_id: str | None = None,
    data_inicio: str | None = None,
    data_fim: str | None = None,
):
    validar_parametros(
        request,
        {
            "page",
            "page_size",
            "mapa_id",
            "torneio_id",
            "time_id",
            "jogador_id",
            "data_inicio",
            "data_fim",
        },
    )

    identificadores = {
        "mapa_id": mapa_id,
        "torneio_id": torneio_id,
        "time_id": time_id,
        "jogador_id": jogador_id,
    }
    
    validar_identificadores(identificadores)
    inicio, fim = validar_periodo(data_inicio, data_fim)

    chave_cache = (
        "gold_336_v1",
        "partidas_lista_publico_v1",
        page,
        page_size,
        mapa_id,
        torneio_id,
        time_id,
        jogador_id,
        inicio,
        fim,
    )

    resposta_cache = obter_cache(chave_cache)

    if resposta_cache is not None:
        logging.getLogger("uvicorn.error").info(
            "Lista partidas: cache HIT"
        )
        return resposta_cache

    logging.getLogger("uvicorn.error").info(
        "Lista partidas: cache MISS"
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
                PARTIDAS_LISTA_SQL,
                job_config=config,
            ).result(timeout=30)

            resultado = next(iter(rows))

            resposta = {
                "data": converter_resultado(
                    resultado["partidas"]
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
        logging.exception("Falha ao consultar lista de partidas")
        raise ApiError(
            503,
            "DATA_UNAVAILABLE",
            "Partidas temporariamente indisponíveis.",
        )

    PARTIDA_DETALHE_SQL = carregar_sql("partida_detalhe.sql")


@router.get("/api/stats/partidas/{partida_id}")
@coordenar_consultas
def detalhe_partida(
    request: Request,
    partida_id: str,
):
    validar_parametros(request, set())
    validar_identificadores({"partida_id": partida_id})

    chave_cache = (
        "gold_336_v1",
        "partida_detalhe_publico_v2",
        partida_id,
    )

    resposta_cache = obter_cache(chave_cache)

    if resposta_cache is not None:
        logging.getLogger("uvicorn.error").info(
            "Detalhe partida: cache HIT"
        )
        return resposta_cache

    logging.getLogger("uvicorn.error").info(
        "Detalhe partida: cache MISS"
    )

    config = bigquery.QueryJobConfig(
        maximum_bytes_billed=MAXIMUM_BYTES_BILLED,
        query_parameters=[
            bigquery.ScalarQueryParameter(
                "partida_id", "STRING", partida_id
            ),
        ],
    )

    try:
        with conexao_bigquery() as client:
            rows = client.query(
                PARTIDA_DETALHE_SQL,
                job_config=config,
            ).result(timeout=30)

            partida = next(iter(rows), None)

            if partida is None:
                raise ApiError(
                    404,
                    "NOT_FOUND",
                    "Partida não encontrada.",
                )

            resposta = {
                "data": converter_resultado(partida),
                "meta": {"atualizado_em": None},
            }

        salvar_cache(chave_cache, resposta)
        return resposta

    except ApiError:
        raise

    except Exception:
        logging.exception("Falha ao consultar detalhe da partida")
        raise ApiError(
            503,
            "DATA_UNAVAILABLE",
            "Dados da partida temporariamente indisponíveis.",
        )

@router.get(
    "/api/stats/partidas/{partida_id}/rounds/{round}/eventos"
)
@coordenar_consultas
def eventos_round(
    request: Request,
    partida_id: str,
    round: int = Path(ge=1),
):
    validar_parametros(request, set())
    validar_identificadores({"partida_id": partida_id})

    chave_cache = (
        "gold_336_v1",
        "round_eventos_publico_v1",
        partida_id,
        round,
    )

    resposta_cache = obter_cache(chave_cache)

    if resposta_cache is not None:
        logging.getLogger("uvicorn.error").info(
            "Eventos round: cache HIT"
        )
        return resposta_cache

    logging.getLogger("uvicorn.error").info(
        "Eventos round: cache MISS"
    )

    config = bigquery.QueryJobConfig(
        maximum_bytes_billed=MAXIMUM_BYTES_BILLED,
        query_parameters=[
            bigquery.ScalarQueryParameter(
                "partida_id", "STRING", partida_id
            ),
            bigquery.ScalarQueryParameter(
                "round", "INT64", round
            ),
        ],
    )

    try:
        with conexao_bigquery() as client:
            rows = client.query(
                ROUND_EVENTOS_SQL,
                job_config=config,
            ).result(timeout=30)

            resultado = next(iter(rows), None)

            if resultado is None:
                raise ApiError(
                    404,
                    "NOT_FOUND",
                    "Partida ou round não encontrado.",
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
        logging.exception("Falha ao consultar eventos do round")
        raise ApiError(
            503,
            "DATA_UNAVAILABLE",
            "Eventos do round temporariamente indisponíveis.",
        )