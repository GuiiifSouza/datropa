"""Configuração do ingest por variável de ambiente. O padrão é o de produção."""

import os

PROJETO = os.environ.get("INGEST_PROJETO", "datropa")
REGIAO = os.environ.get("INGEST_REGIAO", "southamerica-east1")
BUCKET = os.environ.get("INGEST_BUCKET", "datropa-raw-matches")
# Só o que estiver debaixo deste prefixo vira linha no bronze. O gatilho também
# dispara para o NDJSON da carga manual em `bronze/`.
PREFIXO = os.environ.get("INGEST_PREFIXO", "partidas/")
DATASET = os.environ.get("INGEST_DATASET", "valorant")
TABELA = os.environ.get("INGEST_TABELA", "bronze_partidas")

# Teto da consulta que confere se o arquivo já entrou. Ela lê só três colunas
# (_arquivo, _pasta, matchInfo.matchId); 100 MB dá muita folga.
MAX_BYTES_BILLED = int(os.environ.get("INGEST_MAX_BYTES_BILLED", str(100 * 1024**2)))
# Arquivo de partida tem cerca de 0,6 MB. Acima disto é recusado, para não
# estourar a memória do container e ficar em loop de retry.
MAX_BYTES_ARQUIVO = int(os.environ.get("INGEST_MAX_BYTES_ARQUIVO", str(50 * 1024**2)))
# Quanto esperar o load job terminar antes de devolver erro (e o Eventarc tentar de novo).
TIMEOUT_LOAD_S = int(os.environ.get("INGEST_TIMEOUT_LOAD_S", "240"))


def tabela() -> str:
    return f"{PROJETO}.{DATASET}.{TABELA}"
