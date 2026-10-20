-- Esperado: 10 mapas, 336 partidas, 9 candidatos, 1 sem calibracao.
SELECT COUNT(*) AS mapas, COUNT(DISTINCT id) AS ids_unicos,
  SUM(partidas) AS partidas,
  COUNTIF(transformacao_candidata IS NOT NULL) AS candidatos_pdf,
  COUNTIF(status_calibracao = 'sem_calibracao') AS sem_calibracao,
  COUNTIF(calibracao_validada) AS calibracoes_validadas,
  COUNTIF(transformacao IS NOT NULL) AS transformacoes_publicadas,
  COUNTIF(status_qualidade != 'ok') AS alertas,
  (SELECT COUNT(*) FROM `datropa.valorant.chico_teste_eventos_round` e
    LEFT JOIN `datropa.valorant.chico_teste_mapas` m ON m.id = e.mapa_id
    WHERE m.id IS NULL) AS eventos_sem_mapa
FROM `datropa.valorant.chico_teste_mapas`;
