-- VERSAO OFICIAL gold_336_v1. Destino: datropa.valorant.partidas
-- Fontes e validacoes de teste preservadas na pasta superior.
-- Primeira tabela gold: uma linha por mapa jogado.
-- Somente SELECT: destino escolhido no comando bq. Nao altera a bronze.
-- Nao deduplica silenciosamente: validacoes devem rejeitar IDs repetidos.
WITH origem AS (
  SELECT
    matchInfo.matchId AS partida_id,
    matchInfo.mapId AS mapa_id_origem,
    LOWER(REGEXP_EXTRACT(matchInfo.mapId, r'([^/]+)$')) AS mapa_id,
    CASE WHEN matchInfo.gameStartMillis > 0
      THEN TIMESTAMP_MILLIS(matchInfo.gameStartMillis) END AS inicio,
    matchInfo.gameLengthMillis AS duracao_ms,
    matchInfo.isCompleted AS concluida,
    _arquivo AS arquivo_origem, _pasta AS pasta_origem,
    ARRAY_LENGTH(roundResults) AS rounds_jogados,
    (SELECT COUNT(*) FROM UNNEST(players) p
     WHERE NOT COALESCE(p.isObserver, FALSE) AND p.teamId IN ('Red', 'Blue')) AS jogadores_validos,
    (SELECT COUNT(*) FROM UNNEST(teams) t WHERE t.teamId = 'Red') AS qtd_red,
    (SELECT COUNT(*) FROM UNNEST(teams) t WHERE t.teamId = 'Blue') AS qtd_blue,
    (SELECT MAX(t.roundsWon) FROM UNNEST(teams) t WHERE t.teamId = 'Red') AS rounds_red,
    (SELECT MAX(t.roundsWon) FROM UNNEST(teams) t WHERE t.teamId = 'Blue') AS rounds_blue,
    (SELECT COUNTIF(t.won) FROM UNNEST(teams) t) AS qtd_vencedores,
    (SELECT MAX(IF(t.won, t.teamId, NULL)) FROM UNNEST(teams) t) AS cor_vencedora,
    REGEXP_EXTRACT(_arquivo, r'^(.+?)_(?:[0-9]+[a-z]?)_(?:[0-9]{2}-[0-9]{2}-[0-9]{2})_(?:.+)_(?:[0-9]+)_x_(?:[0-9]+)_(?:.+)_(?:[^_]+)\.json$') AS torneio_id,
    REGEXP_EXTRACT(_arquivo, r'^(?:.+?)_(?:[0-9]+[a-z]?)_([0-9]{2}-[0-9]{2}-[0-9]{2})_(?:.+)_(?:[0-9]+)_x_(?:[0-9]+)_(?:.+)_(?:[^_]+)\.json$') AS data_arquivo_texto,
    REGEXP_EXTRACT(_arquivo, r'^(?:.+?)_(?:[0-9]+[a-z]?)_(?:[0-9]{2}-[0-9]{2}-[0-9]{2})_(.+)_(?:[0-9]+)_x_(?:[0-9]+)_(?:.+)_(?:[^_]+)\.json$') AS time_a_slug,
    REGEXP_EXTRACT(_arquivo, r'^(?:.+?)_(?:[0-9]+[a-z]?)_(?:[0-9]{2}-[0-9]{2}-[0-9]{2})_(?:.+)_([0-9]+)_x_(?:[0-9]+)_(?:.+)_(?:[^_]+)\.json$') AS placar_a_texto,
    REGEXP_EXTRACT(_arquivo, r'^(?:.+?)_(?:[0-9]+[a-z]?)_(?:[0-9]{2}-[0-9]{2}-[0-9]{2})_(?:.+)_(?:[0-9]+)_x_([0-9]+)_(?:.+)_(?:[^_]+)\.json$') AS placar_b_texto,
    REGEXP_EXTRACT(_arquivo, r'^(?:.+?)_(?:[0-9]+[a-z]?)_(?:[0-9]{2}-[0-9]{2}-[0-9]{2})_(?:.+)_(?:[0-9]+)_x_(?:[0-9]+)_(.+)_(?:[^_]+)\.json$') AS time_b_slug,
    REGEXP_EXTRACT(_arquivo, r'^(?:.+?)_(?:[0-9]+[a-z]?)_(?:[0-9]{2}-[0-9]{2}-[0-9]{2})_(?:.+)_(?:[0-9]+)_x_(?:[0-9]+)_(?:.+)_([^_]+)\.json$') AS mapa_arquivo
  FROM `datropa.valorant.bronze_partidas`
), placares AS (
  SELECT *, SAFE_CAST(placar_a_texto AS INT64) AS placar_a,
    SAFE_CAST(placar_b_texto AS INT64) AS placar_b
  FROM origem
), correspondencia AS (
  SELECT *,
    CASE
      WHEN qtd_red != 1 OR qtd_blue != 1 THEN NULL
      WHEN placar_a = rounds_red AND placar_b = rounds_blue AND placar_a != placar_b THEN 'Red'
      WHEN placar_a = rounds_blue AND placar_b = rounds_red AND placar_a != placar_b THEN 'Blue'
    END AS cor_time_a
  FROM placares
), identificacao AS (
  SELECT *,
    CASE cor_time_a WHEN 'Red' THEN 'Blue' WHEN 'Blue' THEN 'Red' END AS cor_time_b,
    IF(time_a_slug IS NOT NULL, CONCAT('time_', LOWER(TO_HEX(SHA256(LOWER(NORMALIZE(time_a_slug, NFC)))))), NULL) AS time_a_id,
    IF(time_b_slug IS NOT NULL, CONCAT('time_', LOWER(TO_HEX(SHA256(LOWER(NORMALIZE(time_b_slug, NFC)))))), NULL) AS time_b_id
  FROM correspondencia
)
SELECT partida_id, torneio_id, mapa_id, mapa_id_origem, mapa_arquivo,
  inicio, DATE(inicio, 'UTC') AS data_partida_utc,
  SAFE.PARSE_DATE('%d-%m-%y', data_arquivo_texto) AS data_arquivo,
  duracao_ms, concluida, rounds_jogados, jogadores_validos,
  time_a_id, time_a_slug, INITCAP(REPLACE(time_a_slug, '_', ' ')) AS time_a_nome,
  time_b_id, time_b_slug, INITCAP(REPLACE(time_b_slug, '_', ' ')) AS time_b_nome,
  placar_a, placar_b, cor_time_a, cor_time_b,
  CASE WHEN qtd_vencedores = 1 AND cor_vencedora = cor_time_a THEN time_a_id
       WHEN qtd_vencedores = 1 AND cor_vencedora = cor_time_b THEN time_b_id END AS vencedor_id,
  CASE WHEN torneio_id IS NULL THEN 'arquivo_nao_reconhecido'
       WHEN cor_time_a IS NULL THEN 'cor_nao_resolvida'
       WHEN qtd_vencedores > 1 THEN 'vencedor_inconsistente'
       WHEN rounds_jogados = 0 OR jogadores_validos < 2 THEN 'partida_incompleta'
       ELSE 'ok' END AS status_qualidade,
  arquivo_origem, pasta_origem
FROM identificacao;
