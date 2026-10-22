"""Loop do agente: Gemini no Vertex AI com function calling manual.

O loop é nosso (não o automático do SDK) para limitar passos, registrar cada
chamada de tool e devolver o rastro junto com a resposta.
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

import httpx
from google import genai
from google.genai import errors, types

from . import config
from .prompt import SISTEMA
from .tools import REGISTRO

log = logging.getLogger("coach.agente")

# Falha passageira do Vertex: conexão keep-alive fechada pelo servidor (o SDK não
# repete RemoteProtocolError; aconteceu no teste real de 22/10) ou 429/5xx.
TENTATIVAS = 3
_CODIGOS_TRANSITORIOS = {408, 429, 500, 502, 503, 504}

# Resposta com número sem nenhuma tool chamada na pergunta: o modelo inventou
# (teste real de 22/10: "100% de vitória em 3 partidas" sem consultar nada).
_NUMERO = re.compile(r"\d")
COBRANCA = ("Sua resposta citou números sem consultar nenhuma tool nesta pergunta. "
            "Consulte as tools antes de responder e cite só o que elas devolverem.")


def _transitorio(e: Exception) -> bool:
    if isinstance(e, httpx.TransportError):
        return True
    return isinstance(e, errors.APIError) and e.code in _CODIGOS_TRANSITORIOS


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

    def _gerar(self) -> types.GenerateContentResponse:
        for tentativa in range(1, TENTATIVAS + 1):
            try:
                return cliente().models.generate_content(
                    model=config.MODELO, contents=self.historico, config=self._config
                )
            except Exception as e:
                if tentativa == TENTATIVAS or not _transitorio(e):
                    raise
                log.warning("Vertex falhou (%s), tentativa %d de %d", type(e).__name__, tentativa, TENTATIVAS)
                time.sleep(0.5 * tentativa)
        raise AssertionError("inalcançável")

    def perguntar(self, pergunta: str) -> Resposta:
        self.historico.append(types.Content(role="user", parts=[types.Part.from_text(text=pergunta)]))
        chamadas: list[ChamadaTool] = []
        cobranca: int | None = None  # posição no histórico da resposta sem tool que foi cobrada

        for _ in range(config.MAX_PASSOS):
            resp = self._gerar()
            conteudo = resp.candidates[0].content if resp.candidates else None
            if conteudo is None:
                return self._fim("Não consegui gerar uma resposta agora. Tente de novo.", chamadas)
            self.historico.append(conteudo)

            pedidos = resp.function_calls or []
            if not pedidos:
                texto = (resp.text or "").strip()
                if not chamadas and cobranca is None and _NUMERO.search(texto):
                    log.warning("resposta com número sem tool; cobrando consulta")
                    cobranca = len(self.historico) - 1
                    self.historico.append(types.Content(role="user", parts=[types.Part.from_text(text=COBRANCA)]))
                    continue
                if cobranca is not None:
                    # Tira do histórico a resposta inventada e a cobrança.
                    del self.historico[cobranca:cobranca + 2]
                    if not chamadas and _NUMERO.search(texto):
                        self.historico.pop()
                        return self._fim("Não consegui consultar os dados para responder com números. "
                                         "Tente perguntar de outro jeito, citando o time ou o jogador.", chamadas)
                return Resposta(texto=texto, chamadas=chamadas)

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
