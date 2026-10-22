WITH identidades AS (
  -- ranking_jogador traz o nick da partida mais recente do jogador.
  SELECT jogador_id, nome
  FROM `datropa.valorant.ranking_jogador`
),
jogadores AS (
  SELECT
    s.partida_id,
    ARRAY_AGG(
      STRUCT(
        s.jogador_id,
        -- nome: nick mais recente, igual ao ranking e ao detalhe
        -- do jogador. nome_partida: nick usado nesta partida.
        COALESCE(i.nome, s.nome) AS nome,
        s.nome AS nome_partida,
        time_id,
        agente_id,
        kills,
        deaths,
        assists,
        adr,
        hs_pct,
        first_bloods
      )
      ORDER BY
        kills DESC NULLS LAST,
        (deaths IS NULL) ASC,
        deaths ASC,
        s.jogador_id
    ) AS itens
  FROM `datropa.valorant.stats_jogador_partida` s
  LEFT JOIN identidades i
    ON i.jogador_id = s.jogador_id
  WHERE s.partida_id = @partida_id
  GROUP BY s.partida_id
),
rounds_agrupados AS (
  SELECT
    partida_id,
    ARRAY_AGG(
      STRUCT(
        `round`,
        vencedor_id,
        lado_vencedor,
        resultado
      )
      ORDER BY `round`
    ) AS itens
  FROM `datropa.valorant.rounds`
  WHERE partida_id = @partida_id
  GROUP BY partida_id
)
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
  p.vencedor_id,
  IFNULL(j.itens, []) AS jogadores,
  IFNULL(r.itens, []) AS rounds,
  CAST(NULL AS STRING) AS mvp_jogador_id,
  ARRAY<INT64>[] AS rounds_decisivos
FROM `datropa.valorant.partidas` p
LEFT JOIN jogadores j
  ON j.partida_id = p.partida_id
LEFT JOIN rounds_agrupados r
  ON r.partida_id = p.partida_id
WHERE p.partida_id = @partida_id;