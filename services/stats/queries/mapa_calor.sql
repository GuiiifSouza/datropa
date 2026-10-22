-- O sujeito é a vítima para morte e o autor para abate/plant.
-- Morte inclui eventos ambientais e fogo amigo; não equivale ao deaths do placar.
WITH mapa AS (
  SELECT mapa_id, transformacao
  FROM `datropa.valorant.mapas`
  WHERE mapa_id = @mapa_id
),
eventos AS (
  SELECT e.*,
    IF(@tipo = 'morte', e.vitima_time_id, e.ator_time_id) AS time_filtro_id,
    IF(@tipo = 'morte', e.vitima_id, e.ator_id) AS jogador_filtro_id
  FROM `datropa.valorant.eventos_round` e
  WHERE e.mapa_id = @mapa_id
    AND e.tipo = IF(@tipo = 'morte', 'abate', @tipo)
    AND (@torneio_id IS NULL OR e.torneio_id = @torneio_id)
    AND (@data_inicio IS NULL OR e.data_partida_utc >= @data_inicio)
    AND (@data_fim IS NULL OR e.data_partida_utc <= @data_fim)
    AND ((@tempo_inicio_ms IS NULL AND @tempo_fim_ms IS NULL) OR e.tempo_ms >= 0)
    AND (@tempo_inicio_ms IS NULL OR e.tempo_ms >= @tempo_inicio_ms)
    AND (@tempo_fim_ms IS NULL OR e.tempo_ms < @tempo_fim_ms)
    AND (
      @tipo = 'plant'
      OR (@tipo = 'morte' AND e.vitima_id IS NOT NULL)
      OR (
        @tipo = 'abate' AND e.abate_adversario IS TRUE
        AND e.dano_final_tipo IS NOT NULL
        AND e.dano_final_tipo NOT IN ('Bomb', 'Fall', 'Crush')
      )
    )
),
contexto AS (
  SELECT e.partida_id, e.`round`, e.id AS evento_id,
    e.posicao.x AS x, e.posicao.y AS y,
    IF(e.tempo_ms >= 0, e.tempo_ms, NULL) AS tempo_ms,
    e.time_filtro_id AS time_id,
    e.jogador_filtro_id AS jogador_id,
    CASE
      WHEN r.atacante_id != r.defensor_id AND e.time_filtro_id = r.atacante_id THEN 'ataque'
      WHEN r.atacante_id != r.defensor_id AND e.time_filtro_id = r.defensor_id THEN 'defesa'
    END AS lado,
    IF(ec.status_qualidade = 'ok', ec.categoria, NULL) AS compra
  FROM eventos e
  LEFT JOIN `datropa.valorant.rounds` r
    ON r.partida_id = e.partida_id
    AND r.round_indice_origem = e.round_indice
  LEFT JOIN `datropa.valorant.economia_time_round` ec
    ON ec.partida_id = e.partida_id
    AND ec.round_indice_origem = e.round_indice
    AND ec.time_id = e.time_filtro_id
  WHERE (@time_id IS NULL OR e.time_filtro_id = @time_id)
    AND (@jogador_id IS NULL OR e.jogador_filtro_id = @jogador_id)
),
recorte AS (
  SELECT * FROM contexto
  WHERE (@lado IS NULL OR lado = @lado)
    AND (@compra IS NULL OR compra = @compra)
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
    tempo_ms,
    time_id,
    jogador_id,
    lado,
    compra,
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