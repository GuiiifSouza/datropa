-- VERSAO OFICIAL gold_336_v1. Destino: datropa.valorant.stats_agente
-- Fontes e validacoes de teste preservadas na pasta superior.
-- Uma aparicao = um jogador valido em um mapa jogado.
-- Nome e funcao do agente: join posterior no catalogo UUID mantido por Gugu.
-- Filtros de torneio/mapa/data/time/jogador: aplicar em stats_jogador_partida antes de agregar.
WITH totais AS (
  SELECT agente_id, COUNT(*) AS aparicoes,
    COUNTIF(venceu) AS vitorias,
    COUNTIF(venceu IS NULL) AS resultados_desconhecidos,
    SUM(rounds) AS rounds, SUM(kills) AS kills,
    SUM(deaths) AS deaths, SUM(assists) AS assists,
    SUM(dano_total) AS dano_total, SUM(headshots) AS headshots,
    SUM(bodyshots) AS bodyshots, SUM(legshots) AS legshots,
    SUM(first_bloods) AS first_bloods,
    COUNTIF(status_qualidade != 'ok' OR status_qualidade IS NULL) AS registros_com_alerta
  FROM `datropa.valorant.stats_jogador_partida`
  GROUP BY agente_id
)
SELECT *,
  IF(resultados_desconhecidos = 0, 100.0 * SAFE_DIVIDE(vitorias, aparicoes), NULL) AS taxa_vitoria_pct,
  SAFE_DIVIDE(kills, deaths) AS kd,
  IF(registros_com_alerta = 0, SAFE_DIVIDE(dano_total, rounds), NULL) AS adr,
  IF(registros_com_alerta = 0, 100.0 * SAFE_DIVIDE(headshots, headshots + bodyshots + legshots), NULL) AS hs_pct
FROM totais;
