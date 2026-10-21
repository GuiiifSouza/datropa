# services/ingest

Carga dos JSONs da base no BigQuery. Disparado pelo Eventarc quando chega arquivo no bucket `datropa-raw-matches`. Roda no Cloud Run com a `sa-ingest`.

Dono: Guilherme. Escopo e regras em [AGENTS.md](AGENTS.md).

## Stack

- **Python 3.12** com [uv](https://docs.astral.sh/uv/), igual ao `coach`.
- **FastAPI + uvicorn** para receber o evento, em container (`Dockerfile`, `python:3.12-slim` + uv). Escuta na `PORT` que o Cloud Run define (8080 por padrão).
- **`google-cloud-storage`** para ler o arquivo e **`google-cloud-bigquery`** para carregar, com credenciais ADC (local: `gcloud auth application-default login`; no Cloud Run: a `sa-ingest`).

## Como funciona

```
JSON novo em gs://datropa-raw-matches/partidas/<pasta>/<arquivo>.json
  → Eventarc (object.finalized, gatilho ingest-partidas)
  → POST / no ingest
  → lê o objeto, monta a linha (ingest/partida.py)
  → já está no bronze? para aqui
  → load job (NDJSON, WRITE_APPEND) em valorant.bronze_partidas
```

- A linha é a mesma da carga manual: o JSON intacto mais `_arquivo` (nome do arquivo, onde estão os times) e `_pasta` (caminho depois de `partidas/`, ex. `Univavá/Classificatória 1`), os dois em NFC. O código fica em `ingest/partida.py` e a carga manual (`carga_manual/gerar_ndjson.py`) usa o mesmo módulo. A saída do `gerar_ndjson.py` continuou idêntica byte a byte depois da mudança.
- O gatilho dispara para todo objeto do bucket. O serviço só processa `.json` debaixo de `partidas/`. O NDJSON em `bronze/`, pasta vazia ou outro bucket é ignorado com 200.
- Antes do load, os campos da linha são conferidos contra o schema da tabela (lido do BigQuery). Campo que a tabela não tem faria o load falhar; o serviço recusa antes, com a lista dos campos no log.
- Load job em vez de streaming insert: é grátis, a linha fica consultável na hora (sem streaming buffer), aceita as colunas `JSON` do mesmo jeito que a carga manual e não deixa linha pela metade. `CREATE_NEVER`: nome de tabela errado falha em vez de criar tabela nova.
- A gold não é atualizada aqui. Depois que arquivo novo entra no bronze, a gold precisa ser regerada pelo processo de `services/stats/sql/gold/`.

### Idempotência

O Eventarc entrega pelo menos uma vez, e o mesmo arquivo pode subir de novo. Duas proteções:

1. **Checagem antes do load.** Uma consulta parametrizada procura linha com o mesmo `_pasta` + `_arquivo` **ou** o mesmo `matchInfo.matchId`. Achou, responde `duplicado` e não carrega. O `matchId` pega também a mesma partida com nome de arquivo diferente, que contaria em dobro na gold. A consulta lê só essas três colunas (dry run: 46 KB na tabela de 336 linhas), com `maximum_bytes_billed` de 100 MB.
2. **`job_id` fixo por objeto e geração** (`ingest_<sha256(bucket/nome#geração)>`). Se duas entregas do mesmo evento passarem juntas pela checagem, o BigQuery recusa o segundo job com 409. O serviço então espera o job que já existe: deu certo, responde `duplicado`; falhou por erro transitório, carrega de novo com id novo.

Por que não `MERGE`: precisaria de uma tabela temporária por arquivo (criar, carregar, `MERGE`, apagar). Com um arquivo por evento e no máximo 2 instâncias, checagem + `job_id` fixo cobre os casos reais com menos peças.

O que sobra: o mesmo arquivo reenviado (geração nova) **ao mesmo tempo** que o original ainda está carregando pode passar nas duas checagens. Para reprocessar um arquivo corrigido, apague a linha antiga no BigQuery e suba o arquivo de novo.

### Respostas e retry

| Situação | Resposta | Eventarc |
|---|---|---|
| Carregado | 200 `carregado` | para |
| Já estava no bronze | 200 `duplicado` | para |
| Fora de `partidas/`, não `.json`, outro bucket, objeto apagado, evento malformado | 200 `ignorado` | para |
| JSON inválido, não é objeto, campo fora do schema, BigQuery recusou a linha (`invalid`), arquivo acima de 50 MB | 200 `rejeitado`, log `ERROR` | para |
| Rede, permissão, BigQuery fora, timeout do load | 503, log `ERROR` com stack | tenta de novo, com backoff |

Rejeitado não volta sozinho: corrija o arquivo e suba de novo. Para achar os rejeitados no Cloud Logging: `resource.labels.service_name="ingest" AND jsonPayload.status="rejeitado"`.

### Autenticação

Não valida JWT do Firebase. O serviço é privado: o CD (`deploy-servico.yml` com `eventarc: true`) não dá `allUsers`, só `run.invoker` para a `sa-ingest`, que é a conta com que o gatilho do Eventarc chama. O Cloud Run recusa qualquer outra chamada antes de chegar no código. Veja `infra/README.md` (CI/CD e service accounts).

Permissões que o serviço usa, todas já na `sa-ingest`: `storage.objectViewer` no bucket (ler o JSON), `WRITER` no dataset `valorant` (ler o schema, rodar o load) e `bigquery.jobUser` no projeto (rodar a consulta e o load job).

## Variáveis de ambiente

Todas têm o padrão de produção. No Cloud Run não precisa definir nenhuma.

| Variável | Padrão | Para quê |
|---|---|---|
| `INGEST_PROJETO` | `datropa` | Projeto do BigQuery e do Storage |
| `INGEST_REGIAO` | `southamerica-east1` | Região dos jobs do BigQuery |
| `INGEST_BUCKET` | `datropa-raw-matches` | Evento de outro bucket é ignorado |
| `INGEST_PREFIXO` | `partidas/` | Só objetos debaixo dele viram linha |
| `INGEST_DATASET` | `valorant` | Dataset do bronze |
| `INGEST_TABELA` | `bronze_partidas` | Tabela do bronze |
| `INGEST_MAX_BYTES_BILLED` | `104857600` (100 MB) | Teto da consulta de duplicado |
| `INGEST_MAX_BYTES_ARQUIVO` | `52428800` (50 MB) | Arquivo maior é rejeitado (partida tem ~0,6 MB) |
| `INGEST_TIMEOUT_LOAD_S` | `240` | Espera do load job antes de responder 503 |
| `PORT` | `8080` | Definida pelo Cloud Run |

## Como testar

Testes sem GCP (bucket e tabela falsos em memória), da pasta `services/ingest`:

```bash
uv run pytest -q
```

Cobrem: arquivo em `partidas/` carregado, NDJSON em `bronze/` ignorado, arquivo repetido (mesma geração e geração nova) sem duplicar, mesmo `matchId` com outro nome, JSON inválido e campo fora do schema rejeitados com 200, falha transitória com 503, CloudEvent binário e estruturado, a linha igual à da carga manual e o tratamento do `job_id` fixo.

Contra o bucket e a tabela de verdade, **só leitura** (lê o objeto, confere o schema, dry run e `SELECT` da checagem; não carrega):

```bash
uv run python -m ingest.cli "gs://datropa-raw-matches/partidas/Rush Series Esquenta 2/RUSH2_002_20-06-26_fatec_pg_10_x_13_panterao_gaming_ascent.json"
```

`--carregar` faz o load de verdade, igual ao serviço. Serve para reprocessar um arquivo à mão.

Container local (sem credencial, só para ver que sobe e responde):

```bash
docker build -t ingest services/ingest
docker run --rm -e PORT=8099 -p 8099:8099 ingest
curl -X POST localhost:8099/ -H 'ce-type: google.cloud.storage.object.v1.finalized' \
  -H 'content-type: application/json' \
  -d '{"bucket":"datropa-raw-matches","name":"bronze/partidas.ndjson","generation":"1"}'
# {"status":"ignorado","motivo":"fora de partidas/"}
```

## Carga manual

A base inteira de uma vez, com `--replace`: [carga_manual/README.md](carga_manual/README.md). Com o gatilho ligado, o `rsync` da carga manual dispara evento para cada arquivo que ele subir, e o serviço carrega os novos. Cuidado com o passo 4 dela: o `--replace` recarrega só o que está no `data/raw` local e apaga do bronze o que o serviço carregou e não estiver lá.
