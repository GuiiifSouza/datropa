"""Configuração do coach por variável de ambiente.

Os nomes das tabelas gold vêm daqui, nunca do modelo. Para apontar para as
tabelas de teste do chico, use COACH_GOLD_PREFIXO=chico_teste_ (ou sobrescreva
uma tabela só com COACH_TABELA_<NOME>, por exemplo COACH_TABELA_STATS_TIME).
"""

import os
import re

PROJETO = os.environ.get("COACH_PROJETO", "datropa")
REGIAO = os.environ.get("COACH_REGIAO", "southamerica-east1")
MODELO = os.environ.get("COACH_MODELO", "gemini-2.5-flash")
DATASET = os.environ.get("COACH_DATASET", "valorant")
GOLD_PREFIXO = os.environ.get("COACH_GOLD_PREFIXO", "")

# Limite por consulta. As tabelas gold têm poucos MB; 200 MB dá folga sem
# deixar uma consulta errada varrer a cota de 100 GiB/dia.
MAX_BYTES_BILLED = int(os.environ.get("COACH_MAX_BYTES_BILLED", str(200 * 1024**2)))

# Quantas rodadas de tool o agente pode fazer numa pergunta.
MAX_PASSOS = int(os.environ.get("COACH_MAX_PASSOS", "6"))

_IDENT = re.compile(r"^[A-Za-z0-9_\-]+$")


def tabela(nome: str) -> str:
    """Nome completo `projeto.dataset.tabela` de uma tabela gold."""
    final = os.environ.get(f"COACH_TABELA_{nome.upper()}", f"{GOLD_PREFIXO}{nome}")
    for parte in (PROJETO, DATASET, final):
        if not _IDENT.match(parte):
            raise ValueError(f"identificador inválido na configuração: {parte!r}")
    return f"`{PROJETO}.{DATASET}.{final}`"
