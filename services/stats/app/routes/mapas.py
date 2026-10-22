import logging

from fastapi import APIRouter, Query, Request
from typing import Literal

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

MAPAS_LISTA_SQL = carregar_sql("mapas_lista.sql")
MAPA_CALOR_SQL = carregar_sql("mapa_calor.sql")

@router.get("/api/stats/mapas")
@coordenar_consultas
def listar_mapas(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    mapa_id: str | None = None,
    agente_id: str | None = None,
    torneio_id: str | None = None,
    data_inicio: str | None = None,
    data_fim: str | None = None,
):
    validar_parametros(
        request,
        {
            "page",
            "page_size",
            "mapa_id",
            "agente_id",
            "torneio_id",
            "data_inicio",
            "data_fim",
        },
    )

    identificadores = {
        "mapa_id": mapa_id,
        "agente_id": agente_id,
        "torneio_id": torneio_id,
    }

    validar_identificadores(identificadores)
    inicio, fim = validar_periodo(data_inicio, data_fim)

    chave_cache = (
        "gold_336_v1",
        "mapas_lista_publico_v1",
        page,
        page_size,
        mapa_id,
        agente_id,
        torneio_id,
        inicio,
        fim,
    )

    resposta_cache = obter_cache(chave_cache)

    if resposta_cache is not None:
        logging.getLogger("uvicorn.error").info(
            "Lista mapas: cache HIT"
        )
        return resposta_cache

    logging.getLogger("uvicorn.error").info(
        "Lista mapas: cache MISS"
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
                MAPAS_LISTA_SQL,
                job_config=config,
            ).result(timeout=30)

            resultado = next(iter(rows))

            resposta = {
                "data": converter_resultado(resultado["mapas"]),
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
        logging.exception("Falha ao consultar mapas")
        raise ApiError(
            503,
            "DATA_UNAVAILABLE",
            "Mapas temporariamente indisponíveis.",
        )

@router.get("/api/stats/mapas/{mapa_id}/calor")
@coordenar_consultas
def calor_mapa(
    request: Request,
    mapa_id: str,
    tipo: Literal["abate", "plant", "morte"],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=1000),
    torneio_id: str | None = None,
    time_id: str | None = None,
    jogador_id: str | None = None,
    lado: Literal["ataque", "defesa"] | None = None,
    compra: Literal["pistol", "eco", "force", "full"] | None = None,
    tempo_inicio_ms: int | None = Query(default=None, ge=0, le=9223372036854775807),
    tempo_fim_ms: int | None = Query(default=None, ge=0, le=9223372036854775807),
    data_inicio: str | None = None,
    data_fim: str | None = None,
):
    validar_parametros(
        request,
        {
            "tipo",
            "lado",
            "compra",
            "tempo_inicio_ms",
            "tempo_fim_ms",
            "page",
            "page_size",
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

    if (
        tempo_inicio_ms is not None
        and tempo_fim_ms is not None
        and tempo_inicio_ms >= tempo_fim_ms
    ):
        raise ApiError(
            400, "INVALID_ARGUMENT",
            "tempo_inicio_ms deve ser menor que tempo_fim_ms.",
            "tempo_inicio_ms",
        )

    chave_cache = (
        "gold_336_v1",
        "mapa_calor_publico_v2",
        mapa_id,
        tipo,
        lado,
        compra,
        tempo_inicio_ms,
        tempo_fim_ms,
        page,
        page_size,
        torneio_id,
        time_id,
        jogador_id,
        inicio,
        fim,
    )

    resposta_cache = obter_cache(chave_cache)

    if resposta_cache is not None:
        logging.getLogger("uvicorn.error").info(
            "Calor mapa: cache HIT"
        )
        return resposta_cache

    logging.getLogger("uvicorn.error").info(
        "Calor mapa: cache MISS"
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
                "tipo", "STRING", tipo
            ),
            bigquery.ScalarQueryParameter("lado", "STRING", lado),
            bigquery.ScalarQueryParameter("compra", "STRING", compra),
            bigquery.ScalarQueryParameter("tempo_inicio_ms", "INT64", tempo_inicio_ms),
            bigquery.ScalarQueryParameter("tempo_fim_ms", "INT64", tempo_fim_ms),
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
                MAPA_CALOR_SQL,
                job_config=config,
            ).result(timeout=30)

            resultado = next(iter(rows), None)

            if resultado is None:
                raise ApiError(
                    404,
                    "NOT_FOUND",
                    "Mapa não encontrado.",
                )

            resposta = {
                "data": converter_resultado(resultado["pontos"]),
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": resultado["total"],
                },
                "meta": {
                    "atualizado_em": None,
                    "eventos_elegiveis": resultado[
                        "eventos_elegiveis"
                    ],
                    "pontos_excluidos": resultado[
                        "pontos_excluidos"
                    ],
                    "transformacao_disponivel": resultado[
                        "transformacao_disponivel"
                    ],
                },
            }

        salvar_cache(chave_cache, resposta)
        return resposta

    except ApiError:
        raise

    except Exception:
        logging.exception("Falha ao consultar calor do mapa")
        raise ApiError(
            503,
            "DATA_UNAVAILABLE",
            "Mapa de calor temporariamente indisponível.",
        )