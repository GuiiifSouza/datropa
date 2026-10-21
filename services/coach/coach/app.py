"""Rota HTTP do coach (FastAPI). Atrás do rewrite `/api/coach/**` do Firebase Hosting.

    POST /api/coach/perguntar
    Authorization: Bearer <ID token do Firebase>
    {"pergunta": "como joga o time Turuna?", "historico": [{"papel": "usuario", "texto": "..."}]}

Envelope e erros seguem docs/api.md.
"""

from __future__ import annotations

import logging
import threading
import time
from collections import defaultdict, deque
from typing import Literal

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import auth, config

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
log = logging.getLogger("coach.app")

app = FastAPI(title="coach", docs_url=None, redoc_url=None, openapi_url=None)
if config.CORS_ORIGENS:
    app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGENS,
                       allow_methods=["POST"], allow_headers=["Authorization", "Content-Type"])


class ErroApi(Exception):
    def __init__(self, status: int, code: str, message: str, details: dict | None = None,
                 headers: dict | None = None):
        self.status, self.code, self.message = status, code, message
        self.details, self.headers = details or {}, headers


def _erro(status: int, code: str, message: str, details: dict | None = None, headers=None):
    return JSONResponse(status_code=status, headers=headers,
                        content={"error": {"code": code, "message": message, "details": details or {}}})


@app.exception_handler(ErroApi)
async def _erro_api(_: Request, e: ErroApi):
    return _erro(e.status, e.code, e.message, e.details, e.headers)


@app.exception_handler(RequestValidationError)
async def _erro_validacao(_: Request, e: RequestValidationError):
    primeiro = e.errors()[0] if e.errors() else {}
    campo = ".".join(str(p) for p in primeiro.get("loc", [])[1:])
    return _erro(400, "INVALID_ARGUMENT", primeiro.get("msg", "requisição inválida"), {"field": campo})


@app.exception_handler(StarletteHTTPException)
async def _erro_http(_: Request, e: StarletteHTTPException):
    codigos = {404: "NOT_FOUND", 405: "INVALID_ARGUMENT"}
    return _erro(e.status_code, codigos.get(e.status_code, "INTERNAL"), str(e.detail))


@app.exception_handler(Exception)
async def _erro_inesperado(_: Request, e: Exception):
    log.exception("erro inesperado")
    return _erro(500, "INTERNAL", "falha inesperada")


def usuario(request: Request) -> str:
    """Valida o JWT do Firebase e devolve o uid."""
    if config.AUTH_DESLIGADA:
        return "local"
    cabecalho = request.headers.get("Authorization", "")
    if not cabecalho.startswith("Bearer "):
        raise ErroApi(401, "UNAUTHENTICATED", "token ausente")
    try:
        claims = auth.validar(cabecalho.removeprefix("Bearer ").strip())
    except auth.TokenInvalido:
        raise ErroApi(401, "UNAUTHENTICATED", "token inválido ou expirado") from None
    return claims["sub"]


class _Limite:
    """Janela deslizante por usuário, em memória (por instância do Cloud Run)."""

    def __init__(self):
        self._marcas: dict[str, deque[float]] = defaultdict(deque)
        self._trava = threading.Lock()

    def conferir(self, uid: str) -> None:
        agora = time.monotonic()
        with self._trava:
            fila = self._marcas[uid]
            while fila and agora - fila[0] > config.JANELA_LIMITE_S:
                fila.popleft()
            if len(fila) >= config.LIMITE_PERGUNTAS:
                espera = int(config.JANELA_LIMITE_S - (agora - fila[0])) + 1
                raise ErroApi(429, "RATE_LIMITED", "muitas perguntas; espere um pouco",
                              headers={"Retry-After": str(espera)})
            fila.append(agora)


limite = _Limite()


class Turno(BaseModel):
    model_config = ConfigDict(extra="forbid")
    papel: Literal["usuario", "coach"]
    texto: str = Field(min_length=1, max_length=4000)


class Pedido(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pergunta: str = Field(min_length=1, max_length=config.MAX_CARACTERES_PERGUNTA)
    historico: list[Turno] = Field(default_factory=list, max_length=2 * config.MAX_TURNOS_HISTORICO)


@app.post("/api/coach/perguntar")
def perguntar(pedido: Pedido, uid: str = Depends(usuario)):
    # Import tardio: o cliente do Gemini só sobe quando a primeira pergunta chega.
    from .agente import Conversa

    if not pedido.pergunta.strip():
        raise ErroApi(400, "INVALID_ARGUMENT", "pergunta vazia", {"field": "pergunta"})
    limite.conferir(uid)

    inicio = time.monotonic()
    conversa = Conversa([(t.papel, t.texto) for t in pedido.historico])
    try:
        resp = conversa.perguntar(pedido.pergunta.strip())
    except Exception:
        log.exception("falha no agente")
        raise ErroApi(503, "DATA_UNAVAILABLE", "o coach não conseguiu responder agora; tente de novo") from None
    log.info("pergunta uid=%s tools=%s ms=%d", uid, [c.nome for c in resp.chamadas],
             (time.monotonic() - inicio) * 1000)

    return {
        "data": {
            "resposta": resp.texto,
            "tools": [{"nome": c.nome, "argumentos": c.argumentos, "resultado": c.resultado}
                      for c in resp.chamadas],
        },
        "meta": {"modelo": config.MODELO, "atualizado_em": None},
    }
