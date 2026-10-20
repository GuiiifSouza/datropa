# Composicoes por time e partida

Fonte: chico_teste_stats_jogador_partida e chico_teste_stats_time_partida.
Destino: chico_teste_composicao_time_partida.
Uma linha por time/partida, incluindo registros invalidos com alerta.
Valida exatamente cinco jogadores unicos e cinco UUIDs de agentes distintos presentes.
A lista de agentes e ordenada sem remover slots com DISTINCT.
Lista incompleta nao produz composicao_id valido, nem deve entrar nas taxas.

ID: prefixo composicao_ + SHA256 hexadecimal minusculo do JSON BigQuery
STRUCT(mapa_id AS mapa_id, agente_ids AS agente_ids), nesta ordem.
Inclui mapa para separar estrategias por mapa; nao inclui time para permitir comparacao.
Nomes, funcoes e icones sao responsabilidade do catalogo da API; UUIDs nao traduzidos aqui.

Para GET /composicoes: aplicar filtros de torneio/mapa/data/time nesta granularidade,
exigir composicao_valida, agrupar por composicao_id, mapa_id e agente_ids
(usando a representacao JSON da lista como chave se necessario), contar aparicoes,
somar venceu e recalcular 100*SAFE_DIVIDE(vitorias,aparicoes).
Ordenar aparicoes DESC, composicao_id como desempate. Nao agregar antes dos filtros.
A API pode implementar este GROUP BY sem uma tabela total adicional.
Nao confundir aparicao (time por mapa jogado) com cinco aparicoes de jogadores.

Conferencia independente dos JSONs: 672 aparicoes, 336 vitorias e derrotas,
3360 slots e 198 pares de mapa/lista de agentes. Todos os elencos completos.

Primeiro dry run de composicao_time_partida.sql; depois materializar apenas
chico_teste_composicao_time_partida e executar validacoes/composicao_time_partida_teste.sql.
Dry run e execucao BigQuery pendentes; nenhuma publicacao final.
