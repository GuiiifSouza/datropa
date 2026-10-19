# services/coach

Coach de IA: agente no Vertex AI (Gemini) que escolhe tools com consultas prontas na gold. Roda no Cloud Run com a `sa-coach`, só leitura.

**Dono:** Guilherme. Leia também o [AGENTS.md da raiz](/AGENTS.md) e o [plano de ação](/docs/plano-de-acao.md).

## Escopo

- Agente, tools, prompts, scouting de time e resumo de partida. Lista de tools em `docs/arquitetura/README.md`.

## Regras

- **Mexa só nesta pasta.** Precisou de algo em outra, peça ao dono (veja `.github/CODEOWNERS`) ou abra uma issue.
- O Gemini não escreve SQL. Toda tool é consulta parametrizada, com `maximum_bytes_billed`.
- `consulta_livre` fica desligada. Se ligar: só `SELECT` na gold, dry run e `LIMIT` forçado.
- Resposta sempre cita o resultado da tool. Sem número inventado.
- Valide o JWT do Firebase em toda rota.
