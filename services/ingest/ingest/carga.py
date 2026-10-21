"""Leva um arquivo do bucket para o bronze, sem duplicar.

Fluxo de `processar`:
  1. fora de `partidas/`, outro bucket ou não `.json`  -> ignorado
  2. lê o objeto (na geração do evento)                  -> some: ignorado
  3. monta a linha (ingest/partida.py)                   -> JSON ruim: rejeitado
  4. confere campos contra o schema da tabela            -> campo novo: rejeitado
  5. já tem linha com o mesmo _pasta/_arquivo ou matchId -> duplicado
  6. load job com job_id fixo por objeto+geração         -> carregado

`rejeitado`, `ignorado` e `duplicado` respondem 2xx: tentar de novo não muda nada.
Erro de rede, permissão ou do BigQuery sobe como exceção e vira 5xx, e o
Eventarc tenta de novo.
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
from dataclasses import dataclass, field
from functools import cached_property

from . import config
from .partida import PartidaInvalida, arquivo_e_pasta, ler_partida, linha_ndjson

log = logging.getLogger("ingest.carga")

# Razões de erro do BigQuery que são do dado, não do serviço.
RAZOES_PERMANENTES = {"invalid", "invalidQuery"}


class ObjetoSumiu(Exception):
    """O objeto (nessa geração) não existe mais no bucket."""


@dataclass
class Evento:
    bucket: str
    nome: str
    geracao: str | None = None
    tamanho: int | None = None


@dataclass
class Resultado:
    status: str  # carregado | duplicado | ignorado | rejeitado | carregaria (dry run)
    motivo: str = ""
    detalhes: dict = field(default_factory=dict)


def job_id(evento: Evento) -> str | None:
    """Id do load job fixo por objeto e geração.

    O BigQuery recusa (409) um segundo job com o mesmo id. Duas entregas do
    mesmo evento ao mesmo tempo não carregam duas vezes.
    """
    if not evento.geracao:
        return None
    chave = f"{evento.bucket}/{evento.nome}#{evento.geracao}"
    return "ingest_" + hashlib.sha256(chave.encode()).hexdigest()[:40]


def campos_fora_do_schema(valor, campos, caminho: str = "") -> list[str]:
    """Caminhos presentes na linha que a tabela não tem. O load recusaria a linha."""
    if not isinstance(valor, dict):
        return []
    por_nome = {c.name: c for c in campos}
    novos = []
    for nome, v in valor.items():
        atual = f"{caminho}{nome}"
        campo = por_nome.get(nome)
        if campo is None:
            novos.append(atual)
            continue
        if campo.field_type in ("RECORD", "STRUCT"):
            itens = v if isinstance(v, list) else [v]
            for item in itens:
                for n in campos_fora_do_schema(item, campo.fields, f"{atual}."):
                    if n not in novos:
                        novos.append(n)
    return novos


class Gcp:
    """Acesso real ao Cloud Storage e ao BigQuery, com as credenciais ADC (no Cloud Run, a sa-ingest)."""

    @cached_property
    def bq(self):
        from google.cloud import bigquery

        return bigquery.Client(project=config.PROJETO, location=config.REGIAO)

    @cached_property
    def gcs(self):
        from google.cloud import storage

        return storage.Client(project=config.PROJETO)

    def ler_objeto(self, evento: Evento) -> bytes:
        from google.api_core.exceptions import NotFound

        geracao = int(evento.geracao) if evento.geracao else None
        blob = self.gcs.bucket(evento.bucket).blob(evento.nome, generation=geracao)
        try:
            return blob.download_as_bytes()
        except NotFound:
            raise ObjetoSumiu(evento.nome) from None

    @cached_property
    def schema(self):
        return self.bq.get_table(config.tabela()).schema

    def _consulta_existente(self, arquivo: str, pasta: str, match_id: str | None, dry_run: bool):
        from google.cloud import bigquery

        sql = f"""
            SELECT _pasta, _arquivo, matchInfo.matchId AS match_id
            FROM `{config.tabela()}`
            WHERE (_pasta = @pasta AND _arquivo = @arquivo) OR matchInfo.matchId = @match_id
            LIMIT 1
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("pasta", "STRING", pasta),
                bigquery.ScalarQueryParameter("arquivo", "STRING", arquivo),
                bigquery.ScalarQueryParameter("match_id", "STRING", match_id),
            ],
            maximum_bytes_billed=config.MAX_BYTES_BILLED,
            use_query_cache=False,
            dry_run=dry_run,
            labels={"servico": "ingest"},
        )
        return self.bq.query(sql, job_config=job_config)

    def existente(self, arquivo: str, pasta: str, match_id: str | None) -> dict | None:
        linhas = list(self._consulta_existente(arquivo, pasta, match_id, dry_run=False).result())
        return dict(linhas[0]) if linhas else None

    def bytes_checagem(self, arquivo: str, pasta: str, match_id: str | None) -> int:
        """Dry run da consulta de duplicado: bytes que ela processa."""
        return self._consulta_existente(arquivo, pasta, match_id, dry_run=True).total_bytes_processed

    def _load(self, conteudo: bytes, **id_job):
        from google.cloud import bigquery

        job_config = bigquery.LoadJobConfig(
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
            write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
            # A tabela é criada pela carga manual, com schema explícito. Nome
            # errado na configuração tem que falhar, não criar tabela nova.
            create_disposition=bigquery.CreateDisposition.CREATE_NEVER,
            labels={"servico": "ingest"},
        )
        return self.bq.load_table_from_file(
            io.BytesIO(conteudo), config.tabela(), job_config=job_config, **id_job
        )

    def _esperar(self, job) -> None:
        try:
            job.result(timeout=config.TIMEOUT_LOAD_S)
        except Exception:
            erro = job.error_result or {}
            if erro.get("reason") in RAZOES_PERMANENTES:
                detalhes = [e.get("message") for e in (job.errors or [])][:5]
                raise PartidaInvalida(f"BigQuery recusou a linha: {erro.get('message')} {detalhes}") from None
            raise

    def carregar(self, conteudo: bytes, id_fixo: str | None) -> bool:
        """Roda o load job. Devolve False se outra entrega do mesmo evento já carregou."""
        from google.api_core.exceptions import Conflict

        if not id_fixo:
            job = self._load(conteudo, job_id_prefix="ingest_")
            self._esperar(job)
            return True
        try:
            job = self._load(conteudo, job_id=id_fixo)
        except Conflict:
            antigo = self.bq.get_job(id_fixo, location=config.REGIAO)
            try:
                self._esperar(antigo)
                return False
            except PartidaInvalida:
                raise
            except Exception:
                # O job anterior falhou por erro transitório. Esta é a nova tentativa,
                # com id novo (o fixo já foi usado).
                log.warning("job %s falhou antes; carregando com id novo", id_fixo)
                job = self._load(conteudo, job_id_prefix="ingest_retry_")
        self._esperar(job)
        return True


