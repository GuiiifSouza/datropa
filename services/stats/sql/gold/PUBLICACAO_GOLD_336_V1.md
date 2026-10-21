# Publicacao Gold gold_336_v1 — evidencia revisada

Fonte: logs enviados por Chico, sem nova consulta ao BigQuery pelo agente.
Execucao: 20/10/2026, a partir de 20h51 (Brasilia), 23h51 UTC.
PR: https://github.com/GuiiifSouza/datropa/pull/7

## Resultado

- 13 tabelas oficiais criadas; 13 dry runs oficiais aprovados.
- 24 verificacoes conjuntas com passou=true.
- 12 consultas individuais revisadas; zero alertas, referencias invalidas e taxas incorretas nos respectivos campos.
- Nenhum comando dos dois logs retornou codigo diferente de zero.
- 10 transformacoes publicadas, iguais as candidatas; zero eventos sem mapa.
- API/front/cache/coach e merge ainda nao confirmados.

## Dry runs oficiais

| Destino em datropa.valorant | Bytes estimados |
|---|---:|
| partidas | 67622494 |
| stats_jogador_partida | 24274906 |
| stats_time_partida | 232028 |
| rounds | 8787952 |
| ranking_jogador | 996878 |
| stats_time | 125497 |
| stats_mapa | 21709 |
| stats_agente | 386400 |
| mapas | 10638 |
| eventos_round | 43823226 |
| pos_plant_retake_partida | 1937468 |
| composicao_time_partida | 935345 |
| economia_time_round | 9557866 |

Soma das estimativas dos 13 SELECTs: 158712407 bytes. Nao e valor faturado nem inclui as consultas de validacao.

## Observacoes de auditoria

stats_jogador_partida: diferencas_kills=0; diferencas_deaths=308;
diferencas_assists=134. Essas sao divergencias entre resumo original e eventos,
preservadas separadamente. Nao classificadas como erro de carga pelos checks.
K/D/A oficial continua usando players.stats; nao reconstruir a partir da timeline.
As causas completas das 308/134 divergencias nao foram reanalisadas nesta revisao.
Eventos: 52755; abates/mortes 46753; adversarios 46371; plants 4653;
desarmes 1349; self_kills 373; fogo_amigo 9. Snapshots inventados de defuse=0.
Rounds atipicos=6 preservados; nao confundir com seis partidas recuperadas.

## Integridade dos logs originais

Os logs permanecem com Chico; nao incluir saidas extensas ou JSONs de partida no repo.

- 20261020T235150257633Z_publicar.jsonl
  SHA256: 74a01a34f7c67bb3b3035013a303ef213691db14f1e5f4dfe2f3e3123685d251

- 20261020T235103256287Z_verificar.jsonl
  SHA256: caef7329b8114d0972742a8295b331602ba4e69e3967a96e6f04c1a7b4573f77
