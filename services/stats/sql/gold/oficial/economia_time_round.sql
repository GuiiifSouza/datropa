-- VERSAO OFICIAL gold_336_v1. Destino: datropa.valorant.economia_time_round
-- Fontes e validacoes de teste preservadas na pasta superior.
-- Uma linha por time/round; classificacao por equipamento total, regra versionada.
WITH jogadores AS (
  SELECT partida_id, jogador_id, time_id
  FROM `datropa.valorant.stats_jogador_partida`
), equipamentos AS (
  SELECT b.matchInfo.matchId AS partida_id, ri AS round_indice_origem, j.time_id,
    COUNT(*) AS registros_jogador,
    COUNT(DISTINCT s.puuid) AS jogadores_unicos,
    COUNTIF(s.economy.loadoutValue IS NOT NULL AND s.economy.loadoutValue >= 0) AS equipamentos_validos,
    SUM(s.economy.loadoutValue) AS equipamento_total_origem,
    IF(COUNTIF(s.economy.spent IS NOT NULL AND s.economy.spent >= 0) = 5,
      SUM(s.economy.spent), NULL) AS gasto_total,
    IF(COUNTIF(s.economy.remaining IS NOT NULL AND s.economy.remaining >= 0) = 5,
      SUM(s.economy.remaining), NULL) AS saldo_total
  FROM `datropa.valorant.bronze_partidas` b
  CROSS JOIN UNNEST(b.roundResults) r WITH OFFSET ri
  CROSS JOIN UNNEST(r.playerStats) s
  JOIN jogadores j ON j.partida_id = b.matchInfo.matchId AND j.jogador_id = s.puuid
  GROUP BY partida_id, round_indice_origem, j.time_id
), base AS (
  SELECT r.partida_id, r.torneio_id, r.mapa_id, r.inicio, r.data_partida_utc,
    r.`round`, r.round_indice_origem, r.round_atipico,
    t.time_id, t.lado, t.adversario_id, r.vencedor_id = t.time_id AS venceu,
    COALESCE(e.registros_jogador, 0) AS registros_jogador,
    COALESCE(e.jogadores_unicos, 0) AS jogadores_unicos,
    COALESCE(e.equipamentos_validos, 0) AS equipamentos_validos,
    e.equipamento_total_origem, e.gasto_total, e.saldo_total,
    e.registros_jogador = 5 AND e.jogadores_unicos = 5
      AND e.equipamentos_validos = 5 AS economia_completa,
    r.status_qualidade AS qualidade_round
  FROM `datropa.valorant.rounds` r
  CROSS JOIN UNNEST([
    STRUCT(r.atacante_id AS time_id, 'ataque' AS lado, r.defensor_id AS adversario_id),
    STRUCT(r.defensor_id AS time_id, 'defesa' AS lado, r.atacante_id AS adversario_id)
  ]) t
  LEFT JOIN equipamentos e ON e.partida_id = r.partida_id
    AND e.round_indice_origem = r.round_indice_origem AND e.time_id = t.time_id
), cobertura AS (
  SELECT *,
    COUNTIF(economia_completa AND equipamento_total_origem > 0)
      OVER (PARTITION BY partida_id, time_id) > 0 AS tem_equipamento_positivo_na_partida
  FROM base
), classificada AS (
  SELECT *,
    IF(economia_completa, equipamento_total_origem, NULL) AS equipamento_total,
    CASE WHEN NOT COALESCE(economia_completa, FALSE) THEN NULL
      WHEN NOT tem_equipamento_positivo_na_partida THEN NULL
      WHEN equipamento_total_origem < 10000 THEN 'eco'
      WHEN equipamento_total_origem < 20000 THEN 'force'
      ELSE 'full' END AS categoria,
    CASE WHEN qualidade_round IS NULL OR qualidade_round != 'ok'
      OR time_id IS NULL OR adversario_id IS NULL OR venceu IS NULL THEN 'round_com_alerta'
      WHEN NOT COALESCE(economia_completa, FALSE) THEN 'economia_incompleta'
      WHEN NOT tem_equipamento_positivo_na_partida THEN 'economia_toda_zero_na_partida'
      ELSE 'ok' END AS status_qualidade
  FROM cobertura
)
SELECT * EXCEPT(qualidade_round),
  'equipamento_time_10000_20000_v1' AS classificacao_versao
FROM classificada;
