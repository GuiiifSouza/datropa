"""Resolve time_id e jogador_id tolerando erro de cópia do modelo.

Os ids da gold são longos (time_ + 64 hex, puuid de 78 caracteres) e o Gemini às
vezes troca um caractere ao copiar (teste real de 21/10/2026: `ada5` virou `ada4`).
Antes de consultar, cada tool passa o id por aqui:
- id exato: segue igual;
- prefixo com 12+ caracteres, ou até 2 caracteres de diferença num id longo:
  vira o id real, se só um bater;
- nada ou mais de um: ErroTool, e o modelo volta para buscar_entidade.

A lista de ids vem da gold (consultas pequenas) e fica em cache por 10 minutos.
"""

from __future__ import annotations

import logging
import threading
import time

from ..bq import Consulta
from . import ErroTool

log = logging.getLogger("coach.ids")

TTL_S = 600
# Abaixo disso não há correção aproximada: id curto com 2 trocas vira outro id.
MIN_APROXIMADO = 20
MIN_PREFIXO = 12
MAX_DIFERENCA = 2

TIMES = Consulta(
    nome="ids.times",
    tipos={},
    sql=lambda t: f"SELECT DISTINCT time_id AS id FROM {t('stats_time')} WHERE escopo = 'geral'",
)

JOGADORES = Consulta(
    nome="ids.jogadores",
    tipos={},
    sql=lambda t: f"SELECT DISTINCT jogador_id AS id FROM {t('ranking_jogador')}",
)

_cache: dict[str, tuple[float, frozenset[str]]] = {}
_trava = threading.Lock()


def limpar_cache() -> None:
    with _trava:
        _cache.clear()


def _ids(consulta: Consulta) -> frozenset[str]:
    with _trava:
        guardado = _cache.get(consulta.nome)
        if guardado and time.monotonic() - guardado[0] < TTL_S:
            return guardado[1]
    ids = frozenset(l["id"] for l in consulta.rodar() if l["id"])
    with _trava:
        _cache[consulta.nome] = (time.monotonic(), ids)
    return ids


def _distancia(a: str, b: str, limite: int) -> int:
    """Levenshtein com corte: devolve limite + 1 se passar do limite."""
    if abs(len(a) - len(b)) > limite:
        return limite + 1
    if len(a) == len(b):
        diferencas = sum(x != y for x, y in zip(a, b))
        if diferencas <= limite:
            return diferencas
    anterior = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        atual = [i] + [0] * len(b)
        for j, cb in enumerate(b, 1):
            atual[j] = min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (ca != cb))
        if min(atual) > limite:
            return limite + 1
        anterior = atual
    return anterior[-1]


def _resolver(valor: str, consulta: Consulta, tipo: str) -> str:
    valor = (valor or "").strip()
    if not valor:
        raise ErroTool(f"{tipo}_id vazio; use buscar_entidade")
    ids = _ids(consulta)
    if valor in ids:
        return valor
    candidatos = set()
    if len(valor) >= MIN_PREFIXO:
        candidatos |= {i for i in ids if i.startswith(valor)}
    if len(valor) >= MIN_APROXIMADO:
        candidatos |= {i for i in ids if _distancia(valor, i, MAX_DIFERENCA) <= MAX_DIFERENCA}
    if len(candidatos) == 1:
        certo = candidatos.pop()
        log.warning("%s_id corrigido: %s -> %s", tipo, valor, certo)
        return certo
    if candidatos:
        raise ErroTool(f"{tipo}_id ambíguo; copie o id exato de buscar_entidade")
    raise ErroTool(f"{tipo} não encontrado (confira o id com buscar_entidade)")


def resolver_time(time_id: str) -> str:
    return _resolver(time_id, TIMES, "time")


def resolver_jogador(jogador_id: str) -> str:
    return _resolver(jogador_id, JOGADORES, "jogador")
