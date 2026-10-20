# Gold do Chico: implementacao por etapas

Branch: `chico/gold-principal`. Pasta exclusiva: `services/stats/sql/gold/`.
Contrato de saida: `docs/api.md`, confirmado pelo Chico com Gugu em 20/10/2026.
Cada SELECT e uma transformacao; nomes de rotas HTTP nao precisam corresponder a uma tabela.

## Ordem

1. `partidas.sql`: IDs, torneio, mapa, datas UTC, nomes de times e correspondencia Red/Blue pelo placar.
2. Jogador por partida e contadores por round: kills, mortes, assistencias, dano contra adversarios, head/body/leg, FK/FD. Nao somar arrays de kills e damage no mesmo JOIN, para evitar multiplicar registros.
3. Estatisticas principais: ranking, times, jogador, mapa, agente e detalhe de partida. Somar contadores e recalcular razoes; preservar filtros por partida.
4. Eventos de abate/plant/defuse e mapas: coordenadas originais e transformacao validada com o front.
5. Economia, pos-plant, retake e composicoes.
6. Extensoes do Raio-X: KAST, trocas, isolamento, WPA/modelo versionado e percentis, conforme dados e tempo disponiveis.

## Primeira tabela

`partida_id` preserva matchId. `mapa_id` usa o ultimo componente interno do mapId em minusculas, separado do nome para exibicao. `time_id` usa prefixo `time_` e SHA256 hexadecimal minusculo do slug normalizado NFC e minusculo, sem juntar equipes por prefixo. Grafias alternativas exigem mapa explicito, nao uniao automatica por jogadores compartilhados.

Inicio vem de gameStartMillis, sem inventar horario a partir do nome do arquivo. A data do arquivo fica separada. Datas de filtro usam UTC. Placares identificam a cor apenas quando ambos os lados batem e nao ha empate; casos ambiguos ficam sinalizados. Nao inferir lado de ataque/defesa de Red/Blue. Exibir nomes a partir dos slugs e uma apresentacao provisoria, nao a grafia oficial.

## Como testar

Primeiro dry run (nao cria tabela):

```bash
bq --project_id=datropa --location=southamerica-east1 query --use_legacy_sql=false --dry_run < services/stats/sql/gold/partidas.sql
```

Registrar a saida e os bytes antes de executar. Depois criar apenas o destino de teste (sobrescreve exclusivamente essa tabela de teste ao repetir):

```bash
bq --project_id=datropa --location=southamerica-east1 query --use_legacy_sql=false --maximum_bytes_billed=1073741824 --destination_table=datropa:valorant.chico_teste_partidas --replace < services/stats/sql/gold/partidas.sql
bq --project_id=datropa --location=southamerica-east1 query --use_legacy_sql=false --maximum_bytes_billed=1073741824 < services/stats/sql/gold/validacoes/partidas_teste.sql
```

Esperado na base oficial enviada: 336 linhas/IDs, 6618 rounds, zero alertas de parse e correspondencia de cores. Validacao local dos 336 arquivos: todos reconhecidos e correspondencia unica de placar; sem execucao BigQuery ate receber o dry run. Nao abrir PR como concluido sem esse resultado. Conferir tambem amostras reais, inclusive inversao Red/Blue. Tabela final e integracao so apos validacao; sem merge automatico.

## Guia Raio-X recebido em PDF

Referencia fornecida pelo Chico, 14 paginas, 20/10/2026. Nao e um gabarito validado: o proprio PDF informa que o motor e seus resultados nao foram executados/verificados. Para equivalencia exata, precisamos do engine.js ou de resultados por partida para comparacao.

Manter o contrato atual como prioridade. Contadores extras podem ser guardados sem alterar as respostas publicas; expor novos campos/filtros depende de alinhamento com Gugu/front.

Diferencas a resolver antes de copiar regras:

