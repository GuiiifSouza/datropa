"""Loop do agente: Gemini no Vertex AI com function calling manual.

O loop é nosso (não o automático do SDK) para limitar passos, registrar cada
chamada de tool e devolver o rastro junto com a resposta.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

from google import genai
from google.genai import types

from . import config
from .prompt import SISTEMA
from .tools import REGISTRO

log = logging.getLogger("coach.agente")


@dataclass
class ChamadaTool:
    nome: str
    argumentos: dict[str, Any]
    resultado: dict[str, Any]


@dataclass
class Resposta:
    texto: str
    chamadas: list[ChamadaTool] = field(default_factory=list)


@lru_cache(maxsize=1)
def cliente() -> genai.Client:
    return genai.Client(vertexai=True, project=config.PROJETO, location=config.REGIAO)


def _config() -> types.GenerateContentConfig:
    declaracoes = [
        types.FunctionDeclaration(name=t.nome, description=t.descricao, parameters_json_schema=t.parametros)
        for t in REGISTRO.values()
    ]
    return types.GenerateContentConfig(
        system_instruction=SISTEMA,
        tools=[types.Tool(function_declarations=declaracoes)],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        temperature=0.2,
    )


class Conversa:
    """Uma conversa com histórico. Cada `perguntar` pode chamar várias tools."""

    def __init__(self, turnos: list[tuple[str, str]] | None = None):
        """`turnos`: conversa anterior em texto, [("usuario"|"coach", texto), ...].

        Na rota HTTP o cliente manda o histórico; os resultados de tool não
        vêm junto, então o agente consulta de novo se precisar de número.
        """
        self.historico: list[types.Content] = [
            types.Content(role="user" if papel == "usuario" else "model",
                          parts=[types.Part.from_text(text=texto)])
            for papel, texto in (turnos or [])
        ]
        self._config = _config()

    def perguntar(self, pergunta: str) -> Resposta:
        self.historico.append(types.Content(role="user", parts=[types.Part.from_text(text=pergunta)]))
        chamadas: list[ChamadaTool] = []

        for _ in range(config.MAX_PASSOS):
            resp = cliente().models.generate_content(
                model=config.MODELO, contents=self.historico, config=self._config
            )
            conteudo = resp.candidates[0].content if resp.candidates else None
            if conteudo is None:
                return self._fim("Não consegui gerar uma resposta agora. Tente de novo.", chamadas)
            self.historico.append(conteudo)

            pedidos = resp.function_calls or []
            if not pedidos:
                return Resposta(texto=(resp.text or "").strip(), chamadas=chamadas)

            partes = []
            for fc in pedidos:
                args = dict(fc.args or {})
                tool = REGISTRO.get(fc.name)
                resultado = tool.executar(args) if tool else {"erro": f"tool inexistente: {fc.name}"}
                log.info("tool %s %s -> %s", fc.name, json.dumps(args, ensure_ascii=False),
                         "erro" if "erro" in resultado else "ok")
                chamadas.append(ChamadaTool(fc.name, args, resultado))
                partes.append(types.Part.from_function_response(name=fc.name, response={"resultado": resultado}))
            self.historico.append(types.Content(role="user", parts=partes))

        return self._fim("Precisei de consultas demais para essa pergunta. Tente ser mais específico.", chamadas)

    def _fim(self, texto: str, chamadas: list[ChamadaTool]) -> Resposta:
        self.historico.append(types.Content(role="model", parts=[types.Part.from_text(text=texto)]))
        return Resposta(texto=texto, chamadas=chamadas)


def perguntar(pergunta: str) -> Resposta:
    """Pergunta avulsa, sem histórico."""
    return Conversa().perguntar(pergunta)
