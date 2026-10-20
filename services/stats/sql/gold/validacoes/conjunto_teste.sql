-- Conferencia conjunta do snapshot de 336 partidas. Somente SELECT.
-- Nao substitui as validacoes individuais nem a integracao API/front.
WITH verificacoes AS (
SELECT 'partidas_linhas' AS verificacao, COUNT(*) AS encontrado, 336 AS esperado FROM `datropa.valorant.chico_teste_partidas`
UNION ALL
SELECT 'jogador_partida_linhas' AS verificacao, COUNT(*) AS encontrado, 3360 AS esperado FROM `datropa.valorant.chico_teste_stats_jogador_partida`
UNION ALL
SELECT 'ranking_linhas' AS verificacao, COUNT(*) AS encontrado, 411 AS esperado FROM `datropa.valorant.chico_teste_ranking_jogador`
UNION ALL
SELECT 'time_partida_linhas' AS verificacao, COUNT(*) AS encontrado, 672 AS esperado FROM `datropa.valorant.chico_teste_stats_time_partida`
UNION ALL
SELECT 'time_resumo_linhas' AS verificacao, COUNT(*) AS encontrado, 332 AS esperado FROM `datropa.valorant.chico_teste_stats_time`
UNION ALL
SELECT 'mapa_stats_linhas' AS verificacao, COUNT(*) AS encontrado, 10 AS esperado FROM `datropa.valorant.chico_teste_stats_mapa`
UNION ALL
SELECT 'agente_stats_linhas' AS verificacao, COUNT(*) AS encontrado, 28 AS esperado FROM `datropa.valorant.chico_teste_stats_agente`
UNION ALL
SELECT 'rounds_linhas' AS verificacao, COUNT(*) AS encontrado, 6618 AS esperado FROM `datropa.valorant.chico_teste_rounds`
UNION ALL
SELECT 'eventos_linhas' AS verificacao, COUNT(*) AS encontrado, 52755 AS esperado FROM `datropa.valorant.chico_teste_eventos_round`
UNION ALL
SELECT 'catalogo_mapas_linhas' AS verificacao, COUNT(*) AS encontrado, 10 AS esperado FROM `datropa.valorant.chico_teste_mapas`
UNION ALL
SELECT 'pos_plant_linhas' AS verificacao, COUNT(*) AS encontrado, 672 AS esperado FROM `datropa.valorant.chico_teste_pos_plant_retake_partida`
UNION ALL
SELECT 'composicao_linhas' AS verificacao, COUNT(*) AS encontrado, 672 AS esperado FROM `datropa.valorant.chico_teste_composicao_time_partida`
UNION ALL
SELECT 'economia_linhas' AS verificacao, COUNT(*) AS encontrado, 13236 AS esperado FROM `datropa.valorant.chico_teste_economia_time_round`
UNION ALL
SELECT 'eventos_sem_round' AS verificacao, (SELECT COUNT(*) FROM `datropa.valorant.chico_teste_eventos_round` e LEFT JOIN `datropa.valorant.chico_teste_rounds` r ON r.partida_id=e.partida_id AND r.round_indice_origem=e.round_indice WHERE r.partida_id IS NULL OR e.mapa_id IS DISTINCT FROM r.mapa_id OR e.`round` IS DISTINCT FROM r.`round`) AS encontrado, 0 AS esperado
UNION ALL
SELECT 'rounds_sem_partida' AS verificacao, (SELECT COUNT(*) FROM `datropa.valorant.chico_teste_rounds` r LEFT JOIN `datropa.valorant.chico_teste_partidas` p USING(partida_id) WHERE p.partida_id IS NULL OR r.mapa_id IS DISTINCT FROM p.mapa_id) AS encontrado, 0 AS esperado
UNION ALL
SELECT 'jogadores_sem_time_partida' AS verificacao, (SELECT COUNT(*) FROM `datropa.valorant.chico_teste_stats_jogador_partida` j LEFT JOIN `datropa.valorant.chico_teste_stats_time_partida` t USING(partida_id,time_id) WHERE t.time_id IS NULL) AS encontrado, 0 AS esperado
UNION ALL
SELECT 'pos_plant_retake_partida_sem_time_partida' AS verificacao, (SELECT COUNT(*) FROM `datropa.valorant.chico_teste_pos_plant_retake_partida` a LEFT JOIN `datropa.valorant.chico_teste_stats_time_partida` t USING(partida_id,time_id) WHERE t.time_id IS NULL OR a.mapa_id IS DISTINCT FROM t.mapa_id) AS encontrado, 0 AS esperado
UNION ALL
SELECT 'composicao_time_partida_sem_time_partida' AS verificacao, (SELECT COUNT(*) FROM `datropa.valorant.chico_teste_composicao_time_partida` a LEFT JOIN `datropa.valorant.chico_teste_stats_time_partida` t USING(partida_id,time_id) WHERE t.time_id IS NULL OR a.mapa_id IS DISTINCT FROM t.mapa_id) AS encontrado, 0 AS esperado
UNION ALL
SELECT 'economia_sem_round' AS verificacao, (SELECT COUNT(*) FROM `datropa.valorant.chico_teste_economia_time_round` e LEFT JOIN `datropa.valorant.chico_teste_rounds` r USING(partida_id,round_indice_origem) WHERE r.partida_id IS NULL OR e.mapa_id IS DISTINCT FROM r.mapa_id OR (e.time_id IS DISTINCT FROM r.atacante_id AND e.time_id IS DISTINCT FROM r.defensor_id)) AS encontrado, 0 AS esperado
UNION ALL
SELECT 'ranking_totais_divergentes' AS verificacao, (SELECT COUNT(*) FROM (
SELECT SUM(partidas) AS participacoes,SUM(kills) AS kills,SUM(deaths) AS deaths,SUM(assists) AS assists,SUM(dano_total) AS dano FROM `datropa.valorant.chico_teste_ranking_jogador`) a CROSS JOIN (
SELECT COUNT(*) AS participacoes,SUM(kills) AS kills,SUM(deaths) AS deaths,SUM(assists) AS assists,SUM(dano_total) AS dano FROM `datropa.valorant.chico_teste_stats_jogador_partida`) b
WHERE a.participacoes IS DISTINCT FROM b.participacoes OR a.kills IS DISTINCT FROM b.kills OR a.deaths IS DISTINCT FROM b.deaths OR a.assists IS DISTINCT FROM b.assists OR a.dano IS DISTINCT FROM b.dano) AS encontrado, 0 AS esperado
UNION ALL
SELECT 'pos_plant_totais_divergentes' AS verificacao, (SELECT COUNT(*) FROM (
SELECT SUM(pos_plant_oportunidades) AS plantas,SUM(retake_oportunidades) AS defesas,SUM(pos_plant_vitorias+retake_vitorias) AS vitorias,SUM(desarmes) AS desarmes FROM `datropa.valorant.chico_teste_pos_plant_retake_partida`) a CROSS JOIN (
SELECT COUNTIF(tem_plant) AS plantas,COUNTIF(teve_desarme) AS desarmes FROM `datropa.valorant.chico_teste_rounds`) b
WHERE a.plantas IS DISTINCT FROM b.plantas OR a.defesas IS DISTINCT FROM b.plantas OR a.vitorias IS DISTINCT FROM b.plantas OR a.desarmes IS DISTINCT FROM b.desarmes) AS encontrado, 0 AS esperado
)
SELECT *, encontrado = esperado AS passou
FROM verificacoes ORDER BY verificacao;
