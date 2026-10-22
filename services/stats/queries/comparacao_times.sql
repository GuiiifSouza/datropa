WITH identidades AS (
  SELECT time_id
  FROM `datropa.valorant.stats_time_partida`
  WHERE time_id IN (@time_a_id, @time_b_id)
  GROUP BY time_id
),
recorte AS (
  SELECT
    partida_id,
    time_id,
    adversario_id,
    venceu,
    empate,
    status_qualidade
  FROM `datropa.valorant.stats_time_partida`
  WHERE time_id IN (@time_a_id, @time_b_id)
    AND (@mapa_id IS NULL OR mapa_id = @mapa_id)
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
resumos AS (
  SELECT
    time_id,
    COUNT(DISTINCT partida_id) AS partidas,
    COUNTIF(venceu IS TRUE) AS vitorias,
    IF(
      COUNTIF(
        status_qualidade IS NULL
        OR status_qualidade != 'ok'
        OR venceu IS NULL
      ) = 0,
      100.0 * SAFE_DIVIDE(
        COUNTIF(venceu IS TRUE),
        COUNT(DISTINCT partida_id)
      ),
      NULL
    ) AS taxa_vitoria_pct
  FROM recorte
  GROUP BY time_id
),
diretos AS (
  SELECT
    COUNT(*) AS partidas,
    COUNTIF(a.venceu IS TRUE) AS vitorias_a,
    COUNTIF(b.venceu IS TRUE) AS vitorias_b,
    COUNTIF(a.empate IS TRUE) AS empates
  FROM recorte a
  JOIN recorte b
    ON b.partida_id = a.partida_id
    AND b.time_id = @time_b_id
    AND b.adversario_id = @time_a_id
  WHERE a.time_id = @time_a_id
    AND a.adversario_id = @time_b_id
)
SELECT
  STRUCT(
    ia.time_id AS id,
    COALESCE(a.partidas, 0) AS partidas,
    COALESCE(a.vitorias, 0) AS vitorias,
    a.taxa_vitoria_pct AS taxa_vitoria_pct
  ) AS time_a,
  STRUCT(
    ib.time_id AS id,
    COALESCE(b.partidas, 0) AS partidas,
    COALESCE(b.vitorias, 0) AS vitorias,
    b.taxa_vitoria_pct AS taxa_vitoria_pct
  ) AS time_b,
  STRUCT(
    d.partidas AS partidas,
    d.vitorias_a AS vitorias_a,
    d.vitorias_b AS vitorias_b,
    d.empates AS empates
  ) AS confrontos_diretos
FROM identidades ia
CROSS JOIN identidades ib
CROSS JOIN diretos d
LEFT JOIN resumos a ON a.time_id = ia.time_id
LEFT JOIN resumos b ON b.time_id = ib.time_id
WHERE ia.time_id = @time_a_id
  AND ib.time_id = @time_b_id;