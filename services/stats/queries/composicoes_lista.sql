WITH recorte AS (
  SELECT
    composicao_id,
    mapa_id,
    agente_ids,
    venceu
  FROM `datropa.valorant.composicao_time_partida`
  WHERE composicao_valida IS TRUE
    AND composicao_id IS NOT NULL
    AND ARRAY_LENGTH(agente_ids) = 5
    AND (@time_id IS NULL OR time_id = @time_id)
    AND (@mapa_id IS NULL OR mapa_id = @mapa_id)
    AND (@torneio_id IS NULL OR torneio_id = @torneio_id)
    AND (
      @agente_id IS NULL
      OR @agente_id IN UNNEST(agente_ids)
    )
    AND (
      @data_inicio IS NULL
      OR data_partida_utc >= @data_inicio
    )
    AND (
      @data_fim IS NULL
      OR data_partida_utc <= @data_fim
    )
),
agrupadas AS (
  SELECT
    composicao_id,
    mapa_id,
    ANY_VALUE(agente_ids) AS agente_ids,
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
  GROUP BY composicao_id, mapa_id
)
SELECT
  (SELECT COUNT(*) FROM agrupadas) AS total,
  ARRAY(
    SELECT AS STRUCT *
    FROM agrupadas
    ORDER BY aparicoes DESC, composicao_id
    LIMIT @limite OFFSET @deslocamento
  ) AS composicoes;