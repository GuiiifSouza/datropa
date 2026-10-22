# O que o front precisa de fora desta pasta

As telas usam a API real (`/api/stats`). O que a API ainda não manda vem do snapshot, casado pelo ID (mesmos IDs da gold), e só preenche campo ausente. Esta lista é o que falta para o snapshot sair de cena. Cada item diz quem faz e o que o front já está esperando.

## Guilherme (infra, deploy, coach)

| # | Pedido | Por quê |
|---|---|---|
| 1 | Habilitar o provedor **Google** no Firebase Authentication e conferir `devs.datropa.com` nos domínios autorizados | Login da Tropa AI (`signInWithPopup`) |
| 2 | Atualizar o `AGENTS.md` da raiz e o `docs/plano-de-acao.md` com a troca Lhobregat ↔ RhuanK | Hoje dizem que a prancheta é do Lhobregat |
| 3 | Confirmar o link da prancheta `/prancheta?partida_id=<id>&round=<n>` em `abrir_na_prancheta` | O front já usa esse caminho em todas as telas |
| 4 | (Opcional) Cache longo para `/snapshot/**` no `firebase.json`, se quiser | Hoje cai no `no-cache` geral, o que está certo enquanto o snapshot muda |
| 5 | (Opcional) Campo `grafico` na resposta do coach, com o nome da tool principal | O front já monta gráfico por tool; o campo só ajudaria a escolher qual mostrar primeiro |

## gugu (API de stats)

Todas as rotas do contrato que o front chama já respondem em produção (conferido em 22/10): `/catalogos`, `/busca`, `/ranking`, `/times`, `/times/{id}` (e `/economia`, `/pos-plant-retake`), `/composicoes`, `/comparacoes/times`, `/partidas`, `/partidas/{id}` e `/partidas/{id}/rounds/{round}/eventos`.

Campos que o front mostra e que o contrato ainda não tem (hoje vêm do snapshot pelo ID; quando a API mandar, o valor dela vale):

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
