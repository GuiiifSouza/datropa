"""Acesso ao BigQuery: só consultas prontas, parametrizadas e com teto de bytes.

Toda consulta do coach é um objeto `Consulta` declarado num módulo de tool.
O SQL é escrito por gente; o modelo só escolhe a tool e os valores dos
parâmetros, que entram como query parameters (nunca concatenados no texto).
"""

from __future__ import annotations

import datetime as dt
import decimal
import math
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any, Callable

from google.cloud import bigquery

from . import config

# Todas as consultas declaradas, para o dry run listar.
CONSULTAS: dict[str, "Consulta"] = {}


@dataclass
class Consulta:
    nome: str
    # Recebe a função `tabela` e devolve o SQL. Assim o nome da tabela segue a
    # configuração (oficial ou chico_teste_) sem mexer no código da tool.
    sql: Callable[[Callable[[str], str]], str]
    # nome do parâmetro -> tipo do BigQuery (STRING, INT64, ...)
    tipos: dict[str, str]
    # Valores de exemplo para o dry run.
    exemplo: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        CONSULTAS[self.nome] = self

    def texto(self) -> str:
        sql = self.sql(config.tabela).strip()
        inicio = sql.lstrip("(").split(None, 1)[0].upper()
        if inicio not in ("SELECT", "WITH"):
            raise ValueError(f"{self.nome}: só SELECT é permitido")
        return sql

    def _job_config(self, valores: dict[str, Any], dry_run: bool) -> bigquery.QueryJobConfig:
        faltando = set(self.tipos) - set(valores)
        sobrando = set(valores) - set(self.tipos)
        if faltando or sobrando:
            raise ValueError(f"{self.nome}: parâmetros errados (faltando={faltando}, sobrando={sobrando})")
        return bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter(k, self.tipos[k], valores[k]) for k in self.tipos
            ],
            maximum_bytes_billed=config.MAX_BYTES_BILLED,
            dry_run=dry_run,
            use_query_cache=not dry_run,
            labels={"servico": "coach", "consulta": self.nome.replace(".", "_")},
        )

    def rodar(self, **valores) -> list[dict[str, Any]]:
        job = cliente().query(self.texto(), job_config=self._job_config(valores, False))
        return [_limpar(dict(linha)) for linha in job.result()]

    def dry_run(self, **valores) -> int:
        """Bytes que a consulta processaria, sem rodar nem cobrar."""
        valores = valores or self.exemplo
        job = cliente().query(self.texto(), job_config=self._job_config(valores, True))
        return job.total_bytes_processed


@lru_cache(maxsize=1)
def cliente() -> bigquery.Client:
    # Credenciais ADC: local é o `gcloud auth application-default login`,
    # no Cloud Run é a sa-coach.
    return bigquery.Client(project=config.PROJETO, location=config.REGIAO)


def _limpar(valor: Any) -> Any:
    """Deixa o resultado pronto para JSON e arredonda para o modelo citar."""
    if isinstance(valor, dict):
        return {k: _limpar(v) for k, v in valor.items()}
    if isinstance(valor, (list, tuple)):
        return [_limpar(v) for v in valor]
    if isinstance(valor, float):
        return None if math.isnan(valor) or math.isinf(valor) else round(valor, 2)
    if isinstance(valor, decimal.Decimal):
        return round(float(valor), 2)
    if isinstance(valor, (dt.datetime, dt.date)):
        return valor.isoformat()
    return valor
