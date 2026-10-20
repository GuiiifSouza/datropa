# Pos-plant e retake

Fonte: chico_teste_rounds + chico_teste_stats_time_partida.
Destino: chico_teste_pos_plant_retake_partida, uma linha por time/partida.
Preserva torneio/mapa/data para a API filtrar ANTES de agregar.
Agrupar por time, somar oportunidades/vitorias e recalcular taxa com SAFE_DIVIDE.
Nao somar nem fazer media das taxas por partida.

Regra resultado_apos_plant_v1:
- Pos-plant: rounds em que o time era atacante e houve plant.
- Vitoria pos-plant: atacante venceu esse round.
- Retake: rounds em que o time era defensor e houve plant adversario.
- Vitoria retake: defensor venceu esse round, independentemente do motivo final.
- Taxa = 100*vitorias/oportunidades; sem oportunidades = NULL.
- Nao prova tentativa de retake. Rotulo recomendado: vitorias da defesa apos plant.
- Preserva todos os rounds, incluindo atipicos, conforme as tabelas anteriores.
- Nao descarta inconsistencias silenciosamente: status_qualidade deve ser conferido.

Referencia independente dos 336 JSONs:
6618 rounds; 4653 plants; 3295 vitorias do ataque apos plant;
1358 vitorias da defesa apos plant, sendo 1349 com desarme e nove registrados
como Round timer expired. Preservar o resultado original; nao converter esses nove
em desarme nem descarta-los. A causa do registro de tempo nao foi determinada.
Esperados 672 registros, 336 partidas, 68 times, 13236 rounds-times,
4653 oportunidades de cada lado e zero inconsistencias nas validacoes.

Comandos:
1. bq --project_id=datropa --location=southamerica-east1 query --use_legacy_sql=false --dry_run < services/stats/sql/gold/pos_plant_retake_partida.sql
2. Depois de conferir o dry run:
   bq --project_id=datropa --location=southamerica-east1 query --use_legacy_sql=false --maximum_bytes_billed=1073741824 --destination_table=datropa:valorant.chico_teste_pos_plant_retake_partida --replace < services/stats/sql/gold/pos_plant_retake_partida.sql
3. bq --project_id=datropa --location=southamerica-east1 query --use_legacy_sql=false --maximum_bytes_billed=1073741824 < services/stats/sql/gold/validacoes/pos_plant_retake_partida_teste.sql

Dry run e materializacao BigQuery pendentes. Nenhuma tabela final publicada.
