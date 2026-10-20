-- VERSAO OFICIAL gold_336_v1. Destino: datropa.valorant.stats_mapa
-- Fontes e validacoes de teste preservadas na pasta superior.
-- Uma linha por mapa interno. Nome publico derivado do arquivo oficial.
-- Filtros de torneio/data devem ser aplicados em partidas antes de agregar.
SELECT mapa_id,
  ANY_VALUE(INITCAP(mapa_arquivo)) AS nome,
  COUNT(DISTINCT partida_id) AS partidas,
  SUM(rounds_jogados) AS rounds_jogados,
  COUNTIF(status_qualidade != 'ok' OR status_qualidade IS NULL) AS registros_com_alerta,
  COUNT(DISTINCT mapa_arquivo) AS grafias_nome_distintas
FROM `datropa.valorant.partidas`
GROUP BY mapa_id;
