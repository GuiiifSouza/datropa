-- Esperado: 68 gerais + 264 time/mapa = 332 linhas.
SELECT
  COUNT(*) AS linhas,
  COUNT(DISTINCT TO_JSON_STRING(STRUCT(time_id, mapa_id, escopo))) AS chaves_unicas,
  COUNTIF(escopo = 'geral') AS times_gerais,
  COUNTIF(escopo = 'mapa') AS recortes_time_mapa,
  SUM(IF(escopo = 'geral', partidas, 0)) AS participacoes_gerais,
  SUM(IF(escopo = 'mapa', partidas, 0)) AS participacoes_por_mapa,
  SUM(IF(escopo = 'geral', vitorias, 0)) AS vitorias,
  SUM(IF(escopo = 'geral', derrotas, 0)) AS derrotas,
  SUM(IF(escopo = 'geral', rounds_jogados, 0)) AS rounds_times,
  SUM(registros_com_alerta) AS alertas,
  COUNTIF(vitorias + derrotas + empates != partidas) AS resultados_inconsistentes,
  COUNTIF(taxa_vitoria_pct IS DISTINCT FROM 100.0 * SAFE_DIVIDE(vitorias, partidas)) AS taxas_incorretas
FROM `datropa.valorant.stats_time`;
