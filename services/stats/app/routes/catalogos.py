import json
import logging
from pathlib import Path

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
from app.validacoes import validar_parametros

router = APIRouter()

CATALOGOS_SQL = carregar_sql("catalogos.sql")
PASTA_CATALOGOS = Path(__file__).resolve().parent.parent / "catalogos"

CATALOGOS_JSON = {
    nome: json.dumps(
        json.loads(
            (PASTA_CATALOGOS / f"{nome}.json").read_text(
                encoding="utf-8"
            )
        ),
        ensure_ascii=False,
    )
    for nome in ("torneios", "agentes", "armas", "armaduras")
}


@router.get("/api/stats/catalogos")
@coordenar_consultas
def listar_catalogos(request: Request):
    validar_parametros(request, set())

    chave_cache = (
        "gold_336_v1",
        "catalogos_publico_v2",
        *sorted(CATALOGOS_JSON.items()),
    )

    resposta_cache = obter_cache(chave_cache)

    if resposta_cache is not None:
        logging.getLogger("uvicorn.error").info(
            "Catalogos: cache HIT"
        )
        return resposta_cache

    logging.getLogger("uvicorn.error").info(
        "Catalogos: cache MISS"
    )

    config = bigquery.QueryJobConfig(
        maximum_bytes_billed=MAXIMUM_BYTES_BILLED,
        query_parameters=[
            bigquery.ScalarQueryParameter(
                f"{nome}_json", "STRING", conteudo
            )
            for nome, conteudo in CATALOGOS_JSON.items()
        ],
    )

    try:
        with conexao_bigquery() as client:
            rows = client.query(
                CATALOGOS_SQL,
                job_config=config,
            ).result(timeout=30)

            resultado = next(iter(rows))

            resposta = {
                "data": converter_resultado(resultado),
                "meta": {"atualizado_em": None},
            }

        salvar_cache(chave_cache, resposta)
        return resposta

    except ApiError:
        raise

    except Exception:
        logging.exception("Falha ao consultar catalogos")
        raise ApiError(
            503,
            "DATA_UNAVAILABLE",
            "Catálogos temporariamente indisponíveis.",
        )