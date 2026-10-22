WITH catalogo AS (
  SELECT
    JSON_VALUE(item, '$.id') AS id,
    JSON_VALUE(item, '$.nome') AS nome,
    JSON_VALUE(item, '$.classe') AS classe
  FROM UNNEST(JSON_QUERY_ARRAY(@catalogo_json)) AS item
),
recorte AS (
  SELECT agente_id, venceu
  FROM `datropa.valorant.stats_jogador_partida`
  WHERE (@mapa_id IS NULL OR mapa_id = @mapa_id)
    AND (@agente_id IS NULL OR agente_id = @agente_id)
    AND (@torneio_id IS NULL OR torneio_id = @torneio_id)
    AND (
      @data_inicio IS NULL
      OR data_partida_utc >= @data_inicio
    )
    AND (
      @data_fim IS NULL
      OR data_partida_utc <= @data_fim
    )
),
totais AS (
  SELECT
    agente_id AS id,
    COUNT(*) AS aparicoes,
    COUNTIF(venceu IS TRUE) AS vitorias,
    IF(
      COUNTIF(venceu IS NULL) = 0,
      100.0 * SAFE_DIVIDE(
        COUNTIF(venceu IS TRUE),
        COUNT(*)
      ),
      NULL
    ) AS taxa_vitoria_pct
  FROM recorte
  GROUP BY agente_id
),
resultado AS (
  SELECT
    t.id,
    c.nome,
    c.classe,
    t.aparicoes,
    t.vitorias,
    t.taxa_vitoria_pct
  FROM totais t
  LEFT JOIN catalogo c ON c.id = t.id
)
SELECT
  (SELECT COUNT(*) FROM resultado) AS total,
  ARRAY(
    SELECT AS STRUCT *
    FROM resultado
    ORDER BY nome ASC NULLS LAST, id
    LIMIT @limite OFFSET @deslocamento
  ) AS agentes;