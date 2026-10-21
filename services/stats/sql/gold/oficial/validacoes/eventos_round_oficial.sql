-- Referencia independente: 52755 eventos: 46753 mortes/abates + 4653 plants + 1349 desarmes.
SELECT COUNT(*) AS eventos,
  COUNT(DISTINCT id) AS ids_unicos, COUNT(DISTINCT partida_id) AS partidas,
  COUNTIF(tipo = 'abate') AS abates, COUNTIF(tipo = 'plant') AS plants,
  COUNTIF(tipo = 'defuse') AS desarmes,
  COUNTIF(self_kill) AS self_kills,
  COUNTIF(fogo_amigo) AS fogo_amigo,
  COUNTIF(abate_adversario) AS abates_adversarios,
  COUNTIF(status_qualidade != 'ok') AS alertas,
  -- Defuse usa defusePlayerLocations; referencia dos JSONs: 3333 posicoes nos 1349 defuses.
  SUM(IF(tipo = 'defuse', ARRAY_LENGTH(jogadores), 0)) AS posicoes_defuse,
  COUNT(DISTINCT TO_JSON_STRING(STRUCT(partida_id, round_indice, ordem))) AS ordens_unicas
FROM `datropa.valorant.eventos_round`;
