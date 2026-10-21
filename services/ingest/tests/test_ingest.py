"""Serviço do ingest sem GCP: bucket e tabela falsos em memória."""

import json
import subprocess
import sys
from pathlib import Path
from unittest import mock

import pytest
from fastapi.testclient import TestClient
from google.api_core.exceptions import BadRequest, Conflict, InternalServerError
from google.cloud.bigquery import SchemaField

from ingest import app as app_mod, carga, config
from ingest.partida import PartidaInvalida

PASTA_INGEST = Path(__file__).resolve().parents[1]
SCHEMA = [SchemaField.from_api_repr(c) for c in
          json.loads((PASTA_INGEST / "carga_manual" / "schema_bronze.json").read_text())]

PASTA = "Univavá/Classificatória 2"
ARQUIVO = "UNIVAVA_C2_012_25-07-26_ufmt_turuna_13_x_8_unicamp_tritons_black_lotus.json"
NOME = f"partidas/{PASTA}/{ARQUIVO}"
FINALIZED = "google.cloud.storage.object.v1.finalized"


def partida(match_id="m-1"):
    return {
        "matchInfo": {"matchId": match_id, "mapId": "/Game/Maps/Jam/Jam", "premierMatchInfo": {}},
        "players": [{"puuid": "p1", "gameName": "fulano", "teamId": "Red", "stats": {"kills": 13}}],
        "coaches": [],
        "teams": [{"teamId": "Red", "won": True, "roundsWon": 13}, {"teamId": "Blue", "won": False, "roundsWon": 8}],
        "roundResults": [{"roundNum": 0, "winningTeam": "Red", "playerStats": [{"puuid": "p1", "kills": []}]}],
    }


class Falso:
    """Bucket e tabela em memória, com a mesma interface de `carga.Gcp`."""

    schema = SCHEMA

    def __init__(self):
        self.objetos: dict[tuple[str, str], bytes] = {}
        self.tabela: list[dict] = []
        self.jobs: set[str] = set()
        self.lidos: list[str] = []

    def subir(self, nome, conteudo, bucket=config.BUCKET):
        if not isinstance(conteudo, (bytes, str)):
            conteudo = json.dumps(conteudo, ensure_ascii=False)
        self.objetos[(bucket, nome)] = conteudo.encode() if isinstance(conteudo, str) else conteudo

    def ler_objeto(self, ev):
        self.lidos.append(ev.nome)
        try:
            return self.objetos[(ev.bucket, ev.nome)]
        except KeyError:
            raise carga.ObjetoSumiu(ev.nome) from None

    def existente(self, arquivo, pasta, match_id):
        for linha in self.tabela:
            if (linha["_pasta"] == pasta and linha["_arquivo"] == arquivo) or (
                match_id is not None and linha["matchInfo"]["matchId"] == match_id
            ):
                return {"_pasta": linha["_pasta"], "_arquivo": linha["_arquivo"]}
        return None

    def carregar(self, ndjson, id_fixo):
        if id_fixo in self.jobs:
            return False
        self.jobs.add(id_fixo)
        self.tabela.extend(json.loads(l) for l in ndjson.decode().splitlines())
        return True


@pytest.fixture
def falso(monkeypatch):
    f = Falso()
    monkeypatch.setattr(app_mod, "fontes", f)
    return f


@pytest.fixture
def cliente():
    return TestClient(app_mod.app)


def enviar(cliente, nome, geracao="1", bucket=config.BUCKET, **extra):
    """Evento no modo binário, como o Eventarc manda."""
    corpo = {"bucket": bucket, "name": nome, "generation": geracao, "size": "1234", **extra}
    return cliente.post("/", json=corpo, headers={"ce-id": "ev-1", "ce-type": FINALIZED,
                                                   "ce-specversion": "1.0", "ce-source": "x"})


# --- os quatro casos pedidos -------------------------------------------------

def test_partida_em_partidas_e_carregada(cliente, falso):
    falso.subir(NOME, partida())
    r = enviar(cliente, NOME)
    assert r.status_code == 200
    assert r.json()["status"] == "carregado"
    assert len(falso.tabela) == 1
    linha = falso.tabela[0]
    assert linha["_pasta"] == PASTA and linha["_arquivo"] == ARQUIVO
    assert linha["matchInfo"]["matchId"] == "m-1"
    assert linha["matchInfo"]["premierMatchInfo"] == {}  # JSON intacto


