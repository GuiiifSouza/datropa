"""Registro das tools do coach.

Para criar uma tool nova:
1. crie um módulo nesta pasta com as `Consulta`s (coach/bq.py) e uma função
   decorada com `@tool(...)`, que recebe os parâmetros e devolve um dict;
2. importe o módulo no fim deste arquivo.

O agente só enxerga o que está em REGISTRO. `consulta_livre` não existe aqui
de propósito: fica desligada.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Callable

log = logging.getLogger("coach.tools")


class ErroTool(Exception):
    """Erro esperado (entidade não achada, parâmetro inválido). Vai para o modelo."""


@dataclass
class Tool:
    nome: str
    descricao: str
    parametros: dict[str, Any]  # JSON Schema dos argumentos
    funcao: Callable[..., dict[str, Any]]

    def executar(self, argumentos: dict[str, Any]) -> dict[str, Any]:
        permitidos = set(self.parametros.get("properties", {}))
        extras = set(argumentos) - permitidos
        if extras:
            return {"erro": f"parâmetros desconhecidos: {sorted(extras)}"}
        faltando = set(self.parametros.get("required", [])) - set(argumentos)
        if faltando:
            return {"erro": f"parâmetros obrigatórios ausentes: {sorted(faltando)}"}
        try:
            return self.funcao(**argumentos)
        except ErroTool as e:
            return {"erro": str(e)}
        except Exception:
            log.exception("falha na tool %s", self.nome)
            return {"erro": "falha ao consultar os dados; tente de novo ou reformule"}


REGISTRO: dict[str, Tool] = {}


def tool(nome: str, descricao: str, parametros: dict[str, Any]):
    def registrar(funcao: Callable[..., dict[str, Any]]):
        REGISTRO[nome] = Tool(nome, descricao, parametros, funcao)
        return funcao

    return registrar


# Tools ligadas. Ordem não importa.
from . import buscar_entidade, stats_jogador, stats_time  # noqa: E402,F401
