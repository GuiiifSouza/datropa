WITH identidade AS (
  SELECT time_id
  FROM `datropa.valorant.stats_time_partida`
  WHERE time_id = @time_id
  GROUP BY time_id
),
recorte AS (
  SELECT
    pos_plant_oportunidades,
    pos_plant_vitorias,
    retake_oportunidades,
    retake_vitorias,
    status_qualidade
  FROM `datropa.valorant.pos_plant_retake_partida`
  WHERE time_id = @time_id
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
totais AS (
  SELECT
    COALESCE(SUM(pos_plant_oportunidades), 0)
      AS pos_plant_oportunidades,
    COALESCE(SUM(pos_plant_vitorias), 0)
      AS pos_plant_vitorias,
    COALESCE(SUM(retake_oportunidades), 0)
      AS retake_oportunidades,
    COALESCE(SUM(retake_vitorias), 0)
      AS retake_vitorias,
    COUNTIF(
      status_qualidade IS NULL OR status_qualidade != 'ok'
    ) AS alertas
  FROM recorte
)
SELECT
  i.time_id,
  STRUCT(
    t.pos_plant_oportunidades AS oportunidades,
    t.pos_plant_vitorias AS vitorias,
    IF(
      t.alertas = 0,
      100.0 * SAFE_DIVIDE(
        t.pos_plant_vitorias,
        t.pos_plant_oportunidades
      ),
      NULL
    ) AS taxa_sucesso_pct
  ) AS pos_plant,
  STRUCT(
    t.retake_oportunidades AS oportunidades,
    t.retake_vitorias AS vitorias,
    IF(
      t.alertas = 0,
      100.0 * SAFE_DIVIDE(
        t.retake_vitorias,
        t.retake_oportunidades
      ),
      NULL
    ) AS taxa_sucesso_pct
  ) AS retake
FROM identidade i
CROSS JOIN totais t;