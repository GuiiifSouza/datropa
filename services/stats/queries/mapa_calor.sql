WITH mapa AS (
  SELECT mapa_id, transformacao
  FROM `datropa.valorant.mapas`
  WHERE mapa_id = @mapa_id
),
recorte AS (
  SELECT
    e.partida_id,
    e.`round`,
    e.id AS evento_id,
    e.posicao.x AS x,
    e.posicao.y AS y
  FROM `datropa.valorant.eventos_round` e
  WHERE e.mapa_id = @mapa_id
    AND e.tipo = @tipo
    AND (
      @torneio_id IS NULL
      OR e.torneio_id = @torneio_id
    )
    AND (
      @time_id IS NULL
      OR e.ator_time_id = @time_id
    )
    AND (
      @jogador_id IS NULL
      OR e.ator_id = @jogador_id
    )
    AND (
      @data_inicio IS NULL
      OR e.data_partida_utc >= @data_inicio
    )
    AND (
      @data_fim IS NULL
      OR e.data_partida_utc <= @data_fim
    )
    AND (
      @tipo = 'plant'
      OR (
        e.abate_adversario IS TRUE
        AND e.dano_final_tipo IS NOT NULL
        AND e.dano_final_tipo NOT IN ('Bomb', 'Fall', 'Crush')
      )
    )
),
projetados AS (
  SELECT
    e.*,
    e.x * m.transformacao.u_x
      + e.y * m.transformacao.u_y
      + m.transformacao.u_offset AS u,
    e.x * m.transformacao.v_x
      + e.y * m.transformacao.v_y
      + m.transformacao.v_offset AS v
  FROM recorte e
  CROSS JOIN mapa m
),
classificados AS (
  SELECT
    *,
    COALESCE(
      x IS NOT NULL
      AND y IS NOT NULL
      AND NOT IS_NAN(x)
      AND NOT IS_INF(x)
      AND NOT IS_NAN(y)
      AND NOT IS_INF(y)
      AND u IS NOT NULL
      AND v IS NOT NULL
      AND NOT IS_NAN(u)
      AND NOT IS_INF(u)
      AND NOT IS_NAN(v)
      AND NOT IS_INF(v)
      AND u BETWEEN 0 AND 1
      AND v BETWEEN 0 AND 1,
      FALSE
    ) AS projetavel
  FROM projetados
),
validos AS (
  SELECT
    partida_id,
    `round`,
    evento_id,
    x,
    y,
    1 AS peso
  FROM classificados
  WHERE projetavel
),
contagens AS (
  SELECT
    COUNT(*) AS eventos_elegiveis,
    COUNTIF(NOT projetavel) AS pontos_excluidos
  FROM classificados
)
SELECT
  m.mapa_id,
  m.transformacao IS NOT NULL AS transformacao_disponivel,
  (SELECT COUNT(*) FROM validos) AS total,
  c.eventos_elegiveis,
  c.pontos_excluidos,
  ARRAY(
    SELECT AS STRUCT *
    FROM validos
    ORDER BY partida_id, `round`, evento_id
    LIMIT @limite OFFSET @deslocamento
  ) AS pontos
FROM mapa m
CROSS JOIN contagens c;