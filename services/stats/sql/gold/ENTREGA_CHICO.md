> Atualizacao oficial de 20/10/2026: Guilherme autorizou a oficializacao, conforme
> relato de Chico. As decisoes de dados antes pendentes de Gugu foram fixadas em
> [OFICIALIZACAO_E_API.md](OFICIALIZACAO_E_API.md). Esse documento e os SQLs de
> oficial/ prevalecem sobre as pendencias historicas abaixo. Publicacao e dry runs
> oficiais ainda aguardam execucao no Cloud Shell; nao houve merge nesta etapa.
> Chico confirmou os HTMLs revisados e a causa Iso nas amostras investigadas.

# Entrega da Gold do Chico — estado em 20/10/2026

Branch: chico/gold-principal. Pasta: services/stats/sql/gold/.
Estado: 13 tabelas de TESTE criadas; validacoes individuais executadas e
21 verificacoes conjuntas aprovadas pelo Chico no Cloud Shell.
Nenhum merge ou publicacao final realizado por esta entrega.
Plants conferidos pelo Chico nos dez mapas; Summit incluido no SQL.
Tabela de mapas atualizada no BigQuery e validada pelo Chico em 20/10/2026.
Contrato da conversao, destinos finais, publicacao e integracao ainda pendentes.
Este estado considera as saidas e conferencias enviadas pelo Chico; nao representa
nova execucao independente no BigQuery nem verificacao do produto publicado.

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

## Mapas: etapa de plants concluida em teste

Plants conferidos pelo Chico em Ascent, Abyss, Breeze, Fracture, Haven, Lotus,
Pearl, Split, Sunset e Summit. Manter as formulas atuais.
Amostra 4 de Ascent esclarecida: centro correto; borda do marcador fora do site
nao representa erro da coordenada. As seis amostras de Ascent conferiram contra
a bronze nos campos comparados.

Chico executou o SQL atualizado de mapas e enviou a validacao:
mapas=10, ids_unicos=10, partidas=336, matrizes_disponiveis=10,
sem_calibracao=0, calibracoes_validadas=10, mapas_com_plants_conferidos=10,
transformacoes_publicadas=0, alertas=0, eventos_sem_mapa=0.
Dry run de mapas.sql: 10638 bytes.

A validacao cobre os plants amostrados nas imagens locais usadas.
Mortes e snapshots tambem foram conferidos pelo Chico nos dez mapas, conforme
registro abaixo. A conferencia local nao cobre API nem prancheta integrada.
O teste de Ascent em SVG foi preparado, mas seu resultado nao foi confirmado.
Se o SVG mudar recorte, orientacao ou margens, conferir novamente o alinhamento.


## Mortes e snapshots: conferencia local em 20/10/2026

Resultado informado pelo Chico, sem afirmar cobertura de todos os eventos:
- Ascent, Fracture, Lotus, Pearl, Split, Summit e Sunset: amostras visualmente corretas.
- Abyss: demais amostras corretas; amostras 1 e 2 no round 14 da partida
  6ad69da1-9dac-459b-88a7-108fdbd71bfa com vitimas fora da area do mapa.
  JSON original registra cinco mortes Fall nesse round; duas aos 23779 e 23798 ms.
  Queda confirmada; intencao e correspondencia exata com cada amostra nao confirmadas.
- Breeze: amostras 8 e 9, rounds 17 e 6, partida
  72a9e2e7-f86a-483b-a35c-8291e8c71c89.
  Round 6: Kaytoh mata INTL Psychovv (Iso), 70619 ms, vitima x=-50627, y=676.
  Round 17: INTL Psychovv (Iso) mata ddz, 17995 ms, vitima x=-49653, y=-947.
  Ambos Weapon e anteriores ao plant; explosao da spike nao explica esses eventos.
- Haven: amostras 8 e 9 nas partidas ffe8bfdd-1687-44cc-8fcf-1e2358999044
  e 4934cac4-80c0-4ece-a51e-ec6a1f644436; vitimas com x proximo de -50000,
  mortes Weapon envolvendo Iso. Ha varios eventos assim nesses JSONs; vincular
  cada captura ao evento_id antes de atribuir uma amostra a um abate especifico.

Investigacao registrada nesta conversa: varredura dos JSONs locais encontrou
12 mortes com victimLocation.x < -40000; todas envolviam Iso como autor ou vitima.
A arena da ultimate e uma explicacao forte, mas o JSON consultado nao registra
explicitamente a entrada na arena. Confirmacao por video continua pendente.
Nao usar esse limiar sozinho como classificador universal de habilidade.
Referencia de comportamento: https://playvalorant.com/en-gb/news/game-updates/valorant-patch-notes-10-04/

### Tratamento proposto e implementacao do teste

- Manter matrizes e coordenadas originais; nao deslocar nem limitar pontos a borda.
- Preservar os eventos e contadores; separar a exibicao espacial da estatistica.
- O teste mostra somente marcadores dentro da imagem e lista as coordenadas externas.
  Ausencia de marcador nao significa ausencia de abate.
- Avisar explicitamente vitima fora da imagem ou posicao invalida.
- Exibir possivel arena do Iso como hipotese apenas com coordenada extrema e
  associacao ao agente nos participantes ou nas partidas investigadas.
- Limites 0 a 1 medem a imagem, nao a area caminhavel. Quedas podem estar dentro
  da imagem e fora da area jogavel; nao classificar toda queda como erro.
- Sem mudanca de schema, SQL produtivo ou contrato publico neste ajuste.
  API/front ainda precisam acordar classificacao, avisos e exclusao de posicoes
  externas dos mapas de calor, preservando os totais de abates.