- PDF exclui rounds atipicos por padrao; contrato nao define esse filtro. Guardar a flag (>=3 self-kills antes de 15s) e preservar os contadores de todos os rounds; nao excluir silenciosamente da API.
- PDF limita cada registro de dano a 150; contrato usa dano total a adversarios. Preservar valor original e calcular uma variante separada se necessario. O limite nao foi validado para registros agregados/curas.
- Separar mortes de self-kill e abates contra adversarios; verificar killer ausente e eventos invalidos. Trocas exigem colega e mesma partida/round, com criterio de desempate explicito. Isolamento sem snapshot suficiente deve ser desconhecido, sem concluir que nao havia colegas vivos.
- Economia: limiares sugeridos 10000/20000 por time; nao tratar economia incompleta como eco. Pistol e categoria adicional no PDF, fora das tres categorias da API; definir tratamento sem mudar contrato silenciosamente.
- Transformacao de mapa do PDF troca eixos (u depende de y, v de x); contrato atual propoe u de x e v de y. A formula simples nao representa essa troca sem convencao adicional. Nao publicar coeficientes antes de validar com Lhobregat e os minimapas usados.
- Pesos WPA e modelo treinado precisam de versao, verificacao e evidencia antes de alimentar recomendacoes. As coordenadas/calibracoes e funcoes de agentes do PDF nao foram conferidas contra fontes estaticas autorizadas.

Sem JSONs brutos, dados pessoais, PDF ou credenciais em commit. Bronze corrigida manualmente para 336; Guilherme deve preservar isso na fonte de recarga.

## Evidencia recebida: primeiro dry run

20/10/2026: Chico executou o dry run de `partidas.sql` no Cloud Shell. Saida: `Query successfully validated. Assuming the tables are not modified, running this query will process 67622494 bytes of data.` Estimativa: 67.622.494 bytes (64,49 MiB). Ainda nao comprova resultados: materializacao e validacao da tabela de teste pendentes.

## Evidencia recebida: tabela de teste de partidas

20/10/2026: saida de `validacoes/partidas_teste.sql` enviada pelo Chico: linhas=336, partidas_unicas=336, partidas_com_alerta=0, cores_nao_resolvidas=0, times_sem_id=0, partidas_sem_inicio=0, rounds_totais=6618. A tabela `valorant.chico_teste_partidas` passou nessas verificacoes agregadas. Conferencia de amostras e tabela final ainda pendentes. Nenhum merge ou publicacao de tabela final realizado.

## Times por partida: etapa preparada

`stats_time_partida.sql`: duas linhas por partida, nomes e IDs estaveis, adversario, placar, resultado e contadores por lado. Ataque/defesa vem de winningTeamRole e winningTeam, inclusive overtime; nao de uma regra fixa de numero do round nem da cor.
Dependencia: chico_teste_partidas. Destino: chico_teste_stats_time_partida.
Validacao local independente: 672 linhas/336 partidas/68 slugs de time, 336 vitorias e 336 derrotas, 0 empates, 13236 rounds-times, 6618 rounds ganhos. Rounds ataque=6618 e defesa=6618; vitorias ataque=3427 e defesa=3191. Todos os placares conferidos contra os vencedores dos rounds.
SQL BigQuery ainda aguarda dry run; o time total e por mapa sera agregado sobre esta granularidade, preservando filtros da API.

## Evidencia recebida: dry run dos times

20/10/2026: Chico executou `stats_time_partida.sql` com dry run. BigQuery retornou `Query successfully validated` e estimativa de 232028 bytes. Materializacao e validacao da tabela de teste pendentes.

## Evidencia recebida: times por partida executados

20/10/2026: validacao enviada pelo Chico: linhas=672, chaves_unicas=672, partidas=336, times=68, vitorias=336, derrotas=336, empates=0, alertas=0, rounds_times=13236, rounds_ganhos=6618, rounds_ataque=6618, rounds_defesa=6618, vitorias_ataque=3427, vitorias_defesa=3191, lados_inconsistentes=0, vitorias_inconsistentes=0. Totais coincidem com o calculo independente nos JSONs. Ainda apenas destino de teste.

## Resumo de times: preparado

`stats_time.sql` agrega a base por partida com GROUPING SETS: escopo='geral' (mapa_id null) ou escopo='mapa'. Nao misturar os dois escopos na soma. Referencia independente dos nomes e mapIds dos JSONs: 68 times e 264 pares time/mapa, total 332 linhas. Cada escopo soma 672 participacoes, 336 vitorias e 336 derrotas. Percentuais recalculados a partir dos totais. Filtros adicionais de periodo/torneio devem ser aplicados a stats_time_partida antes de agregar, nao depois na tabela total. Dry run e execucao pendentes. Destino de teste: chico_teste_stats_time.

