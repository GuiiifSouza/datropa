# Mapas e coordenadas — etapa de teste

Destino: `datropa.valorant.chico_teste_mapas`. Dependencia: chico_teste_partidas.
Catalogo apenas dos dez mapas presentes; IDs internos iguais aos das tabelas existentes.
Nomes conferidos nos nomes dos 336 arquivos oficiais. Coeficientes candidatos transcritos
do PDF Raio-X fornecido pelo Chico, nao verificados como calibracao de minimapa.

## Convencoes

Eventos continuam nas coordenadas originais do jogo.
O PDF propoe u = y*xm + xa; v = x*ym + ya, com troca de eixos.
A proposta atual de docs/api.md usa u = x*x_multiplier + x_offset e
v = y*y_multiplier + y_offset. Nao e possivel representar a troca nesse formato.
Por isso transformacao publica e minimapa_url permanecem NULL em todos os mapas.
transformacao_candidata e interna, nao deve ser serializada como transformacao pela API.
A matriz candidata usa u = x*u_x + y*u_y + u_offset e
v = x*v_x + y*v_y + v_offset, origem no canto superior esquerdo.
No minimapa com largura W e altura H: pixel_x=u*W; pixel_y=v*H.
Nao inverter eixos novamente nem limitar valores ao intervalo 0..1 para esconder erros.
Summit/plummet nao tem coeficientes no PDF; permanece sem conversao.

## Validacao

1. Dry run de mapas.sql; registrar bytes.
2. Materializar somente chico_teste_mapas.
3. Executar validacoes/mapas_teste.sql.
   Esperado: 10 mapas/IDs, 336 partidas, 9 candidatos, 1 sem calibracao,
   zero calibracoes validadas/publicadas, zero alertas e eventos_sem_mapa.
   Ausencia de calibracao e pendencia explicita, nao falha de integridade.
4. Executar validacoes/mapas_amostras.sql: 30 plants, tres por mapa.
   Estar dentro da imagem nao comprova alinhamento.
5. Com Lhobregat, escolher os minimapas com uso permitido e verificar tres plants
   de cada mapa sobre a imagem exata, incluindo correspondencia do site.
   Registrar imagem/versao, partida, round, resultado e evidencia visual.
6. Resolver a convencao de eixos com Gugu/Lhobregat no contrato, em alteracao
   autorizada pelos donos. Nao alterar o contrato nem o front nesta etapa.
7. Somente apos isso publicar coeficientes/URLs e marcar calibracao validada.
   Summit continua pendente ate obter e conferir uma referencia apropriada.

## Evidencias

Conferencia local dos JSONs: 336 partidas, 10 mapas, todos com pelo menos tres plants.
Dry run BigQuery, materializacao e validacao visual ainda pendentes.
Nenhuma tabela final, merge ou deploy realizado.
