# Gold oficial — gold_336_v1

## Autorizacao e estado
Chico informou em 20/10/2026 que Guilherme aprovou a oficializacao e delegou a
Chico as decisoes de dados antes pendentes de Gustavo/Gugu. Essas decisoes ficam
registradas aqui para implementacao da API. Nao representam API implementada.
SQLs preparados; execucao oficial e bytes de dry run ainda aguardam Cloud Shell.
Nao afirmar publicacao concluida antes das saidas e validacoes reais.

## Fontes oficiais e destinos
Projeto datropa, dataset valorant, regiao southamerica-east1.
Fonte de carga: bronze_partidas com as 336 partidas fornecidas pela organizacao.
API e coach consultam somente a Gold, nunca a bronze.
Destinos finais: nomes dos 13 arquivos SQL em oficial/, sem chico_teste_.
Ordem: partidas; stats_jogador_partida; stats_time_partida; rounds;
ranking_jogador; stats_time; stats_mapa; stats_agente; mapas; eventos_round;
pos_plant_retake_partida; composicao_time_partida; economia_time_round.
As consultas oficiais substituem TODAS as referencias internas chico_teste_.
SQLs anteriores e tabelas de teste ficam preservados para comparacao.
Somente oficial/*.sql e oficial/validacoes/*.sql sao roteiro de publicacao.
Comentarios historicos copiados das fontes de teste nao mudam os destinos oficiais.

## Decisoes para Gustavo/Gugu implementar
Este documento fixa a interface dos dados da Gold. docs/api.md continua sendo
rascunho anterior e precisa ser atualizado por Gugu; quando divergir nos pontos
abaixo, aplicar estas decisoes. Nao houve edicao em pasta de outro responsavel.

### Mapas e coordenadas
mapas.transformacao e um STRUCT com seis FLOAT64:
u_x, u_y, u_offset, v_x, v_y, v_offset.
u=x*u_x+y*u_y+u_offset; v=x*v_x+y*v_y+v_offset.
Origem superior esquerda; u horizontal e v vertical, normalizados na imagem.
Publicar esses seis campos em /catalogos, sem converter para o antigo esquema
de quatro campos e sem trocar eixos uma segunda vez.
As dez matrizes testadas sao publicadas; transformacao_candidata fica para auditoria.
As imagens exatas do front ainda precisam ser registradas; minimapa_url NULL
nao autoriza inventar URL. Recorte/margens/rotacao diferentes exigem nova conferencia.
Publicar a matriz nao comprova alinhamento com qualquer imagem futura.

### Eventos: spike, queda e arena do Iso
Preservar posicao e jogadores com coordenadas originais; snapshots sao parciais.
Expor dano_final_tipo, self_kill, fogo_amigo, abate_adversario, ator_time_id,
vitima_time_id e ator_agente_id junto aos campos existentes.
Round publico base 1; usar round da Gold, nao somar 1 novamente.
Todos os eventos do round devem ser acessiveis; nao filtrar a timeline apenas
por abate_adversario. Campo tipo permanece abate/plant/defuse.
Bomb: rotulo 'Morte pela spike'; Fall: 'Morte por queda', sem inferir intencao.
Nao dar kill ou assist por conta propria com base em dano anterior.
Nos JSONs examinados, Bomb tem killer=victim; preservar essa origem, mas nao
apresentar como suicidio deliberado. self_kill significa igualdade de IDs.
K/D/A usa resumo original; deaths_eventos e auditoria e pode incluir Bomb.
Nao recalcular deaths de placar contando indiscriminadamente os eventos.

Chico confirmou nesta conversa a causa arena do Iso para as amostras investigadas
de Breeze/Haven; nao foi anexada verificacao independente por video nesta etapa.
Nos dados examinados, 12 mortes com x<-40000 envolviam Iso. Isso e evidencia
do contexto, nao garantia de uma regra universal para qualquer partida futura.
Nao usar apenas x<-40000 para afirmar ultimate confirmada em novos eventos.
A API pode derivar contexto possivel_arena_iso quando ha coordenada extrema
e Iso diretamente envolvido; demais casos externos ficam causa desconhecida.
Nao ha novo campo de contexto materializado neste pacote: derivacao de exibicao
pela API/front, preservando os campos originais e a incerteza nos casos novos.

Para cada posicao, calcular u/v. Se nao finitos ou fora de [0,1], nao desenhar
sobre o minimapa; mostrar aviso e manter o evento na timeline.
Nao limitar pontos a borda, nao inventar ultima posicao e nao interpolar.
Limite da imagem nao equivale a area caminhavel: quedas podem cair dentro da imagem.
Calor de kills: abate_adversario=true, dano_final_tipo nao ambiental
(Bomb/Fall/Crush), posicao valida e projetavel. Excluir arena externa somente da
camada espacial, nao dos totais de kills. Documentar contagem de pontos excluidos.
Calor de mortes, se houver, e filtro separado que pode incluir ambiente/spike.
Posicao em arena do Iso nao e posicao tatica da morte no mapa principal.
Mortes Bomb indicam instante da morte, nao necessariamente instante inicial
exato da explosao; resultado detonacao tambem nao exige uma vitima por explosao.

### Metricas e filtros
- Aplicar filtros nas bases por partida antes de agregar; razoes pelos totais.
- K/D=SAFE_DIVIDE(kills,deaths); deaths zero gera NULL.
- ADR=dano a adversarios/rounds; respeitar completude dos registros.
- HS%=100*headshots/(headshots+bodyshots+legshots), nao percentual de kills.
- First blood: primeiro abate adversario com tempo valido; desempate estavel
  conforme SQL. Nao alterar essa semantica sem nova versao.
- ranking_jogador e historico sem filtros; ranking filtrado usa stats_jogador_partida.
- stats_time contem escopos geral/mapa; nao soma-los juntos.
- Economia equipamento_time_10000_20000_v1: soma do loadoutValue dos cinco;
  eco <10000, force de 10000 a <20000, full >=20000. NULL e incompleto,
  nunca eco inventado. Compras mistas pela soma; nao mede intencao de compra.
- Pos-plant: vitoria do ataque apos plant; retake: vitoria da defesa apos plant.
  Mede resultado, nao tentativa. Preservar vitorias por tempo, alem de desarmes.
- Composicao: cinco slots ordenados, composicao_valida=true para agregacao.
- IDs de time nao sao Red/Blue; nome/ID vem da Gold. Jogador pode mudar de time.
- NULL e indisponivel/divisao por zero, nunca zero inventado; percentuais 0–100.
- Datas e filtros em UTC; inicio desconhecido permanece NULL.
- MVP sem criterio e NULL; rounds decisivos sem criterio e lista vazia.
- KAST, trocas, isolamento, WPA e percentis nao fazem parte desta versao.
- Cache inclui gold_336_v1 e versao do contrato; invalidar apos carga confirmada.
  meta.atualizado_em e instante da carga, nao da requisicao; guardar o log da carga.

## Evidencias e criterios
336 partidas; 3360 jogador/partida; 411 ranking; 672 time/partida; 332 stats_time;
10 stats_mapa; 28 stats_agente; 6618 rounds; 52755 eventos; 10 mapas;
672 pos-plant; 672 composicoes; 13236 economia.
21 verificacoes de teste ja passaram segundo saidas de Chico.
Versao oficial exige 24 verificacoes conjuntas, incluindo dez transformacoes
publicas e igualdade com as candidatas; revisar tambem todas as saidas individuais.
Plants e mortes/snapshots conferidos por Chico nos dez mapas. HTML revisado
com avisos confirmado funcionando por ele. Teste de spike foi preparado;
nao registrar resultado visual desse teste especifico sem retorno.
API/front/cache/coach integrados ainda nao foram verificados.
Os totais permanecem vinculados a carga de 336: carga nova exige nova validacao.

## Passo a passo de publicacao
1. Atualizar branch; verificar arquivos do PR e autorizacao ja registrada.
2. Executar verificar: dry runs das fontes de teste atuais, guardando bytes.
3. Executar publicar: verificar inexistencia de TODOS os destinos oficiais;
   dry run oficial por dependencia, criar tabela e repetir validacoes.
   As consultas oficiais com dependencias inexistentes so podem ser validadas
   depois de criar essas dependencias. Cada consulta tem limite de 1 GiB;
   nao e um limite agregado para toda a publicacao.
4. Guardar evidencias_gold_oficial/*.jsonl; enviar saida/resumo para registrar
   bytes, jobs e resultado. Nao versionar JSONs de partidas nem logs com dados.
5. Conferir as validacoes individuais e as 24 linhas passou=true.
6. Revisao e merge do PR por Guilherme. Merge nao cria tabelas.
7. Gugu implementar contrato/consumo/cache; front/coach integrar; Chico comparar
   respostas, filtros, pontos e contagens. Publicacao sozinha nao valida produto.

Comandos na raiz do checkout:
```bash
python3 services/stats/sql/gold/oficial/publicar_gold.py verificar
python3 services/stats/sql/gold/oficial/publicar_gold.py publicar
```
Somente validar novamente:
```bash
python3 services/stats/sql/gold/oficial/publicar_gold.py validar
```

Se um destino ja existir, parar e avaliar; script nao sobrescreve nem acrescenta.
Se houver falha apos criar algumas tabelas, preservar e enviar log; nao apagar
ou repetir publicacao inteira. Uma carga parcial nao deve ser liberada a API.
Nenhuma alteracao de IAM, deploy, API ou front esta incluida neste pacote.