## Evidencia recebida: dry run do resumo de times

20/10/2026: Chico executou `stats_time.sql` com dry run. Resultado: `Query successfully validated`, estimativa de 125497 bytes. Execucao e validacao dos resultados pendentes.

## Evidencia recebida: resumo dos times executado

20/10/2026: linhas=332, chaves_unicas=332, times_gerais=68, recortes_time_mapa=264, participacoes_gerais=672, participacoes_por_mapa=672, vitorias=336, derrotas=336, rounds_times=13236, alertas=0, resultados_inconsistentes=0, taxas_incorretas=0. Validacao enviada pelo Chico confere com a referencia local. Destino ainda de teste.

## Mapas e agentes: preparados

`stats_mapa.sql`: 10 mapas; fonte partidas, nao contar uma partida por jogador. mapa_id interno estavel e nome publico derivado do arquivo; este resumo nao e a futura tabela `mapas` de conversao de coordenadas.
`stats_agente.sql`: 28 UUIDs, 3360 aparicoes jogador-partida e 1680 vitorias. Funcao, nome e icone dependem do catalogo de Gugu, sem fontes externas adicionadas nesta etapa. Agregacoes de dano, rounds e tiros preservam contadores para recalcular taxas.
Destinos de teste: chico_teste_stats_mapa e chico_teste_stats_agente. Validacao conjunta em validacoes/mapas_agentes_teste.sql. Dry runs e execucoes pendentes.

## Evidencias recebidas: dry runs de mapas e agentes

20/10/2026: ambos retornaram `Query successfully validated` no Cloud Shell do Chico. stats_mapa.sql: 21709 bytes. stats_agente.sql: 386400 bytes. Materializacao e validacao conjunta ainda pendentes.

## Evidencias recebidas: mapas e agentes executados

20/10/2026: mapas=10 linhas e IDs, 336 partidas, alertas=0, referencias_invalidas=0; agentes=28 linhas e IDs, 3360 aparicoes, 1680 vitorias, alertas=0, referencias_invalidas=0, taxas_incorretas=0. Valores null em vitorias/taxas de mapas sao campos nao aplicaveis da validacao conjunta, nao erros.

## Rounds: preparados

`rounds.sql`: 6618 linhas, numeros publicos base 1, time atacante/defensor pelo papel real, resultado normalizado, plant e desarme. Dependencia de teste chico_teste_partidas; destino chico_teste_rounds. Conferencia local nos JSONs: 4653 plants, 1349 desarmes, 3427 vitorias no ataque, 3191 na defesa; roundNum sempre igual ao indice. Regra do PDF identifica 6 rounds com >=3 self-kills validas nos primeiros 15s. Flag preservada sem excluir nenhum round da API ou dos agregados existentes. Dry run, execucao e auditoria dos alertas pendentes.

## Evidencia recebida: dry run dos rounds

20/10/2026: Chico executou `rounds.sql` com dry run. Resultado: `Query successfully validated`, estimativa de 8787952 bytes. Execucao e validacao dos resultados pendentes.

## Evidencia recebida: rounds executados

20/10/2026: rounds=6618, chaves_unicas=6618, partidas=336, plants=4653, desarmes=1349, rounds_atipicos=6, vitorias_ataque=3427, vitorias_defesa=3191; alertas=0, numeracao_diferente_indice=0, resultados_sem_mapeamento=0, times_sem_id=0. Validacao no Cloud Shell enviada pelo Chico coincide com os totais independentes dos JSONs. Ainda somente tabela de teste.

## Eventos de round: preparados

