# Economia por time e round — regra proposta para teste

Arquivo economia_time_round.sql; destino chico_teste_economia_time_round.
Fontes bronze_partidas, chico_teste_stats_jogador_partida e chico_teste_rounds.
A API le somente a gold; nenhum acesso bronze em rota.

## Definicao e limites
Usa SOMA de economy.loadoutValue dos cinco jogadores validos no round.
Nao confundir com economy.spent (gasto), remaining (saldo) ou dinheiro disponivel.
Preserva gastos/saldos separadamente quando os cinco valores estao completos.
Regra equipamento_time_10000_20000_v1, baseada nos limites sugeridos no PDF:
eco: total < 10000; force: 10000 <= total < 20000; full: total >= 20000.
E uma classificacao por equipamento, nao prova da intencao de compra.
Compras mistas entram pela soma; nao inferir que os cinco tinham compra igual.
Pistols ficam nessas mesmas tres faixas; nao criar quarta categoria no contrato atual.
Nao filtrar rounds atipicos nesta versao.
Os limites sao proposta versionada para revisar com o time antes da publicacao final.

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
Eco=2837 (923 vitorias); force=2888 (1413); full=7511 (4282).
Total 6618 vitorias. Nenhum equipamento incompleto nem time/partida todo zero.

## Validacao
Primeiro dry run de economia_time_round.sql. Depois de conferir, criar exclusivamente
chico_teste_economia_time_round e executar validacoes/economia_time_round_teste.sql.
Dry run e resultados no BigQuery ainda pendentes. Sem merge ou tabela final.