def test_ndjson_do_bronze_e_ignorado(cliente, falso):
    falso.subir("bronze/partidas.ndjson", "{}")
    r = enviar(cliente, "bronze/partidas.ndjson")
    assert r.status_code == 200
    assert r.json()["status"] == "ignorado"
    assert falso.lidos == [] and falso.tabela == []


def test_arquivo_repetido_nao_duplica(cliente, falso):
    falso.subir(NOME, partida())
    assert enviar(cliente, NOME, geracao="1").json()["status"] == "carregado"
    # mesma entrega de novo (retry do Eventarc)
    assert enviar(cliente, NOME, geracao="1").json()["status"] == "duplicado"
    # mesmo arquivo enviado de novo ao bucket (geração nova)
    assert enviar(cliente, NOME, geracao="2").json()["status"] == "duplicado"
    assert len(falso.tabela) == 1


def test_json_invalido_e_rejeitado_sem_retry(cliente, falso):
    falso.subir("partidas/x/quebrado.json", b"{nao e json")
    r = enviar(cliente, "partidas/x/quebrado.json")
    assert r.status_code == 200  # 2xx: o Eventarc não tenta de novo
    assert r.json()["status"] == "rejeitado"
    assert "JSON inválido" in r.json()["motivo"]
    assert falso.tabela == []


# --- outros casos --------------------------------------------------------------

def test_json_que_nao_e_objeto_e_rejeitado(cliente, falso):
    falso.subir("partidas/x/lista.json", "[1, 2]")
    assert enviar(cliente, "partidas/x/lista.json").json()["status"] == "rejeitado"


def test_mesmo_match_com_outro_nome_nao_duplica(cliente, falso):
    falso.subir(NOME, partida("m-1"))
    falso.subir("partidas/outra/renomeado.json", partida("m-1"))
    enviar(cliente, NOME)
    r = enviar(cliente, "partidas/outra/renomeado.json")
    assert r.json()["status"] == "duplicado"
    assert "matchId" in r.json()["motivo"]
    assert len(falso.tabela) == 1


def test_campo_fora_do_schema_e_rejeitado(cliente, falso):
    p = partida()
    p["players"][0]["campoNovo"] = 1
    falso.subir(NOME, p)
    r = enviar(cliente, NOME)
    assert r.json()["status"] == "rejeitado"
    assert "players.campoNovo" in r.json()["motivo"]


def test_outros_ignorados(cliente, falso):
    assert enviar(cliente, "partidas/.DS_Store").json()["status"] == "ignorado"
    assert enviar(cliente, "partidas/").json()["status"] == "ignorado"
    assert enviar(cliente, NOME, bucket="outro-bucket").json()["status"] == "ignorado"
    assert falso.lidos == []


def test_objeto_apagado_antes_de_ler_e_ignorado(cliente, falso):
    assert enviar(cliente, NOME).json()["status"] == "ignorado"


def test_arquivo_grande_demais_e_rejeitado(cliente, falso, monkeypatch):
    monkeypatch.setattr(config, "MAX_BYTES_ARQUIVO", 10)
    r = enviar(cliente, NOME)
    assert r.json()["status"] == "rejeitado" and falso.lidos == []


def test_evento_malformado_responde_2xx(cliente, falso):
    r = cliente.post("/", content=b"nada", headers={"ce-type": FINALIZED})
    assert r.status_code == 200 and r.json()["status"] == "ignorado"
    r = cliente.post("/", json={"sem": "bucket"}, headers={"ce-type": FINALIZED})
    assert r.status_code == 200 and r.json()["status"] == "ignorado"
    r = cliente.post("/", json={"bucket": "b", "name": NOME}, headers={"ce-type": "outro.tipo"})
    assert r.status_code == 200 and r.json()["status"] == "ignorado"


def test_cloudevent_estruturado(cliente, falso):
    falso.subir(NOME, partida())
    ev = {"specversion": "1.0", "type": FINALIZED, "id": "1", "source": "x",
          "data": {"bucket": config.BUCKET, "name": NOME, "generation": "7"}}
    r = cliente.post("/", json=ev)
    assert r.json()["status"] == "carregado"


def test_falha_transitoria_responde_503(cliente, falso, monkeypatch):
    def quebra(_):
        raise InternalServerError("GCS fora")
    monkeypatch.setattr(falso, "ler_objeto", quebra)
    r = enviar(cliente, NOME)
    assert r.status_code == 503


