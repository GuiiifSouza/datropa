import logging
import re
from datetime import date
from pathlib import Path
from threading import BoundedSemaphore
from typing import Literal

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from google.cloud import bigquery

from app.cache import (
    coordenar_consultas,
    obter_cache,
    salvar_cache,
)

app = FastAPI(
    title="DA TROPA — API de estatísticas",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

MAXIMUM_BYTES_BILLED = 1073741824
CONSULTAS_SIMULTANEAS = BoundedSemaphore(4)
QUERIES_DIR = Path(__file__).resolve().parent.parent / "queries"

RANKING_SQL = (QUERIES_DIR / "ranking.sql").read_text(
    encoding="utf-8"
)

RANKING_TOTAL_SQL = (QUERIES_DIR / "ranking_total.sql").read_text(
    encoding="utf-8"
)

RANKING_FILTRADO_SQL = (
    QUERIES_DIR / "ranking_filtrado.sql"
).read_text(encoding="utf-8")

JOGADOR_DETALHE_SQL = (
    QUERIES_DIR / "jogador_detalhe.sql"
).read_text(encoding="utf-8")


class ApiError(Exception):
    def __init__(self, status, code, message, field=None):
        self.status = status
        self.code = code
        self.message = message
        self.field = field


@app.exception_handler(ApiError)
async def tratar_erro(request, exc):
    return JSONResponse(
        status_code=exc.status,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": (
                    {"field": exc.field} if exc.field else {}
                ),
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def tratar_parametro_invalido(request, exc):
    erro = exc.errors()[0]
    campo = str(erro["loc"][-1])

    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "INVALID_ARGUMENT",
                "message": f"Valor inválido para {campo}.",
                "details": {"field": campo},
            }
        },
    )


def validar_parametros(request, permitidos):
    for campo in request.query_params:
        if campo not in permitidos:
            raise ApiError(
                400,
                "INVALID_ARGUMENT",
                f"Parâmetro não suportado: {campo}.",
                campo,
            )

        if len(request.query_params.getlist(campo)) > 1:
            raise ApiError(
                400,
                "INVALID_ARGUMENT",
                f"Parâmetro repetido: {campo}.",
                campo,
            )


def validar_identificadores(identificadores):
    for campo, valor in identificadores.items():
        if valor is not None and (
            not valor.strip()
            or valor != valor.strip()
            or len(valor) > 256
        ):
            raise ApiError(
                400,
                "INVALID_ARGUMENT",
                f"Identificador inválido para {campo}.",
                campo,
            )


def validar_data(valor, campo):
    if valor is None:
        return None

    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", valor):
        raise ApiError(
            400,
            "INVALID_ARGUMENT",
            f"{campo} deve usar YYYY-MM-DD.",
            campo,
        )

    try:
        return date.fromisoformat(valor)
    except ValueError:
        raise ApiError(
            400,
            "INVALID_ARGUMENT",
            f"Data inválida para {campo}.",
            campo,
        )


def validar_periodo(data_inicio, data_fim):
    inicio = validar_data(data_inicio, "data_inicio")
    fim = validar_data(data_fim, "data_fim")

    if inicio is not None and fim is not None and inicio > fim:
        raise ApiError(
            400,
            "INVALID_ARGUMENT",
            "data_inicio não pode ser posterior a data_fim.",
            "data_inicio",
        )

    return inicio, fim


def converter_resultado(valor):
    if hasattr(valor, "items"):
        return {
            chave: converter_resultado(conteudo)
            for chave, conteudo in valor.items()
        }

    if isinstance(valor, (list, tuple)):
        return [converter_resultado(item) for item in valor]

    return valor


@app.get("/api/stats/status")
def status():
    return {
        "data": {"status": "ok"},
        "meta": {"atualizado_em": None},
    }


@app.get("/api/stats/ranking")
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
        "ranking_publico_v1",
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

    if not CONSULTAS_SIMULTANEAS.acquire(blocking=False):
        raise ApiError(
            503,
            "DATA_UNAVAILABLE",
            "Servidor ocupado. Tente novamente em alguns instantes.",
        )

    try:
        config = bigquery.QueryJobConfig(
            maximum_bytes_billed=MAXIMUM_BYTES_BILLED,
            query_parameters=parametros,
        )

        with bigquery.Client(
            project="datropa",
            location="southamerica-east1",
        ) as client:
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

    except Exception:
        logging.exception("Falha ao consultar ranking")
        raise ApiError(
            503,
            "DATA_UNAVAILABLE",
            "Ranking temporariamente indisponível.",
        )

    finally:
        CONSULTAS_SIMULTANEAS.release()


