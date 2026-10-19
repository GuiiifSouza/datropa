# front

SPA do Da Tropa no Firebase Hosting (`devs.datropa.com`).

**Dono:** Lhobregat e RhuanK. Leia também o [AGENTS.md da raiz](/AGENTS.md) e o [plano de ação](/docs/plano-de-acao.md).

## Escopo

- Lhobregat: esqueleto do app, login, prancheta tática (mapa, peças, desenho, etapas, salvar, round real) e mapa de calor.
- RhuanK: ranking, páginas de time (com gráficos coletivos), jogador e partida, tela do coach, identidade visual.

## Regras

- **Mexa só nesta pasta.** Precisou de algo em outra, peça ao dono (veja `.github/CODEOWNERS`) ou abra uma issue.
- Chame só `/api/stats/**` e `/api/coach/**`, no formato de `docs/api.md`. Até a API subir, use os JSONs de exemplo de lá como mock.
- Mande o JWT do Firebase Auth em toda chamada de API.
- A prancheta grava estratégias direto no Firestore pelo SDK do Firebase. As regras do Firestore são do Guilherme: precisou mudar, peça.
- Minimapa e ícone de agente são arte da Riot. Só use depois do OK da organização (veja `docs/plano-de-acao.md`, riscos).
- Config do Firebase Hosting (`firebase.json`, rewrites) e deploy são do Guilherme.
