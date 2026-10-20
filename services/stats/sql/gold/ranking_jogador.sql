-- Ranking geral, sem filtros, uma linha por jogador.
-- Para filtros da API, filtrar stats_jogador_partida ANTES de agregar.
-- Dependencia de teste; publicacao final pendente.
WITH totais AS (
  SELECT jogador_id,
    (ARRAY_AGG(STRUCT(nome, tag) ORDER BY inicio DESC, partida_id DESC LIMIT 1))[OFFSET(0)] AS identidade,
    IF(COUNT(DISTINCT time_id) = 1, MAX(time_id), NULL) AS time_id,
    COUNT(DISTINCT time_id) AS times_distintos,
    COUNT(DISTINCT partida_id) AS partidas,
    SUM(rounds) AS rounds, SUM(kills) AS kills,
    SUM(deaths) AS deaths, SUM(assists) AS assists,
    SUM(dano_total) AS dano_total, SUM(headshots) AS headshots,
    SUM(bodyshots) AS bodyshots, SUM(legshots) AS legshots,
    SUM(first_bloods) AS first_bloods, SUM(first_deaths) AS first_deaths,
    COUNTIF(status_qualidade != 'ok' OR status_qualidade IS NULL) AS registros_com_alerta,
    MAX(inicio) AS ultima_partida_em
  FROM `datropa.valorant.chico_teste_stats_jogador_partida`
  GROUP BY jogador_id
)
SELECT jogador_id, identidade.nome AS nome, identidade.tag AS tag,
  time_id, times_distintos, partidas, rounds, kills, deaths, assists,
  SAFE_DIVIDE(kills, deaths) AS kd,
  IF(registros_com_alerta = 0, SAFE_DIVIDE(dano_total, rounds), NULL) AS adr,
  IF(registros_com_alerta = 0,
    100.0 * SAFE_DIVIDE(headshots, headshots + bodyshots + legshots), NULL) AS hs_pct,
  first_bloods, first_deaths, dano_total, headshots, bodyshots, legshots,
  registros_com_alerta, ultima_partida_em
FROM totais;
