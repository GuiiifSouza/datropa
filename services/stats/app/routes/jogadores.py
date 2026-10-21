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

JOGADOR_DETALHE_SQL = carregar_sql("jogador_detalhe.sql")


@router.get("/api/stats/jogadores/{jogador_id}")
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

    try:
        with conexao_bigquery() as client:
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
