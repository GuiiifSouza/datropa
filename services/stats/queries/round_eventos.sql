WITH round_existente AS (
  SELECT partida_id, mapa_id, `round`
  FROM `datropa.valorant.rounds`
  WHERE partida_id = @partida_id
    AND `round` = @round
),
eventos_agrupados AS (
  SELECT
    partida_id,
    `round`,
    ARRAY_AGG(
      STRUCT(
        id,
        ordem,
        tipo,
        tempo_ms,
        ator_id,
        vitima_id,
        assistente_ids,
        arma_id,
        site,
        dano_final_tipo,
        self_kill,
        fogo_amigo,
        abate_adversario,
        ator_time_id,
        vitima_time_id,
        ator_agente_id,
        posicao,
        jogadores
      )
      ORDER BY
        (tempo_ms IS NULL) ASC,
        tempo_ms ASC,
        ordem ASC
    ) AS eventos
  FROM `datropa.valorant.eventos_round`
  WHERE partida_id = @partida_id
    AND `round` = @round
  GROUP BY partida_id, `round`
)
SELECT
  r.partida_id,
  r.mapa_id,
  r.`round`,
  IFNULL(e.eventos, []) AS eventos
FROM round_existente r
LEFT JOIN eventos_agrupados e
  ON e.partida_id = r.partida_id
  AND e.`round` = r.`round`;