-- Catalogo dos mapas presentes na base. Nao publica calibracao nao validada.
WITH referencia AS (
  SELECT * FROM UNNEST([
    STRUCT('ascent' AS mapa_id, 'Ascent' AS nome, 0.00007 AS xm, -0.00007 AS ym, 0.813895 AS xa, 0.573242 AS ya),
    STRUCT('bonsai', 'Split', 0.000078, -0.000078, 0.842188, 0.697578),
    STRUCT('canyon', 'Fracture', 0.000078, -0.000078, 0.556952, 1.155886),
    STRUCT('foxtrot', 'Breeze', 0.00007, -0.00007, 0.465123, 0.833078),
    STRUCT('infinity', 'Abyss', 0.000081, -0.000081, 0.5, 0.5),
    STRUCT('jam', 'Lotus', 0.000072, -0.000072, 0.454789, 0.917752),
    STRUCT('juliett', 'Sunset', 0.000078, -0.000078, 0.5, 0.515625),
    STRUCT('pitt', 'Pearl', 0.000078, -0.000078, 0.480469, 0.916016),
    STRUCT('triad', 'Haven', 0.000075, -0.000075, 1.09345, 0.642728),
    STRUCT('plummet', 'Summit', 0.000075, -0.000075, 0.047401, 0.978891)
  ])
), presentes AS (
  SELECT mapa_id, MIN(mapa_id_origem) AS mapa_id_origem,
    COUNT(DISTINCT mapa_id_origem) AS variantes_origem,
    COUNT(*) AS partidas
  FROM `datropa.valorant.chico_teste_partidas`
  GROUP BY mapa_id
)
SELECT p.mapa_id AS id, p.mapa_id, p.mapa_id_origem, r.nome, p.partidas,
  IF(p.mapa_id = 'plummet',
    'https://media.valorant-api.com/maps/756da597-416b-c0f2-f47b-afbdf28670bc/displayicon.png',
    CAST(NULL AS STRING)) AS minimapa_url,
  -- Campo publico do contrato: indisponivel ate validar com o front.
  CAST(NULL AS STRUCT<x_multiplier FLOAT64, x_offset FLOAT64,
    y_multiplier FLOAT64, y_offset FLOAT64>) AS transformacao,
  IF(r.xm IS NULL, NULL,
    STRUCT(0.0 AS u_x, r.xm AS u_y, r.xa AS u_offset,
      r.ym AS v_x, 0.0 AS v_y, r.ya AS v_offset)) AS transformacao_candidata,
  CASE WHEN r.xm IS NULL THEN NULL
    WHEN p.mapa_id = 'plummet' THEN 'valorant_api_plummet_2026_10_20'
    ELSE 'raio_x_pdf_2026_10_20' END AS fonte_candidata,
  r.nome IS NOT NULL AND r.xm IS NOT NULL AS calibracao_validada,
  IF(r.nome IS NOT NULL AND r.xm IS NOT NULL,
    'plants_visual_chico_2026_10_20', NULL) AS escopo_validacao,
  CASE WHEN r.nome IS NULL THEN 'mapa_sem_referencia'
    WHEN r.xm IS NULL THEN 'sem_calibracao'
    ELSE 'plants_validados_contrato_pendente' END AS status_calibracao,
  CASE WHEN r.nome IS NULL THEN 'mapa_sem_referencia'
    WHEN p.variantes_origem != 1 THEN 'origem_ambigua'
    ELSE 'ok' END AS status_qualidade
FROM presentes p
LEFT JOIN referencia r USING (mapa_id);
