# Entrega da Gold do Chico — estado em 20/10/2026

Branch: chico/gold-principal. Pasta: services/stats/sql/gold/.
Estado: 13 tabelas de TESTE criadas; validacoes individuais executadas e
21 verificacoes conjuntas aprovadas pelo Chico no Cloud Shell.
Nenhum merge ou publicacao final realizado por esta entrega.
Nao declarar toda a parte concluida: mapas/conversao e integracao pendentes.

## Evidencia conjunta

Dry run de validacoes/conjunto_teste.sql: 6997754 bytes.
Saida enviada pelo Chico: 21 linhas, todas passou=true.
Contagens das 13 tabelas corretas; nenhuma referencia ausente nas verificacoes
eventos/rounds, rounds/partidas, jogadores/times, composicao/times,
pos-plant/times e economia/rounds. Totais de ranking e pos-plant reconciliados.
Esses testes nao substituem teste de API, filtros, front e alinhamento dos mapas.

## Tabelas existentes no dataset datropa.valorant

Todos os nomes abaixo possuem o prefixo chico_teste_.

| Nome sem prefixo | Granularidade | Linhas | Fonte principal |
|---|---|---:|---|
| partidas | partida | 336 | bronze_partidas |
| stats_jogador_partida | jogador/partida | 3360 | bronze + partidas |
| ranking_jogador | jogador historico | 411 | stats_jogador_partida |
| stats_time_partida | time/partida | 672 | bronze + partidas |
| stats_time | time geral e time/mapa | 332 | stats_time_partida |
| stats_mapa | mapa | 10 | partidas |
| stats_agente | agente | 28 | stats_jogador_partida |
| rounds | partida/round | 6618 | bronze + partidas |
| eventos_round | evento | 52755 | bronze + rounds + stats_jogador_partida |
| mapas | mapa observado | 10 | partidas + candidatos do PDF |
| pos_plant_retake_partida | time/partida | 672 | rounds + stats_time_partida |
| composicao_time_partida | time/partida | 672 | stats_jogador_partida + stats_time_partida |
| economia_time_round | time/round | 13236 | bronze + rounds + stats_jogador_partida |

## O que a API pode consumir

- Ranking e perfil do jogador: stats_jogador_partida, somando contadores e
  recalculando razoes DEPOIS dos filtros. ranking_jogador e apenas total historico.
- Time: stats_time_partida para filtros; stats_time tem escopos geral/mapa que
  nao podem ser somados juntos.
- Mapas/agentes: stats_mapa/stats_agente para total; para filtros usar as bases
  por partida antes da agregacao.
- Partida e round: partidas, stats_jogador_partida, rounds.
- Prancheta/calor: eventos_round, coordenadas originais, snapshots parciais;
  desarme sem snapshot inventado. Calor de combate contra adversarios deve
  considerar a flag abate_adversario para evitar ambiente/self-kills/fogo amigo.
- Pos-plant/retake: pos_plant_retake_partida; retake mede vitoria da defesa apos
  plant, nao tentativa. Preserva 9 vitorias por tempo alem de 1349 desarmes.
- Composicoes: composicao_time_partida; cinco slots ordenados/mapa, filtrar
  composicao_valida, agrupar e recalcular taxas. 198 combinacoes distintas.
- Economia: economia_time_round; limites propostos versionados por soma dos
  equipamentos. Eco <10000, force <20000, full >=20000. Revisar semantica com time.
- Catalogos de nomes/classes/icones de agentes/armas/armaduras sao de Gugu.
- Busca, comparacoes, filtros e envelopes sao trabalho da API; nao pressupor
  que necessitam de uma tabela materializada por rota.

## Pendencias para conversar com o time

### Chico + Lhobregat/Rhuan
Receber imagens/URLs dos minimapas exatos, com orientacao, recortes e margens.
Validar pelo menos tres plants por mapa sobre essas imagens.
Nove matrizes do PDF sao candidatas, nao publicadas; Summit/plummet sem calibracao.
Ter u/v entre 0 e 1 nao comprova alinhamento.
Transformacao publica e minimapa_url continuam NULL.
A disponibilidade/uso de metadados externos depende do alinhamento do time com
a organizacao conforme docs/plano-de-acao.md.

### Chico + Gugu
Acordar nomes finais e versao da carga, convencao de eixos e campos de mapas.
O PDF troca eixos; a proposta simples atual de docs/api.md nao representa isso.
Validar limites economicos e rotulo de retake antes da publicacao.
API deve filtrar por partida antes de agregar, preservar NULL e recalcular razoes.
Diferencas resumo/eventos e rounds atipicos continuam explicitas; nao filtrar
ou mudar regras sem alinhamento.
MVP e rounds decisivos permanecem sem criterio acordado, conforme contrato.

### Guilherme
Revisar e fazer merge do PR da pasta gold. Coordenar publicacao e acesso da API.
Preservar as seis partidas corrigidas na origem da recarga: bronze tem 336.
Nao recarregar dados nem mudar IAM/infra como parte desta revisao de SQL.

## Como oficializar, sem confundir GitHub com BigQuery

1. Revisar esta entrega e as pendencias. Definir escopo que sera publicado.
2. Acordar os nomes finais com API/coach e conferir se ja existem tabelas
   nesses destinos; planejar preservacao/retorno antes de substituir algo existente.
3. Preparar versao dos SQLs e validacoes que referencia os destinos finais.
   Trocar somente o destination_table NAO basta: as consultas usam dependencias
   chico_teste_ internamente.
4. Abrir PR de chico/gold-principal para main; revisao do dono e merge por Guilherme.
   Pode ser uma entrega parcial claramente rotulada, com mapas pendentes.
5. Com a versao aprovada, dry run e materializacao coordenados na ordem:
   partidas; stats_jogador_partida e stats_time_partida; rounds;
   ranking_jogador/stats_time/stats_mapa/stats_agente/mapas;
   eventos_round/pos_plant_retake_partida/composicao_time_partida/economia_time_round.
6. Executar validacoes individuais e conjunta adaptadas aos destinos finais.
7. Gugu integra API e cache/versao da carga; Guilherme integra tools do coach;
   front verifica numeros, filtros, round base 1 e pontos nos minimapas.
8. Testar ponta a ponta. So entao afirmar que a entrega publicada funciona no produto.
   Nao apagar testes antes de concluir essa verificacao.

Merge nao cria tabela no BigQuery; tabela criada nao liga automaticamente a API.

## Escopo adicional do PDF

KAST, trocas, isolamento, WPA/modelo e percentis nao implementados neste conjunto.
Nao fazem parte da lista principal de entregas de Chico em docs/plano-de-acao.md.
Sao extensoes a priorizar explicitamente; nao prometer equivalencia completa com
o site Raio-X sem engine/resultados de referencia e validacao.
