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
from app.validacoes import (
    validar_identificadores,
    validar_parametros,
    validar_periodo,
)

router = APIRouter()

RANKING_SQL = carregar_sql("ranking.sql")
RANKING_TOTAL_SQL = carregar_sql("ranking_total.sql")
RANKING_FILTRADO_SQL = carregar_sql("ranking_filtrado.sql")


@router.get("/api/stats/ranking")
@coordenar_consultas
def ranking(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    ordem: Literal["kills_desc", "kd_desc", "adr_desc"] = "kills_desc",
    mapa_id: str | None = None,
    agente_id: str | None = None,
    time_id: str | None = None,
    torneio_id: str | None = None,
    data_inicio: str | None = None,
    data_fim: str | None = None,
):
    validar_parametros(
        request,
        {
            "page",
            "page_size",
            "ordem",
            "mapa_id",
            "agente_id",
            "time_id",
            "torneio_id",
            "data_inicio",
            "data_fim",
        },
    )

    filtros_ids = {
        "mapa_id": mapa_id,
        "agente_id": agente_id,
        "time_id": time_id,
        "torneio_id": torneio_id,
    }

    validar_identificadores(filtros_ids)
    inicio, fim = validar_periodo(data_inicio, data_fim)

    chave_cache = (
        "gold_336_v1",
        "ranking_publico_v2",
        page,
        page_size,
        ordem,
        mapa_id,
        agente_id,
        time_id,
        torneio_id,
        inicio,
        fim,
    )

    resposta_cache = obter_cache(chave_cache)

    if resposta_cache is not None:
        logging.getLogger("uvicorn.error").info(
            "Ranking: cache HIT"
        )
        return resposta_cache

    logging.getLogger("uvicorn.error").info(
        "Ranking: cache MISS"
    )

    tem_filtros = any(
        valor is not None
        for valor in [*filtros_ids.values(), inicio, fim]
    )

    parametros = [
        bigquery.ScalarQueryParameter(
            "limite", "INT64", page_size
        ),
        bigquery.ScalarQueryParameter(
            "deslocamento", "INT64", (page - 1) * page_size
        ),
    ]

    if tem_filtros:
        parametros.extend(
            bigquery.ScalarQueryParameter(campo, "STRING", valor)
            for campo, valor in filtros_ids.items()
        )
        parametros.extend(
            [
                bigquery.ScalarQueryParameter(
                    "data_inicio", "DATE", inicio
                ),
                bigquery.ScalarQueryParameter(
                    "data_fim", "DATE", fim
                ),
            ]
        )

    ordenacoes = {
        "kills_desc": "kills DESC NULLS LAST, jogador_id",
        "kd_desc": "kd DESC NULLS LAST, jogador_id",
        "adr_desc": "adr DESC NULLS LAST, jogador_id",
    }

    sql_base = (
        RANKING_FILTRADO_SQL if tem_filtros else RANKING_SQL
    )

    sql = sql_base.replace(
        "ORDER BY kills DESC NULLS LAST, jogador_id",
        f"ORDER BY {ordenacoes[ordem]}",
    )

    try:
        config = bigquery.QueryJobConfig(
            maximum_bytes_billed=MAXIMUM_BYTES_BILLED,
            query_parameters=parametros,
        )

        with conexao_bigquery() as client:
            if tem_filtros:
                rows = client.query(
                    sql,
                    job_config=config,
                ).result(timeout=30)

                resultado = next(iter(rows))
                data = converter_resultado(resultado.jogadores)
                total = resultado.total

            else:
                rows = client.query(
                    sql,
                    job_config=config,
                ).result(timeout=30)

                data = [
                    converter_resultado(row)
                    for row in rows
                ]

                total_rows = client.query(
                    RANKING_TOTAL_SQL,
                    job_config=bigquery.QueryJobConfig(
                        maximum_bytes_billed=MAXIMUM_BYTES_BILLED,
                    ),
                ).result(timeout=30)

                total = next(iter(total_rows)).total

        resposta = {
            "data": data,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
            },
            "meta": {"atualizado_em": None},
        }

        salvar_cache(chave_cache, resposta)
        return resposta

    except ApiError:
        raise

    except Exception:
        logging.exception("Falha ao consultar ranking")
        raise ApiError(
            503,
            "DATA_UNAVAILABLE",
            "Ranking temporariamente indisponível.",
        )
