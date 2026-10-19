# services/ingest

Carga dos JSONs da base no BigQuery. Disparado pelo Eventarc quando chega arquivo no bucket `raw-matches`. Roda no Cloud Run com a `sa-ingest`.

Dono: Guilherme. Escopo e regras em [AGENTS.md](AGENTS.md).