def processar(evento: Evento, fontes=None, carregar: bool = True) -> Resultado:
    """Leva o objeto do evento para o bronze. `carregar=False` para no passo 6 (dry run)."""
    fontes = fontes or Gcp()

    if evento.bucket != config.BUCKET:
        return Resultado("ignorado", f"bucket {evento.bucket} não é {config.BUCKET}")
    if not evento.nome.startswith(config.PREFIXO):
        return Resultado("ignorado", f"fora de {config.PREFIXO}")
    if not evento.nome.lower().endswith(".json"):
        return Resultado("ignorado", "não é .json")
    if evento.tamanho is not None and evento.tamanho > config.MAX_BYTES_ARQUIVO:
        return Resultado("rejeitado", f"arquivo com {evento.tamanho} bytes, acima de {config.MAX_BYTES_ARQUIVO}")

    arquivo, pasta = arquivo_e_pasta(evento.nome[len(config.PREFIXO):])
    chave = {"arquivo": arquivo, "pasta": pasta}

    try:
        conteudo = fontes.ler_objeto(evento)
    except ObjetoSumiu:
        return Resultado("ignorado", "objeto não existe mais nessa geração", chave)
    if len(conteudo) > config.MAX_BYTES_ARQUIVO:
        return Resultado("rejeitado", f"arquivo com {len(conteudo)} bytes, acima de {config.MAX_BYTES_ARQUIVO}", chave)

    try:
        linha = ler_partida(conteudo, arquivo, pasta)
    except PartidaInvalida as e:
        return Resultado("rejeitado", str(e), chave)

    info = linha.get("matchInfo")
    match_id = info.get("matchId") if isinstance(info, dict) else None
    chave["match_id"] = match_id

    novos = campos_fora_do_schema(linha, fontes.schema)
    if novos:
        return Resultado("rejeitado", "campos que a tabela não tem: " + ", ".join(novos[:20]), chave)

    achado = fontes.existente(arquivo, pasta, match_id)
    if achado:
        if achado.get("_pasta") == pasta and achado.get("_arquivo") == arquivo:
            return Resultado("duplicado", "arquivo já está no bronze", chave)
        return Resultado(
            "duplicado",
            f"matchId já está no bronze como {achado.get('_pasta')}/{achado.get('_arquivo')}",
            chave,
        )

    if not carregar:
        return Resultado("carregaria", "dry run: passou em todas as checagens", chave)

    ndjson = (linha_ndjson(linha) + "\n").encode("utf-8")
    try:
        novo = fontes.carregar(ndjson, job_id(evento))
    except PartidaInvalida as e:
        return Resultado("rejeitado", str(e), chave)
    if not novo:
        return Resultado("duplicado", "outra entrega deste evento já carregou", chave)
    return Resultado("carregado", "", chave)


def evento_de_cloudevent(corpo: bytes, tipo_cabecalho: str | None) -> tuple[Evento | None, str]:
    """Lê o evento do Eventarc. Aceita o modo binário (dados no corpo, atributos
    nos cabeçalhos `ce-*`, que é o que o Eventarc manda) e o estruturado.

    Devolve (evento, "") ou (None, motivo).
    """
    try:
        dados = json.loads(corpo or b"null")
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None, "corpo não é JSON"
    tipo = tipo_cabecalho
    if isinstance(dados, dict) and "specversion" in dados and "data" in dados:
        tipo = dados.get("type")
        dados = dados["data"]
    if tipo and tipo != "google.cloud.storage.object.v1.finalized":
        return None, f"tipo de evento {tipo} não é object.finalized"
    if not isinstance(dados, dict) or not dados.get("bucket") or not dados.get("name"):
        return None, "evento sem bucket ou name"
    tamanho = dados.get("size")
    try:
        tamanho = int(tamanho) if tamanho is not None else None
    except (TypeError, ValueError):
        tamanho = None
    geracao = dados.get("generation")
    return Evento(
        bucket=str(dados["bucket"]),
        nome=str(dados["name"]),
        geracao=str(geracao) if geracao else None,
        tamanho=tamanho,
    ), ""
