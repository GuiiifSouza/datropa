-- Referencia dos 336 JSONs: 6618 rounds, 4653 plants, 1349 desarmes, 6 atipicos.
SELECT COUNT(*) AS rounds,
  COUNT(DISTINCT TO_JSON_STRING(STRUCT(partida_id, `round`))) AS chaves_unicas,
  COUNT(DISTINCT partida_id) AS partidas,
  COUNTIF(tem_plant) AS plants,
  COUNTIF(teve_desarme) AS desarmes,
  COUNTIF(round_atipico) AS rounds_atipicos,
  COUNTIF(lado_vencedor = 'ataque') AS vitorias_ataque,
  COUNTIF(lado_vencedor = 'defesa') AS vitorias_defesa,
  COUNTIF(status_qualidade != 'ok') AS alertas,
  COUNTIF(`round` != round_indice_origem + 1) AS numeracao_diferente_indice,
  COUNTIF(resultado IS NULL OR resultado = 'outro') AS resultados_sem_mapeamento,
  COUNTIF(vencedor_id IS NULL OR atacante_id IS NULL OR defensor_id IS NULL) AS times_sem_id
FROM `datropa.valorant.chico_teste_rounds`;
