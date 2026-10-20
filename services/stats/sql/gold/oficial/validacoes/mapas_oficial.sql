-- Esperado: 10 mapas, 336 partidas, 10 matrizes e validacoes de plants; zero sem calibracao.
-- Transformacao publica ainda NULL ate alinhar a convencao de eixos na API.
SELECT COUNT(*) AS mapas, COUNT(DISTINCT id) AS ids_unicos,
  SUM(partidas) AS partidas,
  COUNTIF(transformacao_candidata IS NOT NULL) AS matrizes_disponiveis,
  COUNTIF(status_calibracao = 'sem_calibracao') AS sem_calibracao,
  COUNTIF(calibracao_validada) AS calibracoes_validadas,
  COUNTIF(escopo_validacao = 'plants_visual_chico_2026_10_20') AS mapas_com_plants_conferidos,
  COUNTIF(transformacao IS NOT NULL) AS transformacoes_publicadas,
  COUNTIF(status_qualidade != 'ok') AS alertas,
  (SELECT COUNT(*) FROM `datropa.valorant.eventos_round` e
    LEFT JOIN `datropa.valorant.mapas` m ON m.id = e.mapa_id
    WHERE m.id IS NULL) AS eventos_sem_mapa
FROM `datropa.valorant.mapas`;
