"""Configuração do coach por variável de ambiente.

Os nomes das tabelas gold vêm daqui, nunca do modelo. Para apontar para outra
versão das tabelas, use COACH_GOLD_PREFIXO (ou sobrescreva uma tabela só com
COACH_TABELA_<NOME>, por exemplo COACH_TABELA_STATS_TIME).
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

# Base do link da prancheta devolvido por abrir_na_prancheta. O front fica em
# datropa.web.app; devs.datropa.com ainda não tem DNS (infra/README.md, dívida técnica).
# Quando o domínio subir, troque aqui ou passe COACH_FRONT_URL no deploy.
FRONT_URL = os.environ.get("COACH_FRONT_URL", "https://datropa.web.app").rstrip("/")

# Quantas rodadas de tool o agente pode fazer numa pergunta.
MAX_PASSOS = int(os.environ.get("COACH_MAX_PASSOS", "6"))

# HTTP
FIREBASE_PROJETO = os.environ.get("COACH_FIREBASE_PROJETO", PROJETO)
# Só para rodar local sem login. Ignorado no Cloud Run (K_SERVICE definido).
AUTH_DESLIGADA = os.environ.get("COACH_AUTH_DESLIGADA") == "1" and not os.environ.get("K_SERVICE")
CORS_ORIGENS = [o for o in os.environ.get("COACH_CORS_ORIGENS", "").split(",") if o]
MAX_CARACTERES_PERGUNTA = 1000
MAX_TURNOS_HISTORICO = 10
# Perguntas por usuário por janela, por instância. Protege a cota do Gemini e do BigQuery.
LIMITE_PERGUNTAS = int(os.environ.get("COACH_LIMITE_PERGUNTAS", "20"))
JANELA_LIMITE_S = int(os.environ.get("COACH_JANELA_LIMITE_S", "600"))
# Cota diária (dia de São Paulo), antes de chamar o Gemini. Segura o orçamento do projeto.
LIMITE_DIARIO_USUARIO = int(os.environ.get("COACH_LIMITE_DIARIO_USUARIO", "20"))
LIMITE_DIARIO_GLOBAL = int(os.environ.get("COACH_LIMITE_DIARIO_GLOBAL", "500"))
# 1 guarda os contadores no Firestore (vale para todas as instâncias). Exige
# roles/datastore.user na sa-coach. Desligado: contador em memória, por instância.
LIMITE_FIRESTORE = os.environ.get("COACH_LIMITE_FIRESTORE") == "1"

_IDENT =re.compile(r"^[A-Za-z0-9_\-]+$")


def tabela(nome: str) -> str:
    """Nome completo `projeto.dataset.tabela` de uma tabela gold."""
    final = os.environ.get(f"COACH_TABELA_{nome.upper()}", f"{GOLD_PREFIXO}{nome}")
    for parte in (PROJETO, DATASET, final):
        if not _IDENT.match(parte):
            raise ValueError(f"identificador inválido na configuração: {parte!r}")
    return f"`{PROJETO}.{DATASET}.{final}`"
