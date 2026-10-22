from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError

from app.erros import ApiError, tratar_erro, tratar_parametro_invalido
from app.routes import composicoes, jogadores, partidas, ranking, status, times
from app.routes import comparacoes, mapas, agentes

app = FastAPI(
    title="DA TROPA — API de estatísticas",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.add_exception_handler(ApiError, tratar_erro)
app.add_exception_handler(RequestValidationError, tratar_parametro_invalido)

app.include_router(status.router)
app.include_router(ranking.router)
app.include_router(jogadores.router)
app.include_router(times.router)
app.include_router(partidas.router)
app.include_router(composicoes.router)
app.include_router(comparacoes.router)
app.include_router(mapas.router)
app.include_router(agentes.router)