"""Cronômetros opcionais, sem registrar perguntas, tokens ou resultados das tools.

O contexto é isolado por requisição. Tempos de tools incluem os de BigQuery;
não somar camadas diferentes para calcular o total.
"""
from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
import time
import uuid


_atual: ContextVar[Medicao | None] = ContextVar('coach_medicao', default=None)


@dataclass
class Medicao:
    origem: str
    id: str = field(default_factory=lambda: uuid.uuid4().hex)
    eventos: list[dict] = field(default_factory=list)
    inicio: float = field(default_factory=time.perf_counter)
    total_ms: float | None = None

    def relatorio(self) -> dict:
        return {'id': self.id, 'origem': self.origem, 'total_ms': self.total_ms,
                'eventos': sorted(self.eventos, key=lambda e: e['inicio_ms'])}


@contextmanager
def sessao(origem: str):
    m = Medicao(origem)
    token = _atual.set(m)
    try:
        yield m
    finally:
        m.total_ms = round((time.perf_counter() - m.inicio) * 1000, 3)
        _atual.reset(token)


@contextmanager
def medir(tipo: str, nome: str, **metadados):
    m = _atual.get()
    if m is None:
        yield {}
        return
    inicio = time.perf_counter()
    evento = {'tipo': tipo, 'nome': nome,
              'inicio_ms': round((inicio - m.inicio) * 1000, 3),
              'status': 'ok', **metadados}
    try:
        yield evento
    except BaseException:
        evento['status'] = 'erro'
        raise
    finally:
        evento['ms'] = round((time.perf_counter() - inicio) * 1000, 3)
        m.eventos.append(evento)
