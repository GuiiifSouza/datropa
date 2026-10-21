-- VERSAO OFICIAL gold_336_v1. Destino: datropa.valorant.stats_time_partida
-- Fontes e validacoes de teste preservadas na pasta superior.
-- Uma linha por time por partida. Preserva filtros antes de agregacoes.
-- Desenvolvimento: le partidas; sem alteracao da bronze.
WITH times_partida AS (
  SELECT p.partida_id, p.torneio_id, p.mapa_id, p.inicio, p.data_partida_utc,
    p.vencedor_id, p.status_qualidade AS qualidade_partida,
    t.*
  FROM `datropa.valorant.partidas` p
  CROSS JOIN UNNEST([
    STRUCT(p.time_a_id AS time_id, p.time_a_nome AS nome, p.cor_time_a AS cor_time,
      p.placar_a AS placar, p.time_b_id AS adversario_id, p.placar_b AS placar_adversario),
    STRUCT(p.time_b_id AS time_id, p.time_b_nome AS nome, p.cor_time_b AS cor_time,
      p.placar_b AS placar, p.time_a_id AS adversario_id, p.placar_a AS placar_adversario)
  ]) t
), rounds_origem AS (
  SELECT b.matchInfo.matchId AS partida_id, ri AS round_indice,
    r.winningTeam AS cor_vencedora,
    CASE
      WHEN r.winningTeam IN ('Red', 'Blue') AND r.winningTeamRole = 'Attacker'
        THEN r.winningTeam
      WHEN r.winningTeam = 'Red' AND r.winningTeamRole = 'Defender' THEN 'Blue'
      WHEN r.winningTeam = 'Blue' AND r.winningTeamRole = 'Defender' THEN 'Red'
    END AS cor_atacante
  FROM `datropa.valorant.bronze_partidas` b
  CROSS JOIN UNNEST(b.roundResults) r WITH OFFSET ri
), contadores AS (
  SELECT t.*,
    (SELECT AS STRUCT
      COUNT(*) AS rounds_jogados,
      COUNTIF(r.cor_vencedora = t.cor_time) AS rounds_ganhos,
      COUNTIF(r.cor_atacante = t.cor_time) AS rounds_ataque,
      COUNTIF(r.cor_atacante = t.cor_time AND r.cor_vencedora = t.cor_time) AS vitorias_ataque,
      COUNTIF(r.cor_atacante IS NOT NULL AND r.cor_atacante != t.cor_time) AS rounds_defesa,
      COUNTIF(r.cor_atacante IS NOT NULL AND r.cor_atacante != t.cor_time AND r.cor_vencedora = t.cor_time) AS vitorias_defesa,
      COUNTIF(r.cor_atacante IS NULL) AS rounds_lado_desconhecido,
      COUNTIF(r.cor_vencedora IS NULL OR r.cor_vencedora NOT IN ('Red', 'Blue')) AS rounds_vencedor_desconhecido
    FROM rounds_origem r WHERE r.partida_id = t.partida_id) AS contagem
  FROM times_partida t
)
SELECT partida_id, torneio_id, mapa_id, inicio, data_partida_utc,
  time_id, nome, cor_time, adversario_id, placar, placar_adversario,
  CASE WHEN vencedor_id IS NOT NULL THEN vencedor_id = time_id
       WHEN placar = placar_adversario THEN FALSE END AS venceu,
  CASE WHEN vencedor_id IS NOT NULL THEN vencedor_id != time_id
       WHEN placar = placar_adversario THEN FALSE END AS perdeu,
  vencedor_id IS NULL AND placar = placar_adversario AS empate,
  contagem.*,
  100.0 * SAFE_DIVIDE(contagem.rounds_ganhos, contagem.rounds_jogados) AS taxa_rounds_pct,
  100.0 * SAFE_DIVIDE(contagem.vitorias_ataque, contagem.rounds_ataque) AS taxa_ataque_pct,
  100.0 * SAFE_DIVIDE(contagem.vitorias_defesa, contagem.rounds_defesa) AS taxa_defesa_pct,
  CASE WHEN qualidade_partida != 'ok' OR qualidade_partida IS NULL THEN 'partida_com_alerta'
       WHEN contagem.rounds_lado_desconhecido > 0 THEN 'lado_desconhecido'
       WHEN contagem.rounds_vencedor_desconhecido > 0 THEN 'vencedor_round_desconhecido'
       WHEN contagem.rounds_ganhos != placar THEN 'placar_divergente'
       WHEN vencedor_id IS NULL AND placar != placar_adversario THEN 'vencedor_partida_desconhecido'
       ELSE 'ok' END AS status_qualidade
FROM contadores;