Script versionado: validacoes/atualizar_htmls_mortes.py.
Na raiz do checkout, executar:
```bash
python3 services/stats/sql/gold/validacoes/atualizar_htmls_mortes.py
cloudshell download testes_mortes_revisados/testes_mortes_revisados.zip
```
Reutiliza os HTMLs e dados ja exportados, sem consultar BigQuery. Gera copias,
preserva os originais e permite selecionar PNG/SVG como antes.
Se os HTMLs originais nao estiverem no checkout local, recupera-los primeiro.

- [x] Registrar conferencia local dos dez mapas e evidencias das excecoes.
- [x] Preparar script de revisao dos HTMLs com avisos para vitima e snapshots.
- [ ] Chico executar script e reconferir Abyss, Breeze e Haven; informar evento_id,
  imagem/versao e resultado. O novo HTML ainda nao foi conferido por ele.
- [ ] Confirmar hipotese da arena do Iso por video, se disponivel.
- [ ] Gugu e front acordarem o tratamento publico de posicoes externas.
- [ ] Chico apoiar a conferencia na prancheta integrada apos API/front prontos.

## O que falta ao Chico, em ordem

- [ ] Fechar com Gustavo (Gugu) os nomes e destinos finais das 13 tabelas e a
  versao da carga. A mensagem de alinhamento ja foi enviada pelo Chico;
  o retorno ainda nao foi informado nesta conversa.
- [ ] Fechar com Gugu e Lhobregat a transformacao publica dos mapas. Proposta:
  matriz de seis campos ja existente no SQL:
  `u=x*u_x+y*u_y+u_offset`; `v=x*v_x+y*v_y+v_offset`.
  Origem superior esquerda, coordenadas normalizadas; nao trocar eixos duas vezes.
  Gugu atualiza o contrato/API; Chico ajusta a saida de mapas.sql ao acordo.
  O campo publico transformacao continua NULL ate esse alinhamento.
- [ ] Registrar os arquivos/URLs e versoes exatas dos minimapas do front com
  Lhobregat/Rhuan. Summit tem URL registrada; os outros nove ainda nao.
  Confirmar o teste de Ascent SVG caso esse seja o arquivo adotado pelo front.
- [ ] Confirmar com Gugu/front as regras ja implementadas: economia por soma
  de equipamento (10000/20000), retake como resultado apos plant, NULL,
  filtros antes de agregar e razoes recalculadas pelos totais. Ajustar SQL
  somente se o acordo exigir; definir MVP/rounds decisivos ou manter sem criterio.
- [ ] Adaptar SQLs e validacoes aos destinos finais acordados, incluindo todas
  as referencias internas chico_teste_. Conferir destinos existentes antes
  de qualquer substituicao. Preparar PR com evidencias para revisao de Guilherme.
- [ ] Apos aprovacao e coordenacao com Guilherme, executar dry runs, criar as
  tabelas finais na ordem de dependencia e repetir validacoes individuais e conjunta.
  Guardar comandos, bytes e resultados. Merge sozinho nao publica tabelas.
- [ ] Conferir os dados na API e no front com os responsaveis: numeros e filtros,
  round publico base 1, plants, mortes e snapshots espalhados pelos mapas,
  mapa de calor e round real na prancheta. Corrigir problemas da Gold encontrados.
- [ ] Registrar o resultado final neste documento e confirmar a entrega publicada.
  Manter tabelas de teste ate terminar a conferencia final.

## Dependencias: quem precisa fazer o que

| Pessoa | O que precisa entregar/confirmar | O que destrava para Chico |
|---|---|---|
| Gustavo / Gugu | Retornar nomes/destinos finais e formato de transformacao; atualizar docs/api.md e implementar consumo da Gold, filtros e cache | Adaptacao final dos SQLs e teste das respostas reais da API |
| Lhobregat | Confirmar minimapas exatos e convencao de coordenadas; integrar eventos, calor e round real na prancheta | Registro das imagens e conferencia de plants, mortes e snapshots no produto |
| Rhuan | Confirmar imagens com Lhobregat quando aplicavel e ligar paginas/graficos a API | Comparacao dos numeros e filtros exibidos com a Gold |
| Guilherme | Revisar PR, fazer merge e coordenar publicacao/acesso/deploy; preservar os seis JSONs corrigidos na fonte de recarga | Publicacao aprovada, consumo pela API/coach e teste final |
| Time / organizacao, via Lhobregat e Guilherme | Confirmar permissao/licenca de uso dos metadados e imagens externos conforme plano-de-acao.md | Uso desses recursos na entrega oficial |

Chico concluiu a conferencia visual local das amostras de mortes/snapshots.
Falta repetir as amostras afetadas com os avisos revisados e registrar imagens/versoes.
O teste no produto depende da integracao.
Nao e responsabilidade do Chico implementar API, telas, coach, IAM ou deploy.
Ele fornece SQL, regras, evidencias e apoio para conferir os dados consumidos.

## Como oficializar, sem confundir GitHub com BigQuery

1. Revisar esta entrega e as pendencias. Definir escopo que sera publicado.
2. Acordar os nomes finais com API/coach e conferir se ja existem tabelas
   nesses destinos; planejar preservacao/retorno antes de substituir algo existente.
3. Preparar versao dos SQLs e validacoes que referencia os destinos finais.
   Trocar somente o destination_table NAO basta: as consultas usam dependencias
   chico_teste_ internamente.
4. Abrir PR de chico/gold-principal para main; revisao do dono e merge por Guilherme.
   Identificar explicitamente qualquer pendencia de contrato ou integracao.
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
