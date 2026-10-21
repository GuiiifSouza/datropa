-- Apenas leitura da primeira tabela de teste.
SELECT COUNT(*) AS linhas,
  COUNT(DISTINCT partida_id) AS partidas_unicas,
  COUNTIF(status_qualidade != 'ok') AS partidas_com_alerta,
  COUNTIF(cor_time_a IS NULL OR cor_time_b IS NULL) AS cores_nao_resolvidas,
  COUNTIF(time_a_id IS NULL OR time_b_id IS NULL) AS times_sem_id,
  COUNTIF(inicio IS NULL) AS partidas_sem_inicio,
  SUM(rounds_jogados) AS rounds_totais
FROM `datropa.valorant.partidas`;
