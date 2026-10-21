-- Esperado: 672 linhas, 336 partidas, 68 times; 4653 oportunidades por lado.
WITH base AS (
  SELECT * FROM `datropa.valorant.pos_plant_retake_partida`
), por_partida AS (
  SELECT partida_id,
    SUM(pos_plant_oportunidades) AS ataques, SUM(retake_oportunidades) AS defesas,
    SUM(pos_plant_vitorias + retake_vitorias) AS vitorias
  FROM base GROUP BY partida_id
)
SELECT COUNT(*) AS linhas,
  COUNT(DISTINCT TO_JSON_STRING(STRUCT(partida_id, time_id))) AS chaves_unicas,
  COUNT(DISTINCT partida_id) AS partidas, COUNT(DISTINCT time_id) AS times,
  SUM(rounds_contabilizados) AS rounds_times,
  SUM(pos_plant_oportunidades) AS pos_plant_oportunidades,
  SUM(pos_plant_vitorias) AS pos_plant_vitorias,
  SUM(retake_oportunidades) AS retake_oportunidades,
  SUM(retake_vitorias) AS retake_vitorias,
  SUM(desarmes) AS desarmes,
  SUM(vitorias_defesa_pos_plant_sem_desarme) AS vitorias_defesa_sem_desarme,
  SUM(vitorias_defesa_pos_plant_por_tempo) AS vitorias_defesa_por_tempo,
  COUNTIF(status_qualidade != 'ok') AS alertas,
  COUNTIF(pos_plant_vitorias > pos_plant_oportunidades OR retake_vitorias > retake_oportunidades
    OR retake_vitorias != desarmes + vitorias_defesa_pos_plant_sem_desarme) AS contadores_inconsistentes,
  COUNTIF(
    (pos_plant_oportunidades = 0 AND pos_plant_taxa_sucesso_pct IS NOT NULL)
    OR (pos_plant_oportunidades > 0 AND (pos_plant_taxa_sucesso_pct IS NULL
      OR ABS(pos_plant_taxa_sucesso_pct - 100.0*SAFE_DIVIDE(pos_plant_vitorias,pos_plant_oportunidades)) > 0.000001))
    OR (retake_oportunidades = 0 AND retake_taxa_sucesso_pct IS NOT NULL)
    OR (retake_oportunidades > 0 AND (retake_taxa_sucesso_pct IS NULL
      OR ABS(retake_taxa_sucesso_pct - 100.0*SAFE_DIVIDE(retake_vitorias,retake_oportunidades)) > 0.000001))
  ) AS taxas_incorretas,
  (SELECT COUNTIF(ataques != defesas OR vitorias != ataques) FROM por_partida) AS partidas_inconsistentes
FROM base;
