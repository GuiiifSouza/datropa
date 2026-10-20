# Estatisticas de jogador por partida: primeira versao

Estado: SQL preparado; dry run e execucao no BigQuery pendentes.
Dependencia de desenvolvimento: `valorant.chico_teste_partidas`.
Destino de teste: `valorant.chico_teste_stats_jogador_partida`.

## Regras

- Uma linha por matchId e puuid; excluir observadores e jogadores fora de Red/Blue.
- jogador_id preserva puuid; nome e tag ficam separados; agente_id e o UUID minusculo. Traducao pertence ao Gugu.
- K/D/A e rounds sao `players.stats` originais, sem media e sem excluir rounds atipicos. versao_metricas=`resumo_original_v1`.
- ADR: soma de dano contra adversarios / rounds. Sem limitar o dano a 150. HS% usa headshots / (headshots+bodyshots+legshots), multiplicado por 100. Divisao por zero retorna null.
- First blood e first death: primeiro evento valido contra adversario no round, tempo >=0. Desempate por posicao de origem nos arrays; nao inferir quem agiu primeiro em milissegundos iguais.
- Dano, abates e assistencias expandidos separadamente, para nao multiplicar contadores.
- Preservar contadores brutos, rodada, mapa, time, torneio e inicio UTC; agregacoes posteriores somam numeradores/denominadores, nunca medias simples de percentuais.
- O resumo original e a contagem dos eventos diferem em mortes/assistencias. Guardamos kills_eventos/deaths_eventos/assists_eventos e mortes_self_kill; isso e auditoria, nao sobrescrita do resumo. Nao chamar toda divergencia de erro. A gold permite futura variante equivalente ao Raio-X sem perder o dado original.
- Regras de KAST, rounds atipicos, trocas, isolamento, WPA e percentis ainda nao implementadas.

## Referencia independente nos 336 JSONs

3360 linhas jogador-partida, 336 partidas, 66180 rounds-jogador.
Resumo: kills=46371, deaths=46428, assists=17839.
Eventos: kills=46371, deaths=46753, assists validas=17698, self-kills=373, first_bloods=6588.
Dano contra adversarios=8906484; headshots=35396, bodyshots=94781, legshots=7506.
Comparacao por jogador-partida: diferencas kills=0, deaths=308, assists=134.
Referencias calculadas localmente em Python lendo os JSONs originais, sem importar SQL. Nao equivalem a execucao no BigQuery.

## Execucao

Atualizar a branch no Cloud Shell com `git pull --ff-only`.

```bash
bq --project_id=datropa --location=southamerica-east1 query --use_legacy_sql=false --dry_run < services/stats/sql/gold/stats_jogador_partida.sql
```

Registrar os bytes retornados e so entao executar no destino de teste:

```bash
bq --project_id=datropa --location=southamerica-east1 query --use_legacy_sql=false --maximum_bytes_billed=1073741824 --destination_table=datropa:valorant.chico_teste_stats_jogador_partida --replace < services/stats/sql/gold/stats_jogador_partida.sql
bq --project_id=datropa --location=southamerica-east1 query --use_legacy_sql=false --maximum_bytes_billed=1073741824 < services/stats/sql/gold/validacoes/stats_jogador_partida_teste.sql
```

O destino e exclusivamente de teste. Nao promover tabelas finais ou alterar contrato publico ate revisar discrepancias e amostras. Sem merge nesta etapa.

## Evidencia recebida: dry run

20/10/2026: Chico executou o dry run de `stats_jogador_partida.sql`. BigQuery retornou `Query successfully validated` e estimativa de 24274906 bytes (23,15 MiB). Materializacao e verificacao dos resultados ainda pendentes.
