-- VERSAO OFICIAL gold_336_v1. Destino: datropa.valorant.stats_jogador_partida
-- Fontes e validacoes de teste preservadas na pasta superior.
-- Uma linha por jogador valido por partida. SELECT, sem alterar a bronze.
-- Dependencia nesta etapa: partidas. Publicacao final pendente.
-- K/D/A e rounds: resumo original. Contadores dos eventos separados para auditoria.
WITH jogadores AS (
  SELECT b.matchInfo.matchId AS partida_id, p.puuid AS jogador_id,
    COALESCE(NULLIF(p.gameName, ''), 'Jogador') AS nome,
    p.tagLine AS tag, p.teamId AS cor_time, LOWER(p.characterId) AS agente_id,
    p.stats.kills AS kills, p.stats.deaths AS deaths, p.stats.assists AS assists,
    p.stats.roundsPlayed AS rounds, p.stats.score AS score
  FROM `datropa.valorant.bronze_partidas` b
  CROSS JOIN UNNEST(b.players) p
  WHERE NOT COALESCE(p.isObserver, FALSE) AND p.teamId IN ('Red', 'Blue')
), rounds_jogador AS (
  SELECT b.matchInfo.matchId AS partida_id, ri AS round_indice,
    si AS jogador_indice, s
  FROM `datropa.valorant.bronze_partidas` b
  CROSS JOIN UNNEST(b.roundResults) r WITH OFFSET ri
  CROSS JOIN UNNEST(r.playerStats) s WITH OFFSET si
), participacao AS (
  SELECT r.partida_id, r.s.puuid AS jogador_id,
    COUNT(DISTINCT r.round_indice) AS rounds_eventos
  FROM rounds_jogador r
  JOIN jogadores j ON j.partida_id = r.partida_id AND j.jogador_id = r.s.puuid
  GROUP BY 1, 2
), dano AS (
  -- Expandir damage separado de kills evita multiplicacao de dano por abates.
  SELECT r.partida_id, r.s.puuid AS jogador_id,
    SUM(d.damage) AS dano_total, SUM(d.headshots) AS headshots,
    SUM(d.bodyshots) AS bodyshots, SUM(d.legshots) AS legshots,
    COUNTIF(d.damage IS NULL OR d.headshots IS NULL OR d.bodyshots IS NULL OR d.legshots IS NULL) AS registros_dano_incompletos
  FROM rounds_jogador r
  CROSS JOIN UNNEST(r.s.damage) d
  JOIN jogadores autor ON autor.partida_id = r.partida_id AND autor.jogador_id = r.s.puuid
  JOIN jogadores alvo ON alvo.partida_id = r.partida_id AND alvo.jogador_id = d.receiver
  WHERE autor.cor_time != alvo.cor_time
  GROUP BY 1, 2
), eventos AS (
  SELECT r.partida_id, r.round_indice, r.jogador_indice, ki AS kill_indice,
    k.killer, k.victim, k.assistants, k.timeSinceRoundStartMillis AS tempo_ms,
    a.cor_time AS cor_autor, v.cor_time AS cor_vitima,
    a.jogador_id IS NOT NULL AND v.jogador_id IS NOT NULL
      AND a.cor_time != v.cor_time AS abate_adversario
  FROM rounds_jogador r
  CROSS JOIN UNNEST(r.s.kills) k WITH OFFSET ki
  LEFT JOIN jogadores a ON a.partida_id = r.partida_id AND a.jogador_id = k.killer
  LEFT JOIN jogadores v ON v.partida_id = r.partida_id AND v.jogador_id = k.victim
), abates AS (
  SELECT partida_id, killer AS jogador_id, COUNT(*) AS kills_eventos
  FROM eventos WHERE abate_adversario GROUP BY 1, 2
), mortes AS (
  SELECT partida_id, victim AS jogador_id, COUNT(*) AS deaths_eventos,
    COUNTIF(killer = victim) AS mortes_self_kill
  FROM eventos WHERE cor_vitima IS NOT NULL GROUP BY 1, 2
), assistencias AS (
  SELECT e.partida_id, j.jogador_id, COUNT(*) AS assists_eventos
  FROM eventos e
  JOIN jogadores j ON j.partida_id = e.partida_id AND j.cor_time = e.cor_autor
    AND j.jogador_id != e.killer AND j.jogador_id != e.victim
    AND j.jogador_id IN UNNEST(e.assistants)
  WHERE e.abate_adversario
  GROUP BY 1, 2
), abertura AS (
  -- Desempate estavel pela ordem dos arrays de origem, sem inventar precisao temporal.
  SELECT partida_id, killer, victim
  FROM eventos WHERE abate_adversario AND tempo_ms >= 0
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY partida_id, round_indice
    ORDER BY tempo_ms, jogador_indice, kill_indice
  ) = 1
), fk AS (
  SELECT partida_id, killer AS jogador_id, COUNT(*) AS first_bloods
  FROM abertura GROUP BY 1, 2
), fd AS (
  SELECT partida_id, victim AS jogador_id, COUNT(*) AS first_deaths
  FROM abertura GROUP BY 1, 2
), contadores AS (
  SELECT j.*, p.torneio_id, p.mapa_id, p.inicio, p.data_partida_utc,
    CASE j.cor_time WHEN p.cor_time_a THEN p.time_a_id
      WHEN p.cor_time_b THEN p.time_b_id END AS time_id,
    CASE j.cor_time WHEN p.cor_time_a THEN p.time_a_nome
      WHEN p.cor_time_b THEN p.time_b_nome END AS time_nome,
    p.vencedor_id,
    COALESCE(r.rounds_eventos, 0) AS rounds_eventos,
    COALESCE(d.dano_total, 0) AS dano_total,
    COALESCE(d.headshots, 0) AS headshots,
    COALESCE(d.bodyshots, 0) AS bodyshots,
    COALESCE(d.legshots, 0) AS legshots,
    COALESCE(d.registros_dano_incompletos, 0) AS registros_dano_incompletos,
    COALESCE(k.kills_eventos, 0) AS kills_eventos,
    COALESCE(m.deaths_eventos, 0) AS deaths_eventos,
    COALESCE(m.mortes_self_kill, 0) AS mortes_self_kill,
    COALESCE(a.assists_eventos, 0) AS assists_eventos,
    COALESCE(f.first_bloods, 0) AS first_bloods,
    COALESCE(f2.first_deaths, 0) AS first_deaths
  FROM jogadores j
  LEFT JOIN `datropa.valorant.partidas` p USING (partida_id)
  LEFT JOIN participacao r USING (partida_id, jogador_id)
  LEFT JOIN dano d USING (partida_id, jogador_id)
  LEFT JOIN abates k USING (partida_id, jogador_id)
  LEFT JOIN mortes m USING (partida_id, jogador_id)
  LEFT JOIN assistencias a USING (partida_id, jogador_id)
  LEFT JOIN fk f USING (partida_id, jogador_id)
  LEFT JOIN fd f2 USING (partida_id, jogador_id)
)
SELECT * EXCEPT(vencedor_id),
  CASE WHEN vencedor_id IS NOT NULL AND time_id IS NOT NULL
    THEN time_id = vencedor_id END AS venceu,
  SAFE_DIVIDE(kills, deaths) AS kd,
  IF(rounds_eventos = rounds AND registros_dano_incompletos = 0,
    SAFE_DIVIDE(dano_total, rounds), NULL) AS adr,
  IF(registros_dano_incompletos = 0,
    100.0 * SAFE_DIVIDE(headshots, headshots + bodyshots + legshots), NULL) AS hs_pct,
  kills IS DISTINCT FROM kills_eventos
    OR deaths IS DISTINCT FROM deaths_eventos
    OR assists IS DISTINCT FROM assists_eventos AS divergencia_resumo_eventos,
  CASE WHEN time_id IS NULL OR torneio_id IS NULL THEN 'partida_sem_identificacao'
    WHEN jogador_id IS NULL OR jogador_id = '' THEN 'jogador_sem_id'
    WHEN rounds IS NULL OR rounds <= 0 THEN 'rounds_invalidos'
    WHEN rounds_eventos != rounds THEN 'rounds_incompletos'
    WHEN registros_dano_incompletos > 0 THEN 'dano_incompleto'
    ELSE 'ok' END AS status_qualidade,
  'resumo_original_v1' AS versao_metricas
FROM contadores;
