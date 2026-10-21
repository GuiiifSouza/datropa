# Estatisticas de jogador por partida: primeira versao

Estado: publicado e validado. SQLs em oficial/.
Dependencia: valorant.partidas. Destino: valorant.stats_jogador_partida.

## Regras

- Uma linha por matchId e puuid; excluir observadores e jogadores fora de Red/Blue.
- jogador_id preserva puuid; nome e tag ficam separados; agente_id e o UUID minusculo. Traducao pertence ao Gugu.
- K/D/A e rounds sao `players.stats` originais, sem media e sem excluir rounds atipicos. versao_metricas=`resumo_original_v1`.
- ADR: soma de dano contra adversarios / rounds. Sem limitar o dano a 150. HS% usa headshots / (headshots+bodyshots+legshots), multiplicado por 100. Divisao por zero retorna null.
- First blood e first death: primeiro evento valido contra adversario no round, tempo >=0. Desempate por posicao de origem nos arrays; nao inferir quem agiu primeiro em milissegundos iguais.
- Dano, abates e assistencias expandidos separadamente, para nao multiplicar contadores.
- Preservar contadores brutos, rodada, mapa, time, torneio e inicio UTC; agregacoes posteriores somam numeradores/denominadores, nunca medias simples de percentuais.
- O resumo original e a contagem dos eventos diferem em mortes/assistencias. Guardamos kills_eventos/deaths_eventos/assists_eventos e mortes_self_kill; isso e auditoria, nao sobrescrita do resumo. Nao chamar toda divergencia de erro. A gold permite futura variante equivalente ao Raio-X sem perder o dado original.
- Flag de rounds atipicos preservada, sem exclusao automatica. KAST, trocas,
  isolamento, WPA e percentis fora desta versao.

## Referencia independente nos 336 JSONs

3360 linhas jogador-partida, 336 partidas, 66180 rounds-jogador.
Resumo: kills=46371, deaths=46428, assists=17839.
Eventos: kills=46371, deaths=46753, assists validas=17698, self-kills=373, first_bloods=6588.
Dano contra adversarios=8906484; headshots=35396, bodyshots=94781, legshots=7506.
Comparacao por jogador-partida: diferencas kills=0, deaths=308, assists=134.
Referencias calculadas localmente em Python lendo os JSONs originais, sem importar SQL. Nao equivalem a execucao no BigQuery.


## Ranking e auditoria

ranking_jogador publicado: 411 jogadores. Com filtros, usar stats_jogador_partida
antes de agregar; nao filtrar o resumo historico depois da agregacao.
Nome/tag da ultima partida; time_id so quando unico no recorte.
Comparacoes resumo/eventos: 308 diferencas de mortes, 134 de assistencias e zero
em kills. Manter K/D/A original. Nao atribuir causa unica a todas as divergencias.
Evidencias oficiais: PUBLICACAO_GOLD_336_V1.md. Consumo: OFICIALIZACAO_E_API.md.
