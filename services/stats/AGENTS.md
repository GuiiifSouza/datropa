# services/stats

API de estatísticas, análise coletiva e eventos de round para a prancheta. Roda no Cloud Run com a `sa-stats`.

**Dono:** gugu (API) e chico (`sql/gold/`). Leia também o [AGENTS.md da raiz](/AGENTS.md) e o [plano de ação](/docs/plano-de-acao.md).

## Escopo

- gugu: as rotas de `docs/api.md`, cache no Firestore, tabelas de tradução de UUID.
- chico: o SQL das tabelas gold em `sql/gold/` (ranking, time, mapa, agente, partida, análise coletiva, `eventos_round`, `mapas`).

## Regras

- **Mexa só nesta pasta.** Precisou de algo em outra, peça ao dono (veja `.github/CODEOWNERS`) ou abra uma issue.
- Leia só da gold. Nada de consulta no bronze em rota da API.
- Valide o JWT do Firebase em toda rota.
- Toda consulta com `maximum_bytes_billed`. Mexeu em SQL? Rode dry run e informe os bytes no PR.
- Mudou o formato de uma resposta? Atualize `docs/api.md` no mesmo PR e avise o front.
- Precisa ser container no Cloud Run. A linguagem é escolha do dono; registre no README desta pasta.
