import json
import logging
from pathlib import Path

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

AGENTES_LISTA_SQL = carregar_sql("agentes_lista.sql")

CATALOGO_PATH = (
    Path(__file__).resolve().parent.parent
    / "catalogos"
    / "agentes.json"
)

CATALOGO = json.loads(
    CATALOGO_PATH.read_text(encoding="utf-8")
)

CATALOGO_JSON = json.dumps(CATALOGO, ensure_ascii=False)


@router.get("/api/stats/agentes")
@coordenar_consultas
def listar_agentes(
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
        "agentes_lista_publico_v1",
        CATALOGO_JSON,
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
            "Lista agentes: cache HIT"
        )
        return resposta_cache

    logging.getLogger("uvicorn.error").info(
        "Lista agentes: cache MISS"
    )

    config = bigquery.QueryJobConfig(
        maximum_bytes_billed=MAXIMUM_BYTES_BILLED,
        query_parameters=[
            bigquery.ScalarQueryParameter(
                "catalogo_json", "STRING", CATALOGO_JSON
            ),
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
                AGENTES_LISTA_SQL,
                job_config=config,
            ).result(timeout=30)

            resultado = next(iter(rows))

            resposta = {
                "data": converter_resultado(resultado["agentes"]),
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
        logging.exception("Falha ao consultar agentes")
        raise ApiError(
            503,
            "DATA_UNAVAILABLE",
            "Agentes temporariamente indisponíveis.",
        )
        