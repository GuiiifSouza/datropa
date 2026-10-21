WITH recorte AS (
  SELECT
    partida_id AS id,
    torneio_id,
    mapa_id,
    inicio,
    duracao_ms,
    concluida,
    rounds_jogados,
    STRUCT(
      time_a_id AS id,
      time_a_nome AS nome,
      placar_a AS placar
    ) AS time_a,
    STRUCT(
      time_b_id AS id,
      time_b_nome AS nome,
      placar_b AS placar
    ) AS time_b,
    vencedor_id,
    status_qualidade
  FROM `datropa.valorant.partidas`
  WHERE (@mapa_id IS NULL OR mapa_id = @mapa_id)
    AND (@torneio_id IS NULL OR torneio_id = @torneio_id)
    AND (
      @time_id IS NULL
      OR time_a_id = @time_id
      OR time_b_id = @time_id
    )
    AND (
      @data_inicio IS NULL
      OR data_partida_utc >= @data_inicio
    )
    AND (
      @data_fim IS NULL
      OR data_partida_utc <= @data_fim
    )
)
SELECT
  (SELECT COUNT(*) FROM recorte) AS total,
  ARRAY(
    SELECT AS STRUCT *
    FROM recorte
    ORDER BY inicio DESC NULLS LAST, id
    LIMIT @limite OFFSET @deslocamento
  ) AS partidas;