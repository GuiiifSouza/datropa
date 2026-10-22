WITH base AS (
  SELECT *
  FROM `datropa.valorant.stats_jogador_partida`
  WHERE (@mapa_id IS NULL OR mapa_id = @mapa_id)
    AND (@agente_id IS NULL OR agente_id = @agente_id)
    AND (@time_id IS NULL OR time_id = @time_id)
    AND (@torneio_id IS NULL OR torneio_id = @torneio_id)
    AND (@data_inicio IS NULL OR data_partida_utc >= @data_inicio)
    AND (@data_fim IS NULL OR data_partida_utc <= @data_fim)
),
totais AS (
  SELECT
    jogador_id,
    IF(COUNT(DISTINCT time_id) = 1, MAX(time_id), NULL) AS time_id,
    COUNT(DISTINCT partida_id) AS partidas,
    SUM(rounds) AS rounds,
    SUM(kills) AS kills,
    SUM(deaths) AS deaths,
    SUM(assists) AS assists,
    SUM(dano_total) AS dano_total,
    SUM(headshots) AS headshots,
    SUM(bodyshots) AS bodyshots,
    SUM(legshots) AS legshots,
    SUM(first_bloods) AS first_bloods,
    COUNTIF(
      status_qualidade != 'ok' OR status_qualidade IS NULL
    ) AS registros_com_alerta
  FROM base
  GROUP BY jogador_id
),
identidades AS (
  -- ranking_jogador traz o nick da partida mais recente do jogador.
  SELECT jogador_id, nome
  FROM `datropa.valorant.ranking_jogador`
),
ranking AS (
  SELECT
    t.jogador_id,
    -- Nick mais recente do histórico inteiro, não só do recorte.
    i.nome,
    time_id,
    partidas,
    rounds,
    kills,
    deaths,
    assists,
    SAFE_DIVIDE(kills, deaths) AS kd,
    IF(
      registros_com_alerta = 0,
      SAFE_DIVIDE(dano_total, rounds),
      NULL
    ) AS adr,
    IF(
      registros_com_alerta = 0,
      100.0 * SAFE_DIVIDE(
        headshots, headshots + bodyshots + legshots
      ),
      NULL
    ) AS hs_pct,
    first_bloods
  FROM totais t
  LEFT JOIN identidades i
    ON i.jogador_id = t.jogador_id
)
SELECT
  ARRAY(
    SELECT AS STRUCT *
    FROM ranking
    ORDER BY kills DESC NULLS LAST, jogador_id
    LIMIT @limite OFFSET @deslocamento
  ) AS jogadores,
  (SELECT COUNT(*) FROM ranking) AS total