@app.get("/api/stats/jogadores/{jogador_id}")
@coordenar_consultas
def detalhe_jogador(
    request: Request,
    jogador_id: str,
    torneio_id: str | None = None,
    mapa_id: str | None = None,
    agente_id: str | None = None,
    data_inicio: str | None = None,
    data_fim: str | None = None,
):
    validar_parametros(
        request,
        {
            "torneio_id",
            "mapa_id",
            "agente_id",
            "data_inicio",
            "data_fim",
        },
    )

    identificadores = {
        "jogador_id": jogador_id,
        "torneio_id": torneio_id,
        "mapa_id": mapa_id,
        "agente_id": agente_id,
    }

    validar_identificadores(identificadores)
    inicio, fim = validar_periodo(data_inicio, data_fim)

    chave_cache = (
        "gold_336_v1",
        "jogador_detalhe_publico_v1",
        jogador_id,
        torneio_id,
        mapa_id,
        agente_id,
        inicio,
        fim,
    )

    resposta_cache = obter_cache(chave_cache)

    if resposta_cache is not None:
        logging.getLogger("uvicorn.error").info(
            "Detalhe jogador: cache HIT"
        )
        return resposta_cache

    logging.getLogger("uvicorn.error").info(
        "Detalhe jogador: cache MISS"
    )

    # O SQL do Chico recebe todos os parâmetros como STRING.
    valores = {
        **identificadores,
        "data_inicio": inicio.isoformat() if inicio else None,
        "data_fim": fim.isoformat() if fim else None,
    }

    config = bigquery.QueryJobConfig(
        maximum_bytes_billed=MAXIMUM_BYTES_BILLED,
        query_parameters=[
            bigquery.ScalarQueryParameter(campo, "STRING", valor)
            for campo, valor in valores.items()
        ],
    )

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
            rows = client.query(
                JOGADOR_DETALHE_SQL,
                job_config=config,
            ).result(timeout=30)

            jogador = next(iter(rows), None)

            if jogador is None:
                raise ApiError(
                    404,
                    "NOT_FOUND",
                    "Jogador não encontrado.",
                )

            resposta = {
                "data": converter_resultado(jogador),
                "meta": {"atualizado_em": None},
            }

        salvar_cache(chave_cache, resposta)
        return resposta

    except ApiError:
        raise

    except Exception:
        logging.exception(
            "Falha ao consultar detalhe do jogador"
        )
        raise ApiError(
            503,
            "DATA_UNAVAILABLE",
            "Dados do jogador temporariamente indisponíveis.",
        )
TIMES_LISTA_SQL = (
    QUERIES_DIR / "times_lista.sql"
).read_text(encoding="utf-8")


@app.get("/api/stats/times")
@coordenar_consultas
def listar_times(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    mapa_id: str | None = None,
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
            "torneio_id",
            "data_inicio",
            "data_fim",
        },
    )

    filtros_ids = {
        "mapa_id": mapa_id,
        "torneio_id": torneio_id,
    }

    validar_identificadores(filtros_ids)
    inicio, fim = validar_periodo(data_inicio, data_fim)

    chave_cache = (
        "gold_336_v1",
        "times_lista_publico_v1",
        page,
        page_size,
        mapa_id,
        torneio_id,
        inicio,
        fim,
    )

    resposta_cache = obter_cache(chave_cache)

    if resposta_cache is not None:
        logging.getLogger("uvicorn.error").info(
            "Lista times: cache HIT"
        )
        return resposta_cache

    logging.getLogger("uvicorn.error").info(
        "Lista times: cache MISS"
    )

    config = bigquery.QueryJobConfig(
        maximum_bytes_billed=MAXIMUM_BYTES_BILLED,
        query_parameters=[
            bigquery.ScalarQueryParameter(
                "mapa_id", "STRING", mapa_id
            ),
            bigquery.ScalarQueryParameter(
                "torneio_id", "STRING", torneio_id
            ),
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
            rows = client.query(
                TIMES_LISTA_SQL,
                job_config=config,
            ).result(timeout=30)

            resultado = next(iter(rows))

            resposta = {
                "data": converter_resultado(resultado["times"]),
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": resultado["total"],
                },
                "meta": {"atualizado_em": None},
            }

        salvar_cache(chave_cache, resposta)
        return resposta

    except Exception:
        logging.exception("Falha ao consultar lista de times")
        raise ApiError(
            503,
            "DATA_UNAVAILABLE",
            "Lista de times temporariamente indisponível.",
        )

    finally:
        CONSULTAS_SIMULTANEAS.release()