-- Saida: 10 mapas, 28 agentes. Contagens derivadas dos JSONs oficiais.
SELECT 'mapas' AS tabela, COUNT(*) AS linhas,
  COUNT(DISTINCT mapa_id) AS ids_unicos,
  SUM(partidas) AS partidas_ou_aparicoes,
  CAST(NULL AS INT64) AS vitorias,
  SUM(registros_com_alerta) AS alertas,
  COUNTIF(mapa_id IS NULL OR nome IS NULL OR grafias_nome_distintas != 1) AS referencias_invalidas,
  CAST(NULL AS INT64) AS taxas_incorretas
FROM `datropa.valorant.chico_teste_stats_mapa`
UNION ALL
SELECT 'agentes', COUNT(*), COUNT(DISTINCT agente_id), SUM(aparicoes),
  SUM(vitorias), SUM(registros_com_alerta),
  COUNTIF(agente_id IS NULL OR agente_id = ''),
  COUNTIF(taxa_vitoria_pct IS DISTINCT FROM 100.0 * SAFE_DIVIDE(vitorias, aparicoes))
FROM `datropa.valorant.chico_teste_stats_agente`;
