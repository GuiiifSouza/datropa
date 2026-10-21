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
- [x] Preservar historico Git e tabelas de teste no BigQuery.

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
Nao repetir publicar nos destinos existentes; nenhuma tabela foi apagada na limpeza.
SQLs/planos de teste removidos do checkout continuam no historico Git.
Nao apagar tabelas de teste antes da conferencia integrada.
