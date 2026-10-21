WITH base AS (
  SELECT *
  FROM `datropa.valorant.stats_time_partida`
  WHERE time_id IS NOT NULL
    AND (@mapa_id IS NULL OR mapa_id = @mapa_id)
    AND (@torneio_id IS NULL OR torneio_id = @torneio_id)
    AND (@data_inicio IS NULL OR data_partida_utc >= @data_inicio)
    AND (@data_fim IS NULL OR data_partida_utc <= @data_fim)
),
times AS (
  SELECT
    time_id AS id,
    (
      ARRAY_AGG(
        STRUCT(nome)
        ORDER BY inicio DESC NULLS LAST, partida_id DESC
        LIMIT 1
      )
    )[OFFSET(0)].nome AS nome,
    COUNT(DISTINCT partida_id) AS partidas,
    COUNTIF(venceu IS TRUE) AS vitorias,
    COUNTIF(perdeu IS TRUE) AS derrotas,
    COUNTIF(empate IS TRUE) AS empates,
    100.0 * SAFE_DIVIDE(
      COUNTIF(venceu IS TRUE),
      COUNTIF(
        venceu IS TRUE
        OR perdeu IS TRUE
        OR empate IS TRUE
      )
    ) AS taxa_vitoria_pct
  FROM base
  GROUP BY time_id
)
SELECT
  ARRAY(
    SELECT AS STRUCT *
    FROM times
    ORDER BY nome ASC NULLS LAST, id
    LIMIT @limite OFFSET @deslocamento
  ) AS times,
  (SELECT COUNT(*) FROM times) AS total
