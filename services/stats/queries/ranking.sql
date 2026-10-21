SELECT
  jogador_id,
  nome,
  time_id,
  partidas,
  rounds,
  kills,
  deaths,
  assists,
  kd,
  adr,
  hs_pct,
  first_bloods
FROM `datropa.valorant.ranking_jogador`
ORDER BY kills DESC NULLS LAST, jogador_id
LIMIT @limite OFFSET @deslocamento
