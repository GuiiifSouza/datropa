WITH torneios AS (
  SELECT DISTINCT torneio_id AS id
  FROM `datropa.valorant.partidas`
  WHERE torneio_id IS NOT NULL
),
agentes_presentes AS (
  SELECT DISTINCT agente_id AS id
  FROM `datropa.valorant.stats_jogador_partida`
  WHERE agente_id IS NOT NULL
),
agentes_catalogo AS (
  SELECT
    JSON_VALUE(item, '$.id') AS id,
    JSON_VALUE(item, '$.nome') AS nome,
    JSON_VALUE(item, '$.classe') AS classe
  FROM UNNEST(JSON_QUERY_ARRAY(@agentes_json)) AS item
),
armas_catalogo AS (
  SELECT
    JSON_VALUE(item, '$.id') AS id,
    JSON_VALUE(item, '$.uuid') AS uuid,
    JSON_VALUE(item, '$.nome') AS nome
  FROM UNNEST(JSON_QUERY_ARRAY(@armas_json)) AS item
),
armas_presentes AS (
  SELECT DISTINCT arma_id AS id
  FROM `datropa.valorant.eventos_round`
  WHERE arma_id IS NOT NULL
),
armas_ids AS (
  SELECT id FROM armas_catalogo
  UNION DISTINCT
  SELECT id FROM armas_presentes
),
armaduras_catalogo AS (
  SELECT
    JSON_VALUE(item, '$.id') AS id,
    JSON_VALUE(item, '$.uuid') AS uuid,
    JSON_VALUE(item, '$.nome') AS nome
  FROM UNNEST(JSON_QUERY_ARRAY(@armaduras_json)) AS item
)
SELECT
  ARRAY(
    SELECT AS STRUCT id, id AS nome
    FROM torneios
    ORDER BY id
  ) AS torneios,
  ARRAY(
    SELECT AS STRUCT
      id,
      nome,
      minimapa_url,
      transformacao
    FROM `datropa.valorant.mapas`
    ORDER BY nome, id
  ) AS mapas,
  ARRAY(
    SELECT AS STRUCT
      p.id,
      p.id AS uuid,
      c.nome,
      c.classe,
      CAST(NULL AS STRING) AS icone_url
    FROM agentes_presentes p
    LEFT JOIN agentes_catalogo c ON c.id = p.id
    ORDER BY c.nome, p.id
  ) AS agentes,
  ARRAY(
    SELECT AS STRUCT
      i.id,
      i.id AS uuid,
      c.nome,
      CAST(NULL AS STRING) AS icone_url
    FROM armas_ids i
    LEFT JOIN armas_catalogo c ON c.id = i.id
    ORDER BY c.nome, i.id
  ) AS armas,
  ARRAY(
    SELECT AS STRUCT id, uuid, nome
    FROM armaduras_catalogo
    ORDER BY nome, id
  ) AS armaduras;