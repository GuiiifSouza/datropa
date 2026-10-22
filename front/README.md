# front

SPA do Da Tropa no Firebase Hosting (`devs.datropa.com`): partidas, times, jogadores, estatísticas, meta da cena e a Tropa AI (coach).

**Donos:** Lhobregat (páginas, Tropa AI, identidade) e RhuanK (prancheta tática e mapa de calor). Escopo e regras em [AGENTS.md](AGENTS.md).

## Rodar

Precisa de Node 20 ou mais novo.

```bash
cd front
npm install          # gera o package-lock.json na primeira vez (o deploy usa npm ci)
npm run dev          # http://localhost:5173
npm run build        # gera front/dist, que o Hosting publica
npm run tipos        # checagem de tipos (tsc), separada do build
```

Variáveis opcionais em `.env.local` (modelo em [.env.example](.env.example)):

| Variável | Para quê |
|---|---|
| `VITE_FONTE_DADOS` | `auto` (padrão): API real e, se a rota não responder, o snapshot. `api` ou `snapshot` forçam uma fonte |
| `VITE_API_PROXY` | Em dev, manda `/api/**` e `/__/**` para outro host (ex.: `https://datropa.web.app`) |
| `VITE_FIREBASE_*` | Config web do Firebase fora do Hosting. No Hosting ela vem sozinha de `/__/firebase/init.json` |
| `VITE_ARTE_RIOT` | `1` liga as artes de agente da Riot. **Só depois do OK da organização** |

## Telas

| Rota | Tela | Dados |
|---|---|---|
| `/` | Panorama: números da base, série em destaque, top 5 em ACS, times em forma, torneios | snapshot + `/ranking`, `/times` |
| `/partidas` | Séries por dia, filtro por torneio e time, resumo do recorte | snapshot (agrupamento em série) |
| `/partidas/:partida_id` | Série e mapa: momentum, livro de rounds, placar dos jogadores, economia | `/partidas/{id}` |
| `/times`, `/times/:time_id` | Campanha, lados, pós-plant, economia contra a cena, mapas, elenco, composições, últimas séries | `/times`, `/times/{id}`, `/economia`, `/pos-plant-retake`, `/ranking?time_id`, `/composicoes` |
| `/jogadores/:jogador_id` | Métricas com a posição na cena, agentes, mapas, multikills, partidas | `/jogadores/{id}`, `/ranking` |
| `/estatisticas` | Líderes, tabela de jogadores com filtro e ordenação, tabela de times, glossário | `/ranking`, `/times` |
| `/meta` | Agentes, mapas e sites, economia, armas, composições | snapshot |
| `/tropa-ai` | Tropa AI em tela cheia (também abre como painel pelo orbe do header ou Ctrl K) | `POST /api/coach/perguntar` |
| `/prancheta?partida_id=&round=` | Ponto de entrada da prancheta. **O Rhuan troca o conteúdo** mantendo a rota | — |

Todas as telas que mostram partida ou round levam para a prancheta com o link combinado.

## Como está organizado

```
src/
  api/        tipos do contrato, cliente HTTP, fachada de dados (stats.ts), snapshot local e cache (useDados)
  auth/       login com Google pelo Firebase Auth (só a Tropa AI exige)
  coach/      Tropa AI: estado, painel, tela cheia e gráficos montados a partir das tools
  componentes/ header, orbes, busca, cartões de série, selos, estados, links da prancheta
  graficos/   gráficos próprios em SVG (sem biblioteca)
  paginas/    uma tela por arquivo
  estilos/    tokens.css (identidade) e o CSS de cada parte
  rotas.tsx   roteador mínimo sobre a History API
public/snapshot/  dados gerados dos JSONs oficiais (ver docs/dados.md)
scripts/gerar_snapshot.py
```

Mais detalhes:

- [docs/arquitetura.md](docs/arquitetura.md): camadas, fluxo de dados, coach, gráficos e auth.
- [docs/dados.md](docs/dados.md): snapshot, IDs iguais aos da gold e métricas.
- [docs/identidade.md](docs/identidade.md): tokens, componentes e o que não fazer.
- [docs/pedidos.md](docs/pedidos.md): **o que falta no back e na infra** para ligar tudo na API real (gugu, Guilherme, Rhuan).

## Atualizar o snapshot

Com a base em `data/raw` (fora do git), na raiz do repo:

```bash
python3 front/scripts/gerar_snapshot.py --dados data/raw
```

Só biblioteca padrão do Python. Saída em `front/public/snapshot/`.

## Estado

Pronto: todas as telas acima com dados reais, Tropa AI com login, erros (401, 429, 503) e gráficos, busca global (atalho `/`), versão mobile.

Falta, fora desta pasta: rotas da API que ainda não existem, Google habilitado no Firebase Auth e a prancheta do Rhuan. Lista completa em [docs/pedidos.md](docs/pedidos.md).
