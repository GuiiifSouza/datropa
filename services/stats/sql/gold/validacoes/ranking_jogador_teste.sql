-- Referencia nos 336 JSONs: 411 jogadores; 3360 participacoes.
SELECT COUNT(*) AS jogadores,
  COUNT(DISTINCT jogador_id) AS ids_unicos,
  SUM(partidas) AS participacoes,
  SUM(rounds) AS rounds_jogador,
  SUM(kills) AS kills, SUM(deaths) AS deaths, SUM(assists) AS assists,
  SUM(dano_total) AS dano_total, SUM(first_bloods) AS first_bloods,
  SUM(registros_com_alerta) AS alertas,
  COUNTIF(kd IS DISTINCT FROM SAFE_DIVIDE(kills, deaths)) AS kd_incorreto,
  COUNTIF(adr IS DISTINCT FROM SAFE_DIVIDE(dano_total, rounds)) AS adr_incorreto,
  COUNTIF(hs_pct IS DISTINCT FROM 100.0 * SAFE_DIVIDE(headshots, headshots + bodyshots + legshots)) AS hs_incorreto,
  COUNTIF(times_distintos > 1 AND time_id IS NOT NULL) AS time_atribuido_indevidamente
FROM `datropa.valorant.chico_teste_ranking_jogador`;
