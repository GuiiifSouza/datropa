-- Resumo geral e por mapa em uma unica tabela, distinguindo escopo.
-- Nao somar linhas 'geral' com 'mapa': isso duplicaria os totais.
-- Filtros de torneio e data da API exigem agregar stats_time_partida apos filtrar.
WITH totais AS (
  SELECT time_id, ANY_VALUE(nome) AS nome, mapa_id,
    IF(GROUPING(mapa_id) = 1, 'geral', 'mapa') AS escopo,
    COUNT(DISTINCT partida_id) AS partidas,
    COUNTIF(venceu) AS vitorias, COUNTIF(perdeu) AS derrotas,
    COUNTIF(empate) AS empates,
    SUM(rounds_jogados) AS rounds_jogados, SUM(rounds_ganhos) AS rounds_ganhos,
    SUM(rounds_ataque) AS rounds_ataque, SUM(vitorias_ataque) AS vitorias_ataque,
    SUM(rounds_defesa) AS rounds_defesa, SUM(vitorias_defesa) AS vitorias_defesa,
    COUNTIF(status_qualidade != 'ok' OR status_qualidade IS NULL) AS registros_com_alerta
  FROM `datropa.valorant.chico_teste_stats_time_partida`
  GROUP BY GROUPING SETS ((time_id), (time_id, mapa_id))
)
SELECT *,
  IF(registros_com_alerta = 0, 100.0 * SAFE_DIVIDE(vitorias, partidas), NULL) AS taxa_vitoria_pct,
  IF(registros_com_alerta = 0, 100.0 * SAFE_DIVIDE(rounds_ganhos, rounds_jogados), NULL) AS taxa_rounds_pct,
  IF(registros_com_alerta = 0, 100.0 * SAFE_DIVIDE(vitorias_ataque, rounds_ataque), NULL) AS taxa_ataque_pct,
  IF(registros_com_alerta = 0, 100.0 * SAFE_DIVIDE(vitorias_defesa, rounds_defesa), NULL) AS taxa_defesa_pct
FROM totais;
