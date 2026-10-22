# Entrega do Chico — Gold oficial gold_336_v1

## Estado atual
13 tabelas publicadas em datropa.valorant, southamerica-east1.
336 partidas; 24 verificacoes conjuntas aprovadas; validacoes individuais
revisadas com zero alertas. Publicacao confirmada nos logs enviados por Chico.
Entrega de codigo via [PR #7](https://github.com/GuiiifSouza/datropa/pull/7).
Chico relatou autorizacao do Guilherme para oficializar decisoes e executar merge.
API, cache, coach e produto integrado ainda nao foram validados nesta entrega.

## Entregue
- [x] Corrigir cobertura da base para 336 partidas.
- [x] Implementar e publicar as 13 tabelas oficiais com referencias finais.
- [x] Validar contagens, chaves, referencias, taxas e reconciliacoes da Gold.
- [x] Conferir plants e mortes/snapshots amostrados nos dez minimapas.
- [x] Publicar dez matrizes de transformacao de seis coeficientes.
- [x] Documentar spike, quedas e contexto da arena do Iso; revisar avisos dos HTMLs.
- [x] Registrar regras para Gustavo/Gugu, sem depender de nova decisao dele.
- [x] Preparar PR, evidencias e limpeza dos SQLs/planos de teste obsoletos.
- [x] Preservar historico Git. Tabelas de teste no BigQuery apagadas pelo Guilherme em 21/10/2026.

## Tabelas oficiais
| Tabela | Linhas |
|---|---:|
| partidas | 336 |
| stats_jogador_partida | 3360 |
| ranking_jogador | 411 |
| stats_time_partida | 672 |
| stats_time | 332 |
| stats_mapa | 10 |
| stats_agente | 28 |
| rounds | 6618 |
| eventos_round | 52755 |
| mapas | 10 |
| pos_plant_retake_partida | 672 |
| composicao_time_partida | 672 |
| economia_time_round | 13236 |

SQLs oficiais: oficial/. Validacoes: oficial/validacoes/.
[Bytes, logs e resultados](PUBLICACAO_GOLD_336_V1.md).
[Regras que a API deve seguir](OFICIALIZACAO_E_API.md).
Os SQLs de producao ja executados nao foram alterados na limpeza.

## O que ainda falta ao Chico
- [ ] Passar ao Gustavo o documento OFICIALIZACAO_E_API.md e apoiar duvidas
  sobre tabelas, filtros e metricas. O documento esta pronto; nao houve envio
  automatico de mensagem ao time.
- [ ] Registrar com Lhobregat/Rhuan os arquivos/URLs e versoes exatas dos minimapas
  adotados no produto. Se forem diferentes das imagens testadas, reconferir.
- [ ] Quando a API estiver pronta, comparar respostas com a Gold: jogador/time,
  ranking filtrado, economia, composicoes, pos-plant e eventos de round.
- [ ] Quando o front/coach estiver integrado, conferir numeros, filtros, round base 1,
  plants, mortes, snapshots e calor; validar avisos de spike/queda/arena do Iso.
- [ ] Corrigir problemas da Gold que surgirem na integracao, com dry run e validacao
  antes de qualquer nova materializacao; registrar versao e evidencias.
- [ ] Registrar resultado do teste integrado e encerrar a entrega ponta a ponta.

## Dependencias
| Responsavel | Entrega que destrava a conferencia do Chico |
|---|---|
| Gustavo/Gugu | Atualizar contrato e implementar API lendo destinos oficiais, filtros antes de agregar, matrizes, flags dos eventos e cache por versao |
| Lhobregat/Rhuan | Confirmar minimapas e integrar telas/prancheta com os avisos e filtros espaciais definidos |
| Guilherme | Acessos/deploy e integracao das tools do coach; preservar os seis JSONs originais recuperados nas recargas |

Chico responde por SQL, regras, evidencias e verificacao dos dados consumidos.
API, telas, coach, IAM e deploy sao dos responsaveis acima.

## Limites e auditoria
K/D/A usa resumo original; contadores de eventos ficam separados.
308 diferencas em mortes e 134 em assistencias foram preservadas; zero em kills.
Nao classificar todas como erro nem atribuir causa unica sem investigacao.
Mortes de spike nao geram kill inventada; quedas nao revelam intencao.
Arena do Iso foi confirmada por Chico nas amostras investigadas; x<-40000 sozinho
nao confirma o contexto em qualquer partida futura. Eventos externos continuam
na timeline e nos totais, sem pontos inventados no minimapa.
Nao prometer movimento continuo: apenas snapshots disponiveis.
KAST, trocas, isolamento, WPA e percentis nao implementados; fora desta versao.

## Manutencao
Para conferir tabelas ja publicadas:
```bash
python3 services/stats/sql/gold/oficial/publicar_gold.py verificar
python3 services/stats/sql/gold/oficial/publicar_gold.py validar
```
Nao repetir publicar nos destinos existentes.
SQLs/planos de teste removidos do checkout continuam no historico Git.

## Consultas para API — detalhe de jogador (21/10/2026)
- [x] Preparar consultas_api/jogador_detalhe.sql parametrizado, somente na Gold.
- [x] Entregar runner Bash, parametros e regras de entidade inexistente/recorte vazio.
- [x] Dry run aprovado: 1.197.458 bytes estimados; zero bytes cobrados no dry run.
- [x] Validar resumo sem filtros e filtros de mapa, agente, mapa+agente, torneio,
  intervalo de datas e inicio=fim, com evidencias enviadas por Chico.
- [x] Conferir jogador inexistente e recorte vazio.
- [x] Registrar resultados e limites em consultas_api/README.md.
- [ ] Revisar PR e integrar na API com Gugu; conferir JSON e erros HTTP.
- [ ] Preparar consultas de time e partida em tarefas seguintes.
Esta entrega contem SQL e documentacao; nao altera Dockerfile, rotas, cache ou ranking.


## Otimização do carregamento do calor — 22/10/2026

Preparada na branch existente chico/consultas-api-jogador, sem republicar Gold.
A rota de calor aceita page_size até 1000; outras coleções continuam até 100.
Front solicita 1000 e usa 100 se a API antiga rejeitar a primeira página com 400.
Para 11714 pontos, reduz de 118 para 12 requisições quando a API está atualizada.
SQL, filtros, coordenadas e os quatro downloads simultâneos foram preservados.
37 testes offline da API aprovados; tipos e build do front aprovados; teste
sintético do carregador confere 11714 pontos únicos e compatibilidade com API antiga.
Comando do teste: cd front && node scripts/testes/calor-paginacao.mjs.
Não foram feitas consultas reais, chamadas Gemini, deploy nem medição real do ganho.
Pendente: revisar/publicar backend e frontend por PR e medir uma carga de Ascent.
O build local sem as artes privadas avisa caminhos ausentes; não houve inspeção
visual desta otimização. Alteração não reduz o volume total de pontos transferidos;
reduz páginas e repetição de consultas. Não promete 90% menos tempo ou custo.

## Navegação do calor para o evento — 22/10/2026

Chico confirmou carga de Ascent em aproximadamente 5 s (antes ~40 s).
Corrigido o clique da área do calor: preserva evento_id e seleciona o evento
correspondente após carregar o round, em vez de selecionar sempre o índice zero.
ID preservado no adaptador de eventos; nenhuma consulta ou coordenada alterada.
Fonte do protótipo e exportador atualizados, com lógica regenerada.
Teste offline aprovado para round em cache, carga tardia, eventos no mesmo
segundo e navegação manual. Tipos e build aprovados. Sem teste visual local
com as artes privadas; validar o clique de 0:32 na interface publicada.

## Retratos dos agentes no restante do site — 22/10/2026

O componente Agente buscava arquivos individuais inexistentes. Agora usa o
sprite já publicado em /arte/prancheta/agentes.png, com os 29 retratos do ZIP.
Preservados tamanhos p/m/g, formato circular, bordas por classe e nomes acessíveis.
Artes não adicionadas ao Git; publicação reaproveita o bucket existente.
VITE_ARTE_RIOT habilitado por padrão; 0 continua permitindo desativação explícita.
Tipos, build com artes locais e teste offline dos 29 agentes nos três tamanhos
aprovados. Teste: cd front && node scripts/testes/agentes-retratos.mjs.
Navegador local indisponível (Chromium ausente); confirmar visualmente filtros,
tabelas, perfil do jogador e página da partida após publicação.
