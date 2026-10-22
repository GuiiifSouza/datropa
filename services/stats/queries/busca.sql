WITH times AS (
  SELECT
    'time' AS tipo,
    time_id AS id,
    nome
  FROM `datropa.valorant.stats_time_partida`
  WHERE time_id IS NOT NULL
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY time_id
    ORDER BY inicio DESC NULLS LAST, partida_id DESC
  ) = 1
),
jogadores AS (
  SELECT
    'jogador' AS tipo,
    jogador_id AS id,
    nome
  FROM `datropa.valorant.ranking_jogador`
  WHERE jogador_id IS NOT NULL
),
mapas AS (
  SELECT
    'mapa' AS tipo,
    id,
    nome
  FROM `datropa.valorant.mapas`
),
entidades AS (
  SELECT * FROM times
  UNION ALL
  SELECT * FROM jogadores
  UNION ALL
  SELECT * FROM mapas
),
normalizadas AS (
  SELECT
    *,
    REGEXP_REPLACE(
      NORMALIZE_AND_CASEFOLD(nome, NFD),
      r'\p{M}',
      ''
    ) AS nome_busca
  FROM entidades
  WHERE nome IS NOT NULL
    AND (@tipo IS NULL OR tipo = @tipo)
),
termo AS (
  SELECT REGEXP_REPLACE(
    NORMALIZE_AND_CASEFOLD(@q, NFD),
    r'\p{M}',
    ''
  ) AS texto
),
candidatos AS (
  SELECT
    n.tipo,
    n.id,
    n.nome,
    CASE
      WHEN n.nome_busca = t.texto THEN 0
      WHEN STARTS_WITH(n.nome_busca, t.texto) THEN 1
      ELSE 2
    END AS relevancia
  FROM normalizadas n
  CROSS JOIN termo t
  WHERE STRPOS(n.nome_busca, t.texto) > 0
)
SELECT
  (SELECT COUNT(*) FROM candidatos) AS total,
  ARRAY(
    SELECT AS STRUCT tipo, id, nome
    FROM candidatos
    ORDER BY relevancia, id, tipo
    LIMIT @limite OFFSET @deslocamento
  ) AS resultados;