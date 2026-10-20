-- Referencia independente: 52755 eventos: 46753 mortes/abates + 4653 plants + 1349 desarmes.
SELECT COUNT(*) AS eventos,
  COUNT(DISTINCT id) AS ids_unicos, COUNT(DISTINCT partida_id) AS partidas,
  COUNTIF(tipo = 'abate') AS abates, COUNTIF(tipo = 'plant') AS plants,
  COUNTIF(tipo = 'defuse') AS desarmes,
  COUNTIF(self_kill) AS self_kills,
  COUNTIF(fogo_amigo) AS fogo_amigo,
  COUNTIF(abate_adversario) AS abates_adversarios,
  COUNTIF(status_qualidade != 'ok') AS alertas,
  COUNTIF(tipo = 'defuse' AND ARRAY_LENGTH(jogadores) != 0) AS snapshots_defuse_inventados,
  COUNT(DISTINCT TO_JSON_STRING(STRUCT(partida_id, round_indice, ordem))) AS ordens_unicas
FROM `datropa.valorant.eventos_round`;
