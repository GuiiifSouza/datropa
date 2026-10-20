-- Esperado: 13236 linhas, 336 partidas, 68 times; sem faltantes na base atual.
SELECT COUNT(*) AS linhas,
  COUNT(DISTINCT TO_JSON_STRING(STRUCT(partida_id, round_indice_origem, time_id))) AS chaves_unicas,
  COUNT(DISTINCT partida_id) AS partidas, COUNT(DISTINCT time_id) AS times,
  COUNTIF(lado = 'ataque') AS rounds_ataque, COUNTIF(lado = 'defesa') AS rounds_defesa,
  COUNTIF(venceu) AS vitorias,
  COUNTIF(categoria = 'eco') AS rounds_eco, COUNTIF(categoria = 'force') AS rounds_force, COUNTIF(categoria = 'full') AS rounds_full,
  COUNTIF(categoria = 'eco' AND venceu) AS vitorias_eco,
  COUNTIF(categoria = 'force' AND venceu) AS vitorias_force,
  COUNTIF(categoria = 'full' AND venceu) AS vitorias_full,
  COUNTIF(categoria IS NULL) AS rounds_sem_classificacao,
  COUNTIF(NOT COALESCE(economia_completa, FALSE)) AS economia_incompleta,
  COUNTIF(status_qualidade != 'ok') AS alertas,
  COUNTIF((categoria = 'eco' AND NOT (equipamento_total >= 0 AND equipamento_total < 10000))
    OR (categoria = 'force' AND NOT (equipamento_total >= 10000 AND equipamento_total < 20000))
    OR (categoria = 'full' AND NOT (equipamento_total >= 20000))
    OR (categoria IS NOT NULL AND (NOT COALESCE(economia_completa,FALSE) OR equipamento_total IS NULL))
    OR (categoria IS NULL AND status_qualidade = 'ok')) AS classificacoes_inconsistentes,
  (SELECT COUNT(*) FROM (
    SELECT partida_id, round_indice_origem
    FROM `datropa.valorant.chico_teste_economia_time_round`
    GROUP BY partida_id, round_indice_origem
    HAVING COUNT(*) != 2 OR COUNT(DISTINCT time_id) != 2 OR COUNTIF(venceu) != 1
  )) AS rounds_inconsistentes
FROM `datropa.valorant.chico_teste_economia_time_round`;
