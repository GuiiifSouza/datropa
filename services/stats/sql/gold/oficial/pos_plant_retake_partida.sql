-- VERSAO OFICIAL gold_336_v1. Destino: datropa.valorant.pos_plant_retake_partida
-- Fontes e validacoes de teste preservadas na pasta superior.
-- Uma linha por time/partida, inclusive quando nao houve plant.
-- Retake = vitoria da defesa apos plant, nao evidencia de tentativa.
WITH por_round AS (
  SELECT r.partida_id, r.`round`, r.tem_plant, r.teve_desarme,
    r.resultado, r.vencedor_id, r.status_qualidade,
    t.time_id, t.lado,
    r.atacante_id, r.defensor_id
  FROM `datropa.valorant.rounds` r
  CROSS JOIN UNNEST([
    STRUCT(r.atacante_id AS time_id, 'ataque' AS lado),
    STRUCT(r.defensor_id AS time_id, 'defesa' AS lado)
  ]) t
), contadores AS (
  SELECT partida_id, time_id,
    COUNT(*) AS rounds_contabilizados,
    COUNTIF(tem_plant AND lado = 'ataque') AS pos_plant_oportunidades,
    COUNTIF(tem_plant AND lado = 'ataque' AND vencedor_id = time_id) AS pos_plant_vitorias,
    COUNTIF(tem_plant AND lado = 'defesa') AS retake_oportunidades,
    COUNTIF(tem_plant AND lado = 'defesa' AND vencedor_id = time_id) AS retake_vitorias,
    COUNTIF(tem_plant AND lado = 'defesa' AND teve_desarme) AS desarmes,
    COUNTIF(tem_plant AND lado = 'defesa' AND vencedor_id = time_id AND NOT teve_desarme) AS vitorias_defesa_pos_plant_sem_desarme,
    COUNTIF(tem_plant AND lado = 'defesa' AND vencedor_id = time_id AND resultado = 'tempo') AS vitorias_defesa_pos_plant_por_tempo,
    COUNTIF(status_qualidade IS NULL OR status_qualidade != 'ok'
      OR vencedor_id IS NULL OR atacante_id IS NULL OR defensor_id IS NULL
      OR atacante_id = defensor_id
      OR vencedor_id NOT IN (atacante_id, defensor_id)) AS rounds_com_alerta
  FROM por_round
  GROUP BY partida_id, time_id
), base AS (
  SELECT t.partida_id, t.torneio_id, t.mapa_id, t.inicio, t.data_partida_utc,
    t.time_id, t.nome, t.adversario_id,
    COALESCE(c.rounds_contabilizados, 0) AS rounds_contabilizados,
    COALESCE(c.pos_plant_oportunidades, 0) AS pos_plant_oportunidades,
    COALESCE(c.pos_plant_vitorias, 0) AS pos_plant_vitorias,
    COALESCE(c.retake_oportunidades, 0) AS retake_oportunidades,
    COALESCE(c.retake_vitorias, 0) AS retake_vitorias,
    COALESCE(c.desarmes, 0) AS desarmes,
    COALESCE(c.vitorias_defesa_pos_plant_sem_desarme, 0) AS vitorias_defesa_pos_plant_sem_desarme,
    COALESCE(c.vitorias_defesa_pos_plant_por_tempo, 0) AS vitorias_defesa_pos_plant_por_tempo,
    COALESCE(c.rounds_com_alerta, 0) AS rounds_com_alerta,
    CASE WHEN t.status_qualidade IS NULL OR t.status_qualidade != 'ok' THEN 'time_partida_com_alerta'
      WHEN c.rounds_contabilizados IS NULL OR c.rounds_contabilizados != t.rounds_jogados THEN 'rounds_divergentes'
      WHEN c.rounds_com_alerta > 0 THEN 'round_com_alerta'
      ELSE 'ok' END AS status_qualidade
  FROM `datropa.valorant.stats_time_partida` t
  LEFT JOIN contadores c ON c.partida_id = t.partida_id AND c.time_id = t.time_id
)
SELECT *,
  100.0 * SAFE_DIVIDE(pos_plant_vitorias, pos_plant_oportunidades) AS pos_plant_taxa_sucesso_pct,
  100.0 * SAFE_DIVIDE(retake_vitorias, retake_oportunidades) AS retake_taxa_sucesso_pct,
  'resultado_apos_plant_v1' AS metrica_versao
FROM base;
