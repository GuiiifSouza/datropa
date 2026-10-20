-- Eventos para prancheta/calor; snapshots originais, sem interpolacao.
-- Abates inclui mortes ambientais e fogo amigo, com flags para distinguir combate.
WITH jogadores AS (
  SELECT partida_id, jogador_id, time_id, agente_id
  FROM `datropa.valorant.chico_teste_stats_jogador_partida`
), origem AS (
  SELECT b.matchInfo.matchId AS partida_id, ri AS round_indice,
    rr.`round`, rr.mapa_id, rr.torneio_id, rr.inicio, rr.data_partida_utc, rr.round_atipico,
    r
  FROM `datropa.valorant.bronze_partidas` b
  CROSS JOIN UNNEST(b.roundResults) r WITH OFFSET ri
  LEFT JOIN `datropa.valorant.chico_teste_rounds` rr
    ON rr.partida_id = b.matchInfo.matchId AND rr.round_indice_origem = ri
), eventos AS (
  SELECT o.partida_id, o.round_indice, o.`round`, o.mapa_id, o.torneio_id,
    o.inicio, o.data_partida_utc, o.round_atipico,
    CONCAT('abate_', CAST(si AS STRING), '_', CAST(ki AS STRING)) AS chave_origem,
    'abate' AS tipo, 0 AS tipo_ordem, si AS origem_indice, ki AS evento_indice,
    k.timeSinceRoundStartMillis AS tempo_ms,
    k.timeSinceGameStartMillis AS tempo_jogo_ms,
    NULLIF(k.killer, '') AS ator_id, NULLIF(k.victim, '') AS vitima_id,
    k.assistants AS assistentes_origem,
    IF(k.finishingDamage.damageType = 'Weapon', LOWER(NULLIF(k.finishingDamage.damageItem, '')), NULL) AS arma_id,
    k.finishingDamage.damageType AS dano_final_tipo,
    k.finishingDamage.damageItem AS dano_final_item_origem,
    CAST(NULL AS STRING) AS site,
    IF(k.victimLocation.x IS NULL OR k.victimLocation.y IS NULL, NULL,
      STRUCT(CAST(k.victimLocation.x AS FLOAT64) AS x, CAST(k.victimLocation.y AS FLOAT64) AS y)) AS posicao,
    k.playerLocations AS posicoes_origem
  FROM origem o
  CROSS JOIN UNNEST(o.r.playerStats) s WITH OFFSET si
  CROSS JOIN UNNEST(s.kills) k WITH OFFSET ki

  UNION ALL

  SELECT o.partida_id, o.round_indice, o.`round`, o.mapa_id, o.torneio_id,
    o.inicio, o.data_partida_utc, o.round_atipico,
    'plant', 'plant', 1, 0, 0, o.r.plantRoundTime, CAST(NULL AS INT64),
    NULLIF(o.r.bombPlanter, ''), CAST(NULL AS STRING), ARRAY<STRING>[],
    CAST(NULL AS STRING), CAST(NULL AS STRING), CAST(NULL AS STRING), o.r.plantSite,
    IF(o.r.plantLocation.x IS NULL OR o.r.plantLocation.y IS NULL, NULL,
      STRUCT(CAST(o.r.plantLocation.x AS FLOAT64) AS x, CAST(o.r.plantLocation.y AS FLOAT64) AS y)),
    o.r.plantPlayerLocations
  FROM origem o
  WHERE o.r.plantRoundTime IS NOT NULL AND NULLIF(o.r.plantSite, '') IS NOT NULL

  UNION ALL

  SELECT o.partida_id, o.round_indice, o.`round`, o.mapa_id, o.torneio_id,
    o.inicio, o.data_partida_utc, o.round_atipico,
    'defuse', 'defuse', 2, 0, 0, o.r.defuseRoundTime, CAST(NULL AS INT64),
    NULLIF(o.r.bombDefuser, ''), CAST(NULL AS STRING), ARRAY<STRING>[],
    CAST(NULL AS STRING), CAST(NULL AS STRING), CAST(NULL AS STRING), NULLIF(o.r.plantSite, ''),
    IF(o.r.defuseLocation.x IS NULL OR o.r.defuseLocation.y IS NULL, NULL,
      STRUCT(CAST(o.r.defuseLocation.x AS FLOAT64) AS x, CAST(o.r.defuseLocation.y AS FLOAT64) AS y)),
    o.r.plantPlayerLocations
  FROM origem o WHERE NULLIF(o.r.bombDefuser, '') IS NOT NULL
), assistencias AS (
  -- JOIN fora de ARRAY correlacionado: evita a limitacao do BigQuery.
  SELECT e.partida_id, e.round_indice, e.chave_origem,
    ARRAY_AGG(DISTINCT j.jogador_id ORDER BY j.jogador_id) AS assistente_ids
  FROM eventos e
  CROSS JOIN UNNEST(e.assistentes_origem) a
  JOIN jogadores j ON j.partida_id = e.partida_id AND j.jogador_id = a
  GROUP BY e.partida_id, e.round_indice, e.chave_origem
), posicoes AS (
  SELECT e.partida_id, e.round_indice, e.chave_origem,
    ARRAY_AGG(STRUCT(j.jogador_id, j.time_id, j.agente_id,
      STRUCT(CAST(l.location.x AS FLOAT64) AS x,
        CAST(l.location.y AS FLOAT64) AS y) AS posicao) ORDER BY li) AS jogadores
  FROM eventos e
  CROSS JOIN UNNEST(e.posicoes_origem) l WITH OFFSET li
  JOIN jogadores j ON j.partida_id = e.partida_id AND j.jogador_id = l.puuid
  WHERE e.tipo != 'defuse'
    AND l.location.x IS NOT NULL AND l.location.y IS NOT NULL
  GROUP BY e.partida_id, e.round_indice, e.chave_origem
), identificados AS (
  SELECT e.* EXCEPT(assistentes_origem, posicoes_origem),
    IFNULL(ast.assistente_ids, ARRAY<STRING>[]) AS assistente_ids,
    IFNULL(p.jogadores,
      ARRAY<STRUCT<jogador_id STRING, time_id STRING, agente_id STRING,
        posicao STRUCT<x FLOAT64, y FLOAT64>>>[]) AS jogadores,
    a.time_id AS ator_time_id, v.time_id AS vitima_time_id,
    a.agente_id AS ator_agente_id
  FROM eventos e
  LEFT JOIN assistencias ast USING (partida_id, round_indice, chave_origem)
  LEFT JOIN posicoes p USING (partida_id, round_indice, chave_origem)
  LEFT JOIN jogadores a ON a.partida_id = e.partida_id AND a.jogador_id = e.ator_id
  LEFT JOIN jogadores v ON v.partida_id = e.partida_id AND v.jogador_id = e.vitima_id
)
SELECT CONCAT('evento_', LOWER(TO_HEX(SHA256(CONCAT(partida_id, ':', CAST(round_indice AS STRING), ':', chave_origem))))) AS id,
  partida_id, `round`, round_indice, mapa_id, torneio_id, inicio, data_partida_utc,
  ROW_NUMBER() OVER (PARTITION BY partida_id, round_indice
    ORDER BY tempo_ms IS NULL, tempo_ms, tipo_ordem, origem_indice, evento_indice) AS ordem,
  tipo, tempo_ms, tempo_jogo_ms, ator_id, vitima_id, assistente_ids,
  ator_time_id, vitima_time_id, ator_agente_id, arma_id, dano_final_tipo, dano_final_item_origem,
  site, posicao, jogadores, round_atipico,
  tipo = 'abate' AND ator_id = vitima_id AS self_kill,
  tipo = 'abate' AND ator_id != vitima_id AND ator_time_id = vitima_time_id AS fogo_amigo,
  tipo = 'abate' AND ator_time_id IS NOT NULL AND vitima_time_id IS NOT NULL
    AND ator_time_id != vitima_time_id AS abate_adversario,
  CASE WHEN mapa_id IS NULL OR `round` IS NULL THEN 'round_sem_identificacao'
    WHEN tempo_ms IS NULL OR tempo_ms < 0 THEN 'tempo_invalido'
    WHEN ator_time_id IS NULL THEN 'ator_desconhecido'
    WHEN tipo = 'abate' AND vitima_time_id IS NULL THEN 'vitima_desconhecida'
    WHEN posicao IS NULL THEN 'posicao_ausente'
    ELSE 'ok' END AS status_qualidade
FROM identificados;
