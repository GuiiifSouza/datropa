WITH partidas_filtradas AS (
  SELECT DISTINCT partida_id, mapa_id
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
contagens AS (
  SELECT
    mapa_id,
    COUNT(*) AS partidas
  FROM partidas_filtradas
  GROUP BY mapa_id
),
catalogo AS (
  SELECT
    m.id,
    m.nome,
    c.partidas
  FROM `datropa.valorant.mapas` m
  JOIN contagens c ON c.mapa_id = m.mapa_id
)
SELECT
  (SELECT COUNT(*) FROM catalogo) AS total,
  ARRAY(
    SELECT AS STRUCT *
    FROM catalogo
    ORDER BY nome, id
    LIMIT @limite OFFSET @deslocamento
  ) AS mapas;