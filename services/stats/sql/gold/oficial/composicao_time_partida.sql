-- VERSAO OFICIAL gold_336_v1. Destino: datropa.valorant.composicao_time_partida
-- Fontes e validacoes de teste preservadas na pasta superior.
-- Uma linha por time/partida. Cinco slots ordenados; nao depende da ordem dos jogadores.
WITH elencos AS (
  SELECT partida_id, time_id,
    COUNT(*) AS jogadores,
    COUNT(DISTINCT jogador_id) AS jogadores_unicos,
    COUNTIF(NULLIF(agente_id, '') IS NULL) AS agentes_ausentes,
    COUNT(DISTINCT NULLIF(agente_id, '')) AS agentes_distintos,
    COUNTIF(status_qualidade IS NULL OR status_qualidade != 'ok') AS jogadores_com_alerta,
    ARRAY_AGG(COALESCE(agente_id, '') ORDER BY COALESCE(agente_id, '')) AS agente_ids
  FROM `datropa.valorant.stats_jogador_partida`
  GROUP BY partida_id, time_id
), base AS (
  SELECT t.partida_id, t.torneio_id, t.mapa_id, t.inicio, t.data_partida_utc,
    t.time_id, t.nome AS time_nome, t.adversario_id, t.venceu, t.perdeu, t.empate,
    COALESCE(e.agente_ids, ARRAY<STRING>[]) AS agente_ids,
    COALESCE(e.jogadores, 0) AS jogadores,
    COALESCE(e.jogadores_unicos, 0) AS jogadores_unicos,
    COALESCE(e.agentes_ausentes, 0) AS agentes_ausentes,
    COALESCE(e.agentes_distintos, 0) AS agentes_distintos,
    CASE WHEN t.status_qualidade IS NULL OR t.status_qualidade != 'ok' THEN 'time_partida_com_alerta'
      WHEN e.jogadores IS NULL OR e.jogadores != 5 OR e.jogadores_unicos != 5 THEN 'elenco_incompleto_ou_duplicado'
      WHEN e.agentes_ausentes > 0 THEN 'agente_ausente'
      WHEN e.agentes_distintos != 5 THEN 'agente_repetido'
      WHEN e.jogadores_com_alerta > 0 THEN 'jogador_com_alerta'
      ELSE 'ok' END AS status_qualidade
  FROM `datropa.valorant.stats_time_partida` t
  LEFT JOIN elencos e ON e.partida_id = t.partida_id AND e.time_id = t.time_id
)
SELECT *,
  -- ID inclui mapa, mas nao time: permite agrupar a mesma composicao entre equipes.
  IF(status_qualidade = 'ok',
    CONCAT('composicao_', LOWER(TO_HEX(SHA256(
      TO_JSON_STRING(STRUCT(mapa_id AS mapa_id, agente_ids AS agente_ids)))))),
    NULL) AS composicao_id,
  status_qualidade = 'ok' AS composicao_valida,
  'cinco_agentes_ordenados_por_mapa_v1' AS versao_regra
FROM base;
