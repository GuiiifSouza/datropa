# Dados do front

## Snapshot

`scripts/gerar_snapshot.py` lê os 336 JSONs oficiais e grava em `public/snapshot/`:

| Arquivo | Conteúdo |
|---|---|
| `manifesto.json` | Versão, data de geração, contagens e regras usadas |
| `catalogos.json` | Torneios, mapas (com a transformação de coordenadas de `mapas.sql`), agentes e armas |
| `partidas.json` | Um item por mapa jogado: torneio, mapa, início, duração, times, placar, vencedor |
| `times.json`, `jogadores.json` | Nome de exibição por ID |
| `jogador_partida.json` | Uma linha por jogador e mapa: K/D/A, score, rounds, dano, tiros, FB, FD, KAST, multikills |
| `rounds.json` | Uma linha por round: vencedor, atacante, lado, resultado, site do plant, equipamento e compra de cada time, time do first blood, placar |
| `armas_kills.json` | Abates por arma na base toda |

`jogador_partida.json` e `rounds.json` são colunares (`{colunas, linhas}`), com a partida e o jogador como índice nas listas e o time como `a`/`b` da partida. `src/api/snapshot.ts` decodifica.

Não há JSON bruto, só agregados.

## IDs iguais aos da gold

Seguem `services/stats/sql/gold/oficial/partidas.sql` e `stats_jogador_partida.sql`:

| ID | Regra |
|---|---|
| `partida_id` | `matchInfo.matchId` |
| `mapa_id` | último trecho de `matchInfo.mapId` em minúsculas (`jam` é Lotus) |
| `torneio_id` | prefixo do nome do arquivo (`UNIVAVA_G`, `RUSH2`, …) |
| `time_id` | `time_` + sha256 do slug do time no nome do arquivo (minúsculo, NFC) |
| `jogador_id` | `puuid` |
| `agente_id` | `characterId` em minúsculas |

O nome do time segue o `INITCAP` da gold (`Ufmt Turuna`); o front corrige as siglas só na exibição (`nomeTime()`).

## Métricas

| Métrica | Regra |
|---|---|
| K/D | kills ÷ deaths do recorte; deaths 0 → null |
| ADR | dano em adversários ÷ rounds |
| HS% | headshots ÷ (head + body + leg) dos registros de dano |
| ACS | score ÷ rounds |
| KAST | rounds com abate, assistência, sobrevivência ou morte trocada em até 5 s ÷ rounds. **Estimado** (não vem pronto da base) |
| First blood / death | primeiro abate válido do round (entre times diferentes, tempo ≥ 0) |
| Multikill | rounds com 3, 4 ou 5 abates do jogador |
| Compra | `equipamento_time_10000_20000_pistol_v2`: rounds 1 e 13 pistol; eco < 10 mil; force < 20 mil; full ≥ 20 mil (soma dos cinco) |
| Pós-plant | ataque venceu entre os rounds em que plantou |
| Retake | defesa venceu entre os rounds em que sofreu plant. Mede o resultado, não prova tentativa |
| Lado | atacante pelo `winningTeamRole` do round, inclusive na prorrogação |

Agregações sempre pelos totais do recorte. Filtro de data usa o dia UTC de início (igual à API); o agrupamento em séries usa o dia de Brasília.

## Séries

A base não tem ID de série. O front agrupa mapas do mesmo torneio, mesmo dia (Brasília) e mesmo par de times. O ID da série é o primeiro mapa. Isso dá 293 séries: 259 de um mapa, 25 de dois e 9 de três.

## Conferência

Números do snapshot batem com `docs/dados.md` da raiz e com a análise feita nos artboards: 336 mapas, 6.618 rounds, 46.371 abates, 68 times, 411 jogadores, 19 prorrogações, ataque vence 51,8% dos rounds, first blood converte 71,3%, eco vence 16,8%.