`eventos_round.sql`: IDs SHA256 de partida/indice do round/posicao do evento na origem; ordem estavel por tempo e desempate deterministico. Coordenadas originais do jogo, sem transformacao. Abate usa posicao da vitima; plant/defuse usa spike. Snapshots so de abate/plant quando disponiveis; desarme tem array vazio, sem inventar posicoes. Arma so quando damageType=Weapon, sem converter habilidade em UUID de arma.
Preserva self-kills e fogo amigo com flags, distinguindo abate_adversario. Para calor de abates atribuiveis ao autor/time, filtrar abate_adversario; revisar a semantica na integracao, para nao misturar fogo amigo/ambiente com combate adversario. Sem mudanca no envelope publico nesta etapa.
Referencia local: 52755 eventos, 46753 abates/mortes (46371 contra adversario, 373 self-kills e 9 outros entre jogadores), 4653 plants, 1349 desarmes. Todos os atores/vitimas da origem pertencem aos jogadores validos; coordenadas de evento e tempos de abate presentes. Funcoes, colecoes e schema SQL ainda precisam de dry run BigQuery. Destino: chico_teste_eventos_round; dependencias: chico_teste_rounds e chico_teste_stats_jogador_partida.

## Eventos: correcao e validacao recebidas

20/10/2026: arrays correlacionados com JOIN substituidos por agregacoes separadas.
Chico enviou dry run aprovado: 43823226 bytes.
Validacao da tabela: eventos=52755, ids_unicos=52755, partidas=336,
abates=46753, plants=4653, desarmes=1349, self_kills=373, fogo_amigo=9,
abates_adversarios=46371, alertas=0, snapshots_defuse_inventados=0,
ordens_unicas=52755. Ainda apenas destino de teste.

## Catalogo e conversao dos mapas: preparados

mapas.sql e validacoes/mapas_teste.sql preparados para dez mapas e 336 partidas.
Nove matrizes candidatas do PDF; Summit sem calibracao. Transformacao publica
e minimapa_url NULL: troca de eixos nao cabe na proposta atual do contrato.
Detalhes e pendencias em MAPAS_COORDENADAS.md; amostras de tres plants por mapa
em validacoes/mapas_amostras.sql. Nao chamar conversao de concluida ate conferir
os minimapas exatos com Lhobregat e alinhar o contrato com Gugu.
Dry run, materializacao e validacao visual desta etapa pendentes.

## Mapas: validacao recebida e pendencia adiada

20/10/2026: dry run mapas.sql aprovado, 10638 bytes. Catalogo executado:
10 mapas/IDs, 336 partidas, 9 candidatos PDF, 1 sem calibracao,
0 calibracoes validadas, 0 transformacoes publicadas, 0 alertas, 0 eventos_sem_mapa.
Amostras: 27 plants com coordenadas candidatas dentro de 0..1; tres Summit NULL.
Isso nao valida alinhamento com imagem. Chico decidiu continuar as demais tabelas
e verificar depois os minimapas exatos/links com Lhobregat e a calibracao pendente.

## Pos-plant e retake: preparados

pos_plant_retake_partida.sql preserva uma linha por time/partida e filtros.
Referencia local independente: 672 linhas, 336 partidas, 13236 rounds-times;
4653 oportunidades por lado, 3295 vitorias pos-plant, 1358 vitorias da defesa
apos plant, sendo 1349 desarmes e nove resultados de tempo esgotado.
Nao presume tentativa de retake nem altera resultado original.
Detalhes em POS_PLANT_RETAKE.md. SQL e validacao enviados para a branch;
dry run e materializacao BigQuery pendentes.

## Pos-plant/retake: evidencia recebida

20/10/2026: dry run aprovado, 1937468 bytes. Validacao enviada pelo Chico:
672 linhas/chaves, 336 partidas, 68 times, 13236 rounds-times,
4653 oportunidades por lado, 3295 vitorias do ataque, 1358 da defesa,
1349 desarmes, 9 vitorias da defesa sem desarme/por tempo;
alertas, contadores_inconsistentes, taxas_incorretas e partidas_inconsistentes = 0.

## Composicoes: preparadas

composicao_time_partida.sql e validacao preparam 672 linhas por time/partida,
com cinco slots ordenados e ID de mapa/lista estavel; filtros antes de agregar.
Referencia local dos 336 JSONs: 198 pares mapa/composicao, 3360 slots,
336 vitorias e 336 derrotas, nenhuma composicao incompleta.
Detalhes em COMPOSICOES.md. Dry run e materializacao BigQuery pendentes.
