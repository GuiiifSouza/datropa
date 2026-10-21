WITH partidas_jogador AS (
  SELECT DISTINCT partida_id
  FROM `datropa.valorant.stats_jogador_partida`
  WHERE jogador_id = @jogador_id
),
recorte AS (
  SELECT
    p.partida_id AS id,
    p.torneio_id,
    p.mapa_id,
    p.inicio,
    [
      STRUCT(
        p.time_a_id AS id,
        p.time_a_nome AS nome,
        p.placar_a AS rounds_ganhos
      ),
      STRUCT(
        p.time_b_id AS id,
        p.time_b_nome AS nome,
        p.placar_b AS rounds_ganhos
      )
    ] AS times,
    p.vencedor_id
  FROM `datropa.valorant.partidas` p
  LEFT JOIN partidas_jogador j
    ON j.partida_id = p.partida_id
  WHERE (@mapa_id IS NULL OR p.mapa_id = @mapa_id)
    AND (@torneio_id IS NULL OR p.torneio_id = @torneio_id)
    AND (
      @time_id IS NULL
      OR p.time_a_id = @time_id
      OR p.time_b_id = @time_id
    )
    AND (
      @jogador_id IS NULL
      OR j.partida_id IS NOT NULL
    )
    AND (
      @data_inicio IS NULL
      OR p.data_partida_utc >= @data_inicio
    )
    AND (
      @data_fim IS NULL
      OR p.data_partida_utc <= @data_fim
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