# O que o front precisa de fora desta pasta

O site funciona inteiro com o snapshot. Esta lista é o que falta para cada tela usar a API real e para o login e o deploy fecharem. Cada item diz quem faz e o que o front já está esperando.

## Guilherme (infra, deploy, coach)

| # | Pedido | Por quê |
|---|---|---|
| 1 | Rodar `npm install` em `front/` e commitar o `package-lock.json` | O `deploy-front` roda `npm ci`, que exige o lockfile. Ele não foi gerado aqui porque o ambiente deste PR não tinha acesso ao registro do npm |
| 2 | Habilitar o provedor **Google** no Firebase Authentication e conferir `devs.datropa.com` nos domínios autorizados | Login da Tropa AI (`signInWithPopup`) |
| 3 | Atualizar o `AGENTS.md` da raiz e o `docs/plano-de-acao.md` com a troca Lhobregat ↔ RhuanK | Hoje dizem que a prancheta é do Lhobregat |
| 4 | Confirmar o link da prancheta `/prancheta?partida_id=<id>&round=<n>` em `abrir_na_prancheta` | O front já usa esse caminho em todas as telas |
| 5 | (Opcional) Cache longo para `/snapshot/**` no `firebase.json`, se quiser | Hoje cai no `no-cache` geral, o que está certo enquanto o snapshot muda |
| 6 | (Opcional) Campo `grafico` na resposta do coach, com o nome da tool principal | O front já monta gráfico por tool; o campo só ajudaria a escolher qual mostrar primeiro |

## gugu (API de stats)

Rotas do contrato que o front já chama e que ainda não estão na `main`:

| Rota | Tela |
|---|---|
| `GET /catalogos` | nomes de mapa, agente e torneio em todo o site |
| `GET /busca` | busca global do header |
| `GET /times/{id}/pos-plant-retake` | página do time |
| `GET /composicoes` | página do time e meta |
| `GET /comparacoes/times` | (pronto no front, usado pela Tropa AI no futuro) |
| `GET /partidas/{id}/rounds/{round}/eventos` | prancheta (Rhuan) |

Campos que o front mostra e que o contrato ainda não tem (o snapshot já entrega; sem eles, a tela mostra "—"):

| Onde | Campo | Regra |
|---|---|---|
| `/ranking`, `/jogadores/{id}` resumo, `/partidas/{id}` jogadores | `acs` | score ÷ rounds |
| idem | `kast_pct` | rounds com abate, assistência, sobrevivência ou troca em até 5 s ÷ rounds |
| idem | `first_deaths`, `multikills {k3, k4, k5}` | ver [dados.md](dados.md) |
| `/ranking` | `vitorias`, `taxa_vitoria_pct`, `agentes_top` (3 IDs) | |
| `/ranking` | ordens `acs_desc`, `kast_desc`, `fb_desc`, `hs_desc` | hoje o front ordena essas sozinho |
| `/jogadores/{id}` | `tag`, `agentes[].kd`, `agentes[].acs`, `mapas[].acs`, `partidas_recentes[]` | |
| `/partidas` e `/partidas/{id}` | `rounds` (quantidade), `duracao_ms`, `versao` | |
| `/partidas/{id}` rounds | `atacante_id`, `plant_site`, `compras {time_id: tipo}`, `equipamento {time_id: valor}`, `placar {time_id: n}`, `first_blood_time_id` | livro de rounds, economia round a round, "abriu e venceu" |

Rotas novas que hoje só existem no snapshot (sugestão de formato no próprio `src/api/tipos.ts`):

| Proposta | Tipo no front | Tela |
|---|---|---|
| `GET /panorama` | `Panorama` | página inicial |
| `GET /meta` (agentes com pick e vitória, mapas com lado e sites, armas, economia) | `MetaCena` | meta |
| `serie_id` em `/partidas` (ou `GET /series`) | `Serie` | partidas e partida |

## RhuanK (prancheta)

- A rota `/prancheta` e o arquivo `src/paginas/Prancheta.tsx` estão reservados. Troque o conteúdo e mantenha os parâmetros `partida_id` e `round` (base 1).
- Todas as telas usam `linkPrancheta(partidaId, round)` de `src/componentes/Prancheta.tsx`.
- Dados do round: `GET /api/stats/partidas/{id}/rounds/{round}/eventos`. A transformação de coordenadas já está em `catalogos.json` do snapshot, igual à gold.
- O orbe "Prancheta" do header leva para `/prancheta` sem parâmetros: vale mostrar a escolha de partida ali.

## Organização do hackathon

- OK para usar arte de agente e minimapa (política de IP da Riot). O código já suporta: com `VITE_ARTE_RIOT=1` e os arquivos em `public/arte/agentes/{rosto,corpo}/<agente>.webp`, os rostos aparecem no lugar das iniciais.
