-- VERSAO OFICIAL gold_336_v1. Destino: datropa.valorant.rounds
-- Fontes e validacoes de teste preservadas na pasta superior.
-- Uma linha por round; numero publico comeca em 1.
-- Marca rounds atipicos sem exclui-los dos placares ou estatisticas.
WITH origem AS (
  SELECT b.matchInfo.matchId AS partida_id, ri AS round_indice_origem, r,
    p.torneio_id, p.mapa_id, p.inicio, p.data_partida_utc,
    p.time_a_id, p.time_b_id, p.cor_time_a, p.cor_time_b,
    CASE r.winningTeam WHEN p.cor_time_a THEN p.time_a_id
      WHEN p.cor_time_b THEN p.time_b_id END AS vencedor_id,
    CASE
      WHEN r.winningTeam IN ('Red', 'Blue') AND r.winningTeamRole = 'Attacker'
        THEN r.winningTeam
      WHEN r.winningTeam = 'Red' AND r.winningTeamRole = 'Defender' THEN 'Blue'
      WHEN r.winningTeam = 'Blue' AND r.winningTeamRole = 'Defender' THEN 'Red'
    END AS cor_atacante,
    r.plantRoundTime IS NOT NULL AND NULLIF(r.plantSite, '') IS NOT NULL AS tem_plant,
    (SELECT COUNTIF(NULLIF(k.killer, '') IS NOT NULL AND k.killer = k.victim
      AND k.timeSinceRoundStartMillis >= 0 AND k.timeSinceRoundStartMillis < 15000)
      FROM UNNEST(r.playerStats) s CROSS JOIN UNNEST(s.kills) k) AS self_kills_primeiros_15s
  FROM `datropa.valorant.bronze_partidas` b
  CROSS JOIN UNNEST(b.roundResults) r WITH OFFSET ri
  LEFT JOIN `datropa.valorant.partidas` p
    ON p.partida_id = b.matchInfo.matchId
), normalizado AS (
  SELECT *,
    CASE cor_atacante WHEN cor_time_a THEN time_a_id
      WHEN cor_time_b THEN time_b_id END AS atacante_id,
    CASE cor_atacante WHEN cor_time_a THEN time_b_id
      WHEN cor_time_b THEN time_a_id END AS defensor_id
  FROM origem
)
SELECT partida_id, torneio_id, mapa_id, inicio, data_partida_utc,
  COALESCE(r.roundNum, round_indice_origem) + 1 AS `round`,
  round_indice_origem, r.roundNum AS round_num_origem,
  vencedor_id, atacante_id, defensor_id, cor_atacante,
  CASE r.winningTeamRole WHEN 'Attacker' THEN 'ataque'
    WHEN 'Defender' THEN 'defesa' END AS lado_vencedor,
  CASE r.roundResult
    WHEN 'Eliminated' THEN 'eliminacao'
    WHEN 'Bomb detonated' THEN 'detonacao'
    WHEN 'Bomb defused' THEN 'desarme'
    WHEN 'Round timer expired' THEN 'tempo'
    ELSE IF(NULLIF(r.roundResult, '') IS NULL, NULL, 'outro')
  END AS resultado,
  r.roundResult AS resultado_origem, tem_plant,
  IF(tem_plant, r.plantSite, NULL) AS plant_site,
  IF(tem_plant, r.plantRoundTime, NULL) AS plant_tempo_ms,
  IF(tem_plant, NULLIF(r.bombPlanter, ''), NULL) AS planter_id,
  NULLIF(r.bombDefuser, '') AS defuser_id,
  NULLIF(r.bombDefuser, '') IS NOT NULL AS teve_desarme,
  IF(NULLIF(r.bombDefuser, '') IS NOT NULL, r.defuseRoundTime, NULL) AS defuse_tempo_ms,
  self_kills_primeiros_15s, self_kills_primeiros_15s >= 3 AS round_atipico,
  IF(self_kills_primeiros_15s >= 3, '3 ou mais self-kills antes de 15 segundos', NULL) AS motivo_atipico,
  'self_kills_3_15s_v1' AS versao_regra_atipico,
  CASE WHEN vencedor_id IS NULL OR atacante_id IS NULL OR defensor_id IS NULL THEN 'time_ou_lado_desconhecido'
    WHEN COALESCE(r.roundNum, round_indice_origem) < 0 THEN 'round_invalido'
    WHEN tem_plant AND (NULLIF(r.bombPlanter, '') IS NULL OR r.plantRoundTime < 0) THEN 'plant_incompleto'
    WHEN NULLIF(r.bombDefuser, '') IS NOT NULL AND
      (NOT tem_plant OR r.defuseRoundTime IS NULL OR r.defuseRoundTime < r.plantRoundTime) THEN 'desarme_inconsistente'
    ELSE 'ok' END AS status_qualidade
FROM normalizado;
