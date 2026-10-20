# Mapas e coordenadas — validacao de plants

Destino: datropa.valorant.chico_teste_mapas. Fonte: chico_teste_partidas.
Dez mapas, 336 partidas. Apenas ambiente de teste, sem publicacao final.

## Estado em 20/10/2026

Chico confirmou visualmente os plants sobre as dez imagens locais usadas nos testes.
Ascent: tres por site A/B; os outros mapas: ate tres por site (incluindo C).
Summit: seis plants, todos corretos segundo Chico.
Validacao visual executada pelo usuario; nao afirmar inspecao independente das imagens.
Nao houve ajuste dos nove coeficientes do PDF.
Ascent amostra 4 foi conferida contra bronze: mesma posicao, site, tempo e planter.
Chico confirmou centro dentro da area de plant; somente a borda do marcador ultrapassava.
Borda do circulo nao e a coordenada do evento.

calibracao_validada=true significa APENAS o escopo escopo_validacao:
plants_visual_chico_2026_10_20. Nao significa teste de integracao, precisao absoluta
nem validacao de todos os tipos de evento.
Resta testar mortes/snapshots e prancheta real com o front.

## Summit

Fonte consultada pelo Chico:
https://valorant-api.com/v1/maps/756da597-416b-c0f2-f47b-afbdf28670bc
Saida recebida: displayName=Summit; mapUrl=/Game/Maps/Plummet/Plummet;
xMultiplier=0.000075; yMultiplier=-0.000075;
xScalarToAdd=0.047401; yScalarToAdd=0.978891.
Imagem usada:
https://media.valorant-api.com/maps/756da597-416b-c0f2-f47b-afbdf28670bc/displayicon.png
Guardar URL de Summit no catalogo; demais URLs nao foram fornecidas individualmente.
Ainda registrar arquivos/URLs e versoes exatas dos outros nove minimapas no handoff.

## Formula e contrato

u = x*u_x + y*u_y + u_offset
v = x*v_x + y*v_y + v_offset

Nos dez mapas, u_x=0 e v_y=0: os eixos originais sao trocados.
No minimapa inteiro: pixel_x=u*largura; pixel_y=v*altura.
Origem superior esquerda. Nao trocar os eixos outra vez, nem limitar u/v para
esconder coordenadas fora da imagem. Recorte/rotacao/margens exigem nova verificacao.

transformacao_candidata conserva a matriz de seis campos por compatibilidade
com os testes anteriores. As matrizes agora tiveram os plants conferidos.
transformacao (formato simples de quatro campos no contrato) continua NULL:
esse formato nao representa a troca de eixos. Gugu/Lhobregat devem alinhar a
convencao publica; nao alterar docs/api.md ou o front nesta etapa.

## Proxima execucao

Dry run de mapas.sql atualizado; depois substituir somente chico_teste_mapas.
Executar validacoes/mapas_teste.sql.
Esperado: 10 mapas/IDs, 336 partidas, 10 matrizes, 0 sem calibracao,
10 calibracoes validadas no escopo de plants, 10 mapas_com_plants_conferidos,
0 transformacoes_publicadas, 0 alertas, 0 eventos_sem_mapa.
Dry run e materializacao desta versao ainda pendentes.
