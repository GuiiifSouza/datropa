-- Totais independentes conferidos nos 336 JSONs. Nao usar media de ADR/HS%.
SELECT COUNT(*) AS linhas,
  COUNT(DISTINCT TO_JSON_STRING(STRUCT(partida_id, jogador_id))) AS chaves_unicas,
  COUNT(DISTINCT partida_id) AS partidas,
  COUNTIF(status_qualidade != 'ok') AS alertas,
  SUM(rounds) AS rounds_jogador,
  SUM(kills) AS kills, SUM(deaths) AS deaths, SUM(assists) AS assists,
  SUM(dano_total) AS dano_total, SUM(first_bloods) AS first_bloods,
  COUNTIF(kd IS DISTINCT FROM SAFE_DIVIDE(kills, deaths)) AS kd_incorreto,
  COUNTIF(hs_pct < 0 OR hs_pct > 100) AS hs_fora_da_faixa,
  COUNTIF(kills IS DISTINCT FROM kills_eventos) AS diferencas_kills,
  COUNTIF(deaths IS DISTINCT FROM deaths_eventos) AS diferencas_deaths,
  COUNTIF(assists IS DISTINCT FROM assists_eventos) AS diferencas_assists
FROM `datropa.valorant.chico_teste_stats_jogador_partida`;
