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
