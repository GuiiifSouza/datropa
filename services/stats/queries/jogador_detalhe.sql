-- Detalhe de jogador. Somente leitura da Gold.
-- STRING: jogador_id (obrigatorio), torneio_id, mapa_id, agente_id,
-- data_inicio, data_fim. Opcionais NULL ou "" = sem filtro.
-- Datas ISO YYYY-MM-DD convertidas com CAST; data invalida gera erro.
-- Zero linhas = jogador inexistente. Uma linha com resumo zero = recorte vazio.
WITH filtros AS (
  SELECT NULLIF(@torneio_id, '') AS torneio_id,
    NULLIF(@mapa_id, '') AS mapa_id,
    NULLIF(@agente_id, '') AS agente_id,
    CAST(NULLIF(@data_inicio, '') AS DATE) AS data_inicio,
    CAST(NULLIF(@data_fim, '') AS DATE) AS data_fim
), historico AS (
  SELECT jogador_id, nome, partida_id, inicio, data_partida_utc,
    torneio_id, mapa_id, agente_id, time_id, time_nome, venceu,
    rounds, kills, deaths, assists, rounds_eventos, dano_total,
    headshots, bodyshots, legshots, registros_dano_incompletos, first_bloods
  FROM `datropa.valorant.stats_jogador_partida`
  WHERE jogador_id = @jogador_id
), identidade AS (
  SELECT jogador_id AS id, nome FROM historico
  QUALIFY ROW_NUMBER() OVER (
    ORDER BY inicio DESC NULLS LAST, partida_id DESC
  ) = 1
), recorte AS (
  SELECT h.* FROM historico h CROSS JOIN filtros f
  WHERE (f.torneio_id IS NULL OR h.torneio_id = f.torneio_id)
    AND (f.mapa_id IS NULL OR h.mapa_id = f.mapa_id)
    AND (f.agente_id IS NULL OR h.agente_id = f.agente_id)
    AND (f.data_inicio IS NULL OR h.data_partida_utc >= f.data_inicio)
    AND (f.data_fim IS NULL OR h.data_partida_utc <= f.data_fim)
), resumo AS (
  SELECT COUNT(DISTINCT partida_id) AS partidas,
    COALESCE(SUM(rounds), 0) AS rounds,
    COALESCE(SUM(kills), 0) AS kills,
    COALESCE(SUM(deaths), 0) AS deaths,
    COALESCE(SUM(assists), 0) AS assists,
    SAFE_DIVIDE(SUM(kills), SUM(deaths)) AS kd,
    IF(COUNT(*) > 0 AND COUNTIF(
      rounds_eventos IS NULL OR rounds IS NULL OR rounds_eventos != rounds
      OR registros_dano_incompletos IS NULL OR registros_dano_incompletos != 0
      OR dano_total IS NULL
    ) = 0, SAFE_DIVIDE(SUM(dano_total), SUM(rounds)), NULL) AS adr,
    IF(COUNT(*) > 0 AND COUNTIF(
      registros_dano_incompletos IS NULL OR registros_dano_incompletos != 0
      OR headshots IS NULL OR bodyshots IS NULL OR legshots IS NULL
    ) = 0, 100.0 * SAFE_DIVIDE(SUM(headshots),
      SUM(headshots + bodyshots + legshots)), NULL) AS hs_pct,
    COALESCE(SUM(first_bloods), 0) AS first_bloods
  FROM recorte
), times_recorte AS (
  SELECT time_id AS id, time_nome AS nome FROM recorte
  WHERE time_id IS NOT NULL
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY time_id ORDER BY inicio DESC NULLS LAST, partida_id
  ) = 1
), agentes AS (
  SELECT agente_id, COUNT(DISTINCT partida_id) AS partidas,
    COUNTIF(venceu IS TRUE) AS vitorias,
    -- Resultado desconhecido nao entra no denominador da taxa.
    100.0 * SAFE_DIVIDE(COUNTIF(venceu IS TRUE), COUNT(venceu)) AS taxa_vitoria_pct
  FROM recorte GROUP BY agente_id
), mapas AS (
  SELECT mapa_id, COUNT(DISTINCT partida_id) AS partidas,
    COUNTIF(venceu IS TRUE) AS vitorias,
    100.0 * SAFE_DIVIDE(COUNTIF(venceu IS TRUE), COUNT(venceu)) AS taxa_vitoria_pct
  FROM recorte GROUP BY mapa_id
), agentes_catalogo AS (
  -- Catalogo estatico local (app/catalogos/agentes.json), enviado pela API.
  SELECT JSON_VALUE(item, '$.id') AS id, JSON_VALUE(item, '$.nome') AS nome
  FROM UNNEST(JSON_QUERY_ARRAY(@agentes_json)) AS item
), mapas_catalogo AS (
  SELECT id, nome FROM `datropa.valorant.mapas`
)
-- Agentes e mapas: mais partidas primeiro, depois vitorias, nome e ID.
SELECT i.id, i.nome,
  ARRAY(SELECT AS STRUCT t.id, t.nome FROM times_recorte t ORDER BY t.id) AS times,
  STRUCT(r.partidas AS partidas, r.rounds AS rounds, r.kills AS kills,
    r.deaths AS deaths, r.assists AS assists, r.kd AS kd, r.adr AS adr,
    r.hs_pct AS hs_pct, r.first_bloods AS first_bloods) AS resumo,
  ARRAY(SELECT AS STRUCT a.agente_id, a.partidas, a.vitorias, a.taxa_vitoria_pct,
      c.nome
    FROM agentes a LEFT JOIN agentes_catalogo c ON c.id = a.agente_id
    ORDER BY a.partidas DESC, a.vitorias DESC, c.nome ASC NULLS LAST,
      a.agente_id) AS agentes,
  ARRAY(SELECT AS STRUCT m.mapa_id, m.partidas, m.vitorias, m.taxa_vitoria_pct,
      c.nome
    FROM mapas m LEFT JOIN mapas_catalogo c ON c.id = m.mapa_id
    ORDER BY m.partidas DESC, m.vitorias DESC, c.nome ASC NULLS LAST,
      m.mapa_id) AS mapas
FROM identidade i CROSS JOIN resumo r;
