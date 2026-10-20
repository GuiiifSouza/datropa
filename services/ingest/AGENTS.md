# services/ingest

Carga dos JSONs da base no BigQuery. Disparado pelo Eventarc quando chega arquivo no bucket `datropa-raw-matches`. Roda no Cloud Run com a `sa-ingest`.

**Dono:** Guilherme. Leia também o [AGENTS.md da raiz](/AGENTS.md) e o [plano de ação](/docs/plano-de-acao.md).

## Escopo

- Converter o JSON para NDJSON, carregar o bronze e disparar a atualização da gold.

## Regras

- **Mexa só nesta pasta.** Precisou de algo em outra, peça ao dono (veja `.github/CODEOWNERS`) ou abra uma issue.
- Só a base oficial do hackathon entra aqui. Nenhuma outra fonte de partida.
- Bronze guarda o dado como veio. Correção é na gold.
