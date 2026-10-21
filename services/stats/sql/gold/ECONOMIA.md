# Economia por time e round — regra oficial

Arquivo economia_time_round.sql; destino economia_time_round.
Fontes bronze_partidas, stats_jogador_partida e rounds.
A API le somente a gold; nenhum acesso bronze em rota.

## Definicao e limites
Usa SOMA de economy.loadoutValue dos cinco jogadores validos no round.
Nao confundir com economy.spent (gasto), remaining (saldo) ou dinheiro disponivel.
Preserva gastos/saldos separadamente quando os cinco valores estao completos.
Regra equipamento_time_10000_20000_pistol_v2, baseada nos limites sugeridos no PDF:
pistol: rounds 1 e 13, qualquer equipamento (coluna booleana pistol);
eco: total < 10000; force: 10000 <= total < 20000; full: total >= 20000.
E uma classificacao por equipamento, nao prova da intencao de compra.
Compras mistas entram pela soma; nao inferir que os cinco tinham compra igual.
Pistol virou categoria propria na v2: na v1 os 1344 pistols caiam todos em eco
(maior loadout de pistol na base: 4550) e a taxa de eco subia de 16,8% para 32,5%.
Overtime nao tem pistol.
Nao filtrar rounds atipicos nesta versao.
Limites oficializados em gold_336_v1 conforme autorizacao relatada por Chico.

Exige cinco jogadores distintos com cinco valores nao nulos e nao negativos.
Economia incompleta fica com categoria/equipamento_total NULL, sem tratar como eco.
Time/partida com todos os equipamentos zero fica sem classificacao e com alerta.
Todos os registros permanecem na tabela; validar status antes de publicar.
Valor zero isolado e preservado quando ha equipamento positivo em outro round da partida.

## API
Para economia do time, aplicar filtros por time/mapa/torneio/data antes de agregar.
Agrupar categoria nao nula, contar rounds, somar venceu, recalcular taxa:
100*SAFE_DIVIDE(vitorias,rounds). Contar categoria NULL em rounds_sem_classificacao.
Retornar classificacao_versao; nao somar medias de percentuais.
Distinguir nenhuma partida no recorte de dados ainda nao publicados.

## Referencia independente dos JSONs
13236 registros, 6618 rounds, 336 partidas e 68 times.
Pistol=1344 (672 vitorias); eco=1493 (251); force=2888 (1413); full=7511 (4282).
Na v1 (pistol dentro de eco): eco=2837 (923).
Total 6618 vitorias. Nenhum equipamento incompleto nem time/partida todo zero.


## Estado oficial

Publicado e validado; zero alertas nas verificacoes individuais.
SQL em oficial/; evidencias em PUBLICACAO_GOLD_336_V1.md.
Regras de consumo em OFICIALIZACAO_E_API.md.
