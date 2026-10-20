-- Referencia independente nos 336 JSONs: 672 linhas, 68 times.
SELECT COUNT(*) AS linhas,
  COUNT(DISTINCT TO_JSON_STRING(STRUCT(partida_id, time_id))) AS chaves_unicas,
  COUNT(DISTINCT partida_id) AS partidas, COUNT(DISTINCT time_id) AS times,
  COUNTIF(venceu) AS vitorias, COUNTIF(perdeu) AS derrotas, COUNTIF(empate) AS empates,
  COUNTIF(status_qualidade != 'ok') AS alertas,
  SUM(rounds_jogados) AS rounds_times,
  SUM(rounds_ganhos) AS rounds_ganhos,
  SUM(rounds_ataque) AS rounds_ataque,
  SUM(rounds_defesa) AS rounds_defesa,
  SUM(vitorias_ataque) AS vitorias_ataque,
  SUM(vitorias_defesa) AS vitorias_defesa,
  COUNTIF(rounds_ataque + rounds_defesa != rounds_jogados) AS lados_inconsistentes,
  COUNTIF(vitorias_ataque + vitorias_defesa != rounds_ganhos) AS vitorias_inconsistentes
FROM `datropa.valorant.stats_time_partida`;
