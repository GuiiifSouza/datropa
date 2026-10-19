# Base de partidas

A organização do hackathon fornece todas as partidas em JSON. É a única fonte de dados de partida permitida: nada de Riot API, trackers ou scraping para completar.

## Onde baixar

Pasta no Drive: [Dados .Json](https://drive.google.com/drive/folders/1IuptLxv1FpcvrfB6a7z9bEqPNYSsQ-hW). Baixe para `data/raw/`, que fica fora do git:

```bash
uvx gdown --folder "https://drive.google.com/drive/folders/1IuptLxv1FpcvrfB6a7z9bEqPNYSsQ-hW" -O data/raw
```

São cerca de 100 MB e o download leva alguns minutos.

## Organização

```
Dados .Json/
  Univavá/
    Classificatória 1/
    Classificatória 2/
    Classificatória 3/
    Classificatória 4/
  Rush Series Esquenta/
  Rush Series Esquenta 2/
  Rush Series Inclusivo/
```

Um arquivo por mapa jogado. O nome segue o padrão:

```
<TORNEIO>_<SEQ>_<DD-MM-AA>_<time_a>_<placar_a>_x_<placar_b>_<time_b>_<mapa>.json
UNIVAVA_C2_012_25-07-26_ufmt_turuna_13_x_8_unicamp_tritons_black_lotus.json
RUSHE_030b_07-06-26_azure_bears_golden_13_x_4_ceub_octopus_vulgaris_ascent.json
```

- `TORNEIO`: `UNIVAVA_C1` a `UNIVAVA_C4`, `RUSHE` (Esquenta), `RUSH2` (Esquenta 2) e `RUSH_INCLUSIVO`.
- `SEQ` pode ter letra (`030b`): mais de um mapa no mesmo confronto.
- Para separar os times, divida em `_x_`. O mapa é sempre o último token.

## Números da base

Contagem feita em 19/10/2026 sobre o que já tinha baixado.

| Item | Quantidade |
|---|---|
| Partidas (mapas) | 196 |
| Times | 56 |
| Jogadores únicos (`puuid`) | 323 |
| Rounds | ~3.600 |
| Abates | ~25.600 |
| Período | 06/06/2026 a 15/08/2026 |
| Versões do jogo | 12.10 a 13.02 |

## Formato do JSON

É o formato da API de partidas da Riot (match-v1). Campos principais:

```
matchInfo        id, mapa, versão, duração, início, modo
players[]        puuid, nick#tag, time (Red/Blue), agente, stats da partida
coaches[]        puuid e time do coach, quando houver
teams[]          Red/Blue, venceu, rounds ganhos
roundResults[]   um por round
  roundResult, roundResultCode, winningTeam, winningTeamRole
  bombPlanter, plantSite, plantRoundTime, plantLocation, plantPlayerLocations
  bombDefuser, defuseRoundTime, defuseLocation
  playerStats[]  um por jogador
    kills[]      tempo, matador, vítima, assistências, posição de todos, arma
    damage[]     alvo, dano, cabeça/corpo/perna
    economy      valor do loadout, arma, armadura, gasto, sobra
    score
```

Dá para tirar: K/D/A, ADR, headshot %, first blood, trades, clutch, economia por round (eco, force, full buy), pós-plant, retake, mapa de calor de abates e plants, composição de agentes, lado ataque/defesa.

## Armadilhas

**Mapa vem com codinome interno.** `mapId` traz o nome de desenvolvimento, não o público:

| `mapId` | Mapa |
|---|---|
| `Ascent` | Ascent |
| `Bonsai` | Split |
| `Triad` | Haven |
| `Jam` | Lotus |
| `Foxtrot` | Breeze |
| `Canyon` | Fracture |
| `Pitt` | Pearl |
| `Juliett` | Sunset |
| `Plummet` | Summit |

**Agente, arma e armadura vêm como UUID.** `characterId`, `economy.weapon`, `economy.armor` e `finishingDamage.damageItem` precisam de tabela de tradução. Montar essa tabela a partir de dado estático público do jogo não é dado de partida, mas confirme com a organização antes de usar fonte externa. Se não puder, monte a tabela à mão: são 27 agentes e cerca de 20 armas na base.

**Nome do time só no arquivo.** O JSON não traz nome de time. `teamId` é `Red` ou `Blue` e não diz quem é quem. Para ligar a cor ao time:
1. o placar do arquivo bate com `teams[].roundsWon`;
2. confira pelos `puuid` dos jogadores, que se repetem entre partidas do mesmo time.

**Nomes de time mudam de grafia.** A mesma faculdade pode ter mais de um time (`azure_bears_golden`, `azure_bears_black`). Não junte por prefixo.

**`roundResultCode` vazio.** Acontece quando o tempo do round acaba sem plant (`roundResult = "Round timer expired"`). Vitória da defesa.

**`ability*Effects` vem `null`.** Só existe a contagem de uso de habilidade por partida (`players[].stats.abilityCasts`), não por round.

**Observadores.** Alguns `players` têm `isObserver: true`. Tire antes de calcular estatística.

**`competitiveTier` é 0** em todas as partidas (são custom games). Não dá para usar elo.

**`roundNum` começa em 0.** O round 12 (índice) é o primeiro depois da troca de lado.
