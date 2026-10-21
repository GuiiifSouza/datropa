-- Referencia local: 672 linhas, 336 partidas, 68 times e 198 composicoes/mapas.
SELECT COUNT(*) AS linhas,
  COUNT(DISTINCT TO_JSON_STRING(STRUCT(partida_id, time_id))) AS chaves_unicas,
  COUNT(DISTINCT partida_id) AS partidas, COUNT(DISTINCT time_id) AS times,
  COUNT(DISTINCT composicao_id) AS composicoes_por_mapa,
  SUM(ARRAY_LENGTH(agente_ids)) AS slots,
  COUNTIF(venceu) AS vitorias, COUNTIF(perdeu) AS derrotas,
  COUNTIF(empate) AS empates,
  COUNTIF(status_qualidade != 'ok') AS alertas,
  COUNTIF(NOT composicao_valida OR composicao_id IS NULL
    OR ARRAY_LENGTH(agente_ids) != 5 OR jogadores_unicos != 5
    OR agentes_distintos != 5 OR agentes_ausentes != 0) AS composicoes_invalidas,
  COUNTIF(composicao_id IS DISTINCT FROM
    CONCAT('composicao_', LOWER(TO_HEX(SHA256(
      TO_JSON_STRING(STRUCT(mapa_id AS mapa_id, agente_ids AS agente_ids))))))) AS ids_inconsistentes,
  COUNTIF(TO_JSON_STRING(agente_ids) !=
    TO_JSON_STRING(ARRAY(SELECT a FROM UNNEST(agente_ids) a ORDER BY a))) AS listas_fora_de_ordem
FROM `datropa.valorant.composicao_time_partida`;
