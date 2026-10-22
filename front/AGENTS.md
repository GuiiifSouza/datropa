# front

SPA do Da Tropa no Firebase Hosting (`devs.datropa.com`). Vite + React + TypeScript, sem biblioteca de UI, de roteamento ou de gráfico.

**Donos:** Lhobregat e RhuanK. Leia também o [AGENTS.md da raiz](/AGENTS.md), o [plano de ação](/docs/plano-de-acao.md) e o [README](README.md).

## Escopo

Lhobregat e RhuanK trocaram de frente:

- **Lhobregat:** esqueleto do app, páginas (panorama, partidas, partida, times, time, jogador, estatísticas, meta), Tropa AI (painel e tela cheia), login e identidade visual.
- **RhuanK:** prancheta tática (mapa, peças, desenho, etapas, salvar, round real) e mapa de calor. Rota `/prancheta` (`src/paginas/Prancheta.tsx`), exportada do protótipo por `scripts/exportar_prancheta.py` (ver README). Não edite `src/prancheta/gerado/` à mão.

## Regras

- **Mexa só nesta pasta.** Precisou de algo em outra, peça ao dono (`.github/CODEOWNERS`) ou abra uma issue. O que falta fora daqui está em [docs/pedidos.md](docs/pedidos.md).
- Chame só `/api/stats/**` e `/api/coach/**`, no formato de `docs/api.md`. Toda tela busca dados por `src/api/stats.ts`; nada de `fetch` solto nas páginas.
- Rota que ainda não existe na API cai no snapshot (`public/snapshot`). Quando o gugu publicar a rota, a tela troca sozinha. Função que só existe no snapshot fica marcada em `stats.ts`.
- O coach exige o ID token do Firebase. As rotas de stats são públicas, mas o cliente manda o token quando há login.
- Link da prancheta: `/prancheta?partida_id=<id>&round=<n>`, round começando em 1. Use `linkPrancheta()` de `src/componentes/Prancheta.tsx`.
- A prancheta guarda as jogadas no navegador (`localStorage`), sem Firestore. Se um dia for para o Firestore, as regras são do Guilherme: peça.
- Minimapa e ícone/arte de agente são da Riot. Ficam desligados (`VITE_ARTE_RIOT=0`) e fora do git até o OK da organização.
- Config do Firebase Hosting (`firebase.json`, rewrites) e deploy são do Guilherme.

## Convenções

- Cores, fontes e raios só pelos tokens de `src/estilos/tokens.css`. Vermelho é da IA e do que está ativo; âmbar é o time A; menta é o time B e a prancheta.
- Gráfico novo entra em `src/graficos/Graficos.tsx` e aparece dentro de `<Figura>`, com tabela equivalente. Texto nunca na cor da série.
- Valor ausente é `null` e aparece como "—". Nunca trocar por zero.
- Razões (K/D, ADR, taxas) sempre recalculadas pelos totais, nunca média de partidas.
- Nome de time para exibição passa por `nomeTime()`; o ID é o da gold.
- Português do Brasil na interface e nos comentários.

## Antes de dizer que terminou

`npm run build` e `npm run tipos` sem erro, a tela conferida no navegador (desktop e celular) e o que ficou de fora dito no PR.
