WITH historico AS (
  SELECT *
  FROM `datropa.valorant.stats_time_partida`
  WHERE time_id = @time_id
),
identidade AS (
  SELECT time_id AS id, nome
  FROM historico
  QUALIFY ROW_NUMBER() OVER (
    ORDER BY inicio DESC NULLS LAST, partida_id DESC
  ) = 1
),
recorte AS (
  SELECT *
  FROM historico
  WHERE (@mapa_id IS NULL OR mapa_id = @mapa_id)
    AND (@torneio_id IS NULL OR torneio_id = @torneio_id)
    AND (@data_inicio IS NULL OR data_partida_utc >= @data_inicio)
    AND (@data_fim IS NULL OR data_partida_utc <= @data_fim)
),
totais AS (
  SELECT
    COUNT(DISTINCT partida_id) AS partidas,
    COUNTIF(venceu IS TRUE) AS vitorias,
    COUNTIF(perdeu IS TRUE) AS derrotas,
    COUNTIF(empate IS TRUE) AS empates,
    COALESCE(SUM(rounds_jogados), 0) AS rounds_jogados,
    COALESCE(SUM(rounds_ganhos), 0) AS rounds_ganhos,
    COALESCE(SUM(rounds_ataque), 0) AS rounds_ataque,
    COALESCE(SUM(vitorias_ataque), 0) AS vitorias_ataque,
    COALESCE(SUM(rounds_defesa), 0) AS rounds_defesa,
    COALESCE(SUM(vitorias_defesa), 0) AS vitorias_defesa,
    COUNTIF(
      status_qualidade != 'ok' OR status_qualidade IS NULL
    ) AS alertas
  FROM recorte
),
mapas AS (
  SELECT
    mapa_id,
    COUNT(DISTINCT partida_id) AS partidas,
    COUNTIF(venceu IS TRUE) AS vitorias,
    IF(
      COUNTIF(
        status_qualidade != 'ok' OR status_qualidade IS NULL
      ) = 0,
      100.0 * SAFE_DIVIDE(
        COUNTIF(venceu IS TRUE),
        COUNT(DISTINCT partida_id)
      ),
      NULL
    ) AS taxa_vitoria_pct
  FROM recorte
  GROUP BY mapa_id
)
SELECT
  i.id,
  i.nome,
  STRUCT(
    t.partidas AS partidas,
    t.vitorias AS vitorias,
    t.derrotas AS derrotas,
    t.empates AS empates,
    IF(
      t.alertas = 0,
      100.0 * SAFE_DIVIDE(t.vitorias, t.partidas),
      NULL
    ) AS taxa_vitoria_pct,
    t.rounds_jogados AS rounds_jogados,
    t.rounds_ganhos AS rounds_ganhos
  ) AS resumo,
  [
    STRUCT(
      'ataque' AS lado,
      t.rounds_ataque AS rounds_jogados,
      t.vitorias_ataque AS rounds_ganhos,
      IF(
        t.alertas = 0,
        100.0 * SAFE_DIVIDE(t.vitorias_ataque, t.rounds_ataque),
        NULL
      ) AS taxa_vitoria_pct
    ),
    STRUCT(
      'defesa' AS lado,
      t.rounds_defesa AS rounds_jogados,
      t.vitorias_defesa AS rounds_ganhos,
      IF(
        t.alertas = 0,
        100.0 * SAFE_DIVIDE(t.vitorias_defesa, t.rounds_defesa),
        NULL
      ) AS taxa_vitoria_pct
    )
  ] AS lados,
  -- Mais partidas primeiro, depois vitorias, nome e ID.
  ARRAY(
    SELECT AS STRUCT m.*, c.nome
    FROM mapas m
    LEFT JOIN `datropa.valorant.mapas` c
      ON c.id = m.mapa_id
    ORDER BY
      m.partidas DESC,
      m.vitorias DESC,
      c.nome ASC NULLS LAST,
      m.mapa_id
  ) AS mapas
FROM identidade i
CROSS JOIN totais t
