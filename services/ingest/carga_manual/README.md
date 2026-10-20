# Carga manual do bronze

Carrega a base inteira de uma vez na tabela `valorant.bronze_partidas`. Serve até o serviço de ingestão ficar pronto.

O bronze guarda o dado como veio. Uma linha por arquivo (um mapa), com o JSON intacto e dois campos a mais:

- `_arquivo`: nome do arquivo. É onde estão os times e o placar.
- `_pasta`: subpasta do torneio, ex. `Univavá/Classificatória 1`.

Só precisa de `python3`, `gcloud` e `bq`. Rode da raiz do repo, com a base em `data/raw/` (veja `docs/dados.md`).

## 1. Subir os JSONs originais

```bash
gcloud storage rsync --recursive --project datropa data/raw gs://datropa-raw-matches/partidas
```

## 2. Gerar o NDJSON

```bash
python3 services/ingest/carga_manual/gerar_ndjson.py data/raw data/bronze/partidas.ndjson
```

Fica em `data/`, fora do git.

## 3. Subir o NDJSON

```bash
gcloud storage cp --project datropa data/bronze/partidas.ndjson gs://datropa-raw-matches/bronze/partidas.ndjson
```

## 4. Carregar no BigQuery

```bash
bq --project_id=datropa --location=southamerica-east1 load --replace \
  --source_format=NEWLINE_DELIMITED_JSON \
  --schema=services/ingest/carga_manual/schema_bronze.json \
  datropa:valorant.bronze_partidas \
  gs://datropa-raw-matches/bronze/partidas.ndjson
```

`--replace` apaga e recarrega a tabela inteira.

## Por que schema explícito

O `--autodetect` falha: `matchInfo.premierMatchInfo` vem sempre `{}`, e o BigQuery não aceita struct vazio.

O `schema_bronze.json` sai do `gerar_schema.py`, que lê todas as linhas e junta os tipos:

- null não fixa tipo;
- INTEGER com FLOAT vira FLOAT;
- o que não tem tipo fixo vira `JSON`, com o valor como veio.

Hoje caem em `JSON`: `matchInfo.premierMatchInfo` e `roundResults.playerStats.ability.*Effects` (sempre null).

Base nova ou com campo novo? Gere o schema de novo antes do passo 4:

```bash
python3 services/ingest/carga_manual/gerar_schema.py data/bronze/partidas.ndjson services/ingest/carga_manual/schema_bronze.json
```

## Conferir

```sql
SELECT COUNT(*), COUNT(DISTINCT matchInfo.matchId), COUNT(DISTINCT _arquivo)
FROM valorant.bronze_partidas;
-- 330, 330, 330 (carga de 19/10/2026)
```