def test_nome_com_acento_decomposto_vira_nfc(cliente, falso):
    import unicodedata
    nfd = unicodedata.normalize("NFD", NOME)
    falso.subir(nfd, partida())
    enviar(cliente, nfd)
    assert falso.tabela[0]["_pasta"] == PASTA  # NFC, igual à carga manual


# --- mesma linha da carga manual ---------------------------------------------

def test_carga_manual_gera_a_mesma_linha(tmp_path, cliente, falso):
    raw = tmp_path / "raw" / PASTA
    raw.mkdir(parents=True)
    (raw / ARQUIVO).write_text(json.dumps(partida(), ensure_ascii=False), encoding="utf-8")
    saida = tmp_path / "bronze.ndjson"
    subprocess.run([sys.executable, str(PASTA_INGEST / "carga_manual" / "gerar_ndjson.py"),
                    str(tmp_path / "raw"), str(saida)], check=True, capture_output=True)
    manual = json.loads(saida.read_text(encoding="utf-8").splitlines()[0])

    falso.subir(NOME, partida())
    enviar(cliente, NOME)
    assert falso.tabela[0] == manual


# --- Gcp.carregar: job_id fixo e erros do BigQuery ----------------------------

def _job(erro=None, reason=None):
    job = mock.Mock()
    if erro:
        job.result.side_effect = erro
        job.error_result = {"reason": reason, "message": str(erro)}
        job.errors = [{"message": "linha 1: campo x"}]
    else:
        job.result.return_value = None
        job.error_result = None
    return job


def _gcp(bq):
    g = carga.Gcp()
    g.__dict__["bq"] = bq  # cached_property
    return g


def test_job_id_fixo_por_objeto_e_geracao():
    a = carga.job_id(carga.Evento("b", "partidas/x.json", "1"))
    assert a == carga.job_id(carga.Evento("b", "partidas/x.json", "1"))
    assert a != carga.job_id(carga.Evento("b", "partidas/x.json", "2"))
    assert carga.job_id(carga.Evento("b", "partidas/x.json")) is None


def test_carregar_com_job_ja_existente_e_ok_nao_carrega_de_novo():
    bq = mock.Mock()
    bq.load_table_from_file.side_effect = Conflict("já existe")
    bq.get_job.return_value = _job()
    assert _gcp(bq).carregar(b"{}\n", "ingest_abc") is False
    assert bq.load_table_from_file.call_count == 1


def test_carregar_com_job_anterior_falho_tenta_com_id_novo():
    bq = mock.Mock()
    novo = _job()
    bq.load_table_from_file.side_effect = [Conflict("já existe"), novo]
    bq.get_job.return_value = _job(InternalServerError("backend"), "backendError")
    assert _gcp(bq).carregar(b"{}\n", "ingest_abc") is True
    assert bq.load_table_from_file.call_args.kwargs == {
        "job_config": mock.ANY, "job_id_prefix": "ingest_retry_"}


def test_carregar_recusado_pelo_bigquery_e_permanente():
    bq = mock.Mock()
    bq.load_table_from_file.return_value = _job(BadRequest("JSON parsing error"), "invalid")
    with pytest.raises(PartidaInvalida):
        _gcp(bq).carregar(b"{}\n", "ingest_abc")


def test_carregar_com_erro_transitorio_sobe():
    bq = mock.Mock()
    bq.load_table_from_file.return_value = _job(InternalServerError("backend"), "backendError")
    with pytest.raises(InternalServerError):
        _gcp(bq).carregar(b"{}\n", "ingest_abc")


def test_carregar_usa_append_sem_criar_tabela():
    from google.cloud import bigquery
    bq = mock.Mock()
    bq.load_table_from_file.return_value = _job()
    _gcp(bq).carregar(b"{}\n", "ingest_abc")
    args, kwargs = bq.load_table_from_file.call_args
    assert args[1] == "datropa.valorant.bronze_partidas"
    cfg = kwargs["job_config"]
    assert cfg.write_disposition == bigquery.WriteDisposition.WRITE_APPEND
    assert cfg.create_disposition == bigquery.CreateDisposition.CREATE_NEVER
    assert cfg.source_format == bigquery.SourceFormat.NEWLINE_DELIMITED_JSON
    assert kwargs["job_id"] == "ingest_abc"
