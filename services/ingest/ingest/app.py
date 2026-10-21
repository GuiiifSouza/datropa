"""Rota HTTP que o Eventarc chama quando um objeto termina de subir no bucket.

    POST /
    ce-type: google.cloud.storage.object.v1.finalized
    {"bucket": "datropa-raw-matches", "name": "partidas/<pasta>/<arquivo>.json", "generation": "...", ...}

O serviço é privado: só a sa-ingest tem `run.invoker`, e é com ela que o
gatilho do Eventarc chama. O Cloud Run confere o token antes de a requisição
chegar aqui, por isso não há validação de JWT do Firebase.

Respostas:
  200  carregado, duplicado, ignorado ou rejeitado (o Eventarc não tenta de novo)
  503  falha transitória (rede, permissão, BigQuery); o Eventarc tenta de novo
"""

from __future__ import annotations

import json
import logging
import sys

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from . import carga


class _LogJson(logging.Formatter):
    """Uma linha JSON por log. O Cloud Logging lê `severity` e os campos extras."""

    def format(self, record):
        saida = {"severity": record.levelname, "message": record.getMessage(), "logger": record.name}
        saida.update(getattr(record, "campos", {}))
        if record.exc_info:
            saida["exception"] = self.formatException(record.exc_info)
        return json.dumps(saida, ensure_ascii=False, default=str)


_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(_LogJson())
logging.basicConfig(level=logging.INFO, handlers=[_handler], force=True)
log = logging.getLogger("ingest.app")

app = FastAPI(title="ingest", docs_url=None, redoc_url=None, openapi_url=None)

# Por instância: os clientes do GCP e o schema da tabela ficam em cache.
fontes = carga.Gcp()


@app.post("/")
async def evento(request: Request):
    corpo = await request.body()
    id_evento = request.headers.get("ce-id")
    ev, motivo = carga.evento_de_cloudevent(corpo, request.headers.get("ce-type"))
    if ev is None:
        log.warning("evento ignorado: %s", motivo, extra={"campos": {"ce_id": id_evento}})
        return {"status": "ignorado", "motivo": motivo}

    campos = {"ce_id": id_evento, "bucket": ev.bucket, "objeto": ev.nome, "geracao": ev.geracao}
    try:
        res = await run_in_threadpool(carga.processar, ev, fontes)
    except Exception:
        log.exception("falha transitória; o Eventarc vai tentar de novo", extra={"campos": campos})
        return JSONResponse(status_code=503, content={"status": "erro", "motivo": "falha transitória"})

    campos.update(res.detalhes, status=res.status)
    nivel = logging.ERROR if res.status == "rejeitado" else logging.INFO
    log.log(nivel, "%s %s %s", res.status, ev.nome, res.motivo, extra={"campos": campos})
    return {"status": res.status, "motivo": res.motivo, **res.detalhes}
