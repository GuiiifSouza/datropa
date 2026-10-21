# Detalhe de jogador — entrega para integracao
Estado: consulta completa preparada; dry run e execucao completa pendentes.
Rota de referencia: GET /api/stats/jogadores/{jogador_id}, docs/api.md.

## Arquivos
- jogador_detalhe.sql: SELECT parametrizado, apenas stats_jogador_partida da Gold.
- validar_jogador.sh: runner Bash para Cloud Shell; dry run por padrao.

## Parametros
Todos STRING nesta consulta: jogador_id obrigatorio; torneio_id, mapa_id,
agente_id, data_inicio e data_fim opcionais. NULL ou string vazia desativam
filtros opcionais. Datas ISO YYYY-MM-DD convertidas para DATE no SQL.
Esta convencao evita o erro do bq ao receber parametro DATE vazio.
A API deve validar campos, IDs, datas e data_inicio <= data_fim antes de consultar.

## Semantica
- Zero linhas: identidade inexistente em toda a tabela; API responde 404.
- Identidade existente com recorte vazio: uma linha, contagens zero, taxas null,
  listas times/agentes/mapas vazias.
- Nome: registro mais recente do historico; desempate por partida_id.
- Times: somente recorte filtrado; nome mais recente de cada time nesse recorte.
- Datas inclusivas pela coluna data_partida_utc.
- K/D/A do resumo original, sem trocar pelos contadores de eventos.
- ADR e HS% recalculados pelos totais; dados incompletos preservam null.
- Vitorias contam venceu=true; taxa usa apenas resultados conhecidos.
  Partidas com venceu=null continuam em partidas, mas nao no denominador.
- Uma linha por jogador/partida e uma premissa da Gold publicada.
- Retorno SQL sao os campos internos de data; envelope data/meta, erros HTTP,
  autenticacao e cache ficam com Gugu. atualizado_em nao foi inventado.

## Evidencia recebida do Chico
Resumo isolado executado no Cloud Shell em 21/10/2026:
duduziN, jogador_id:
BGGCT8BEb6ej9WVEvzG0F2RazRuo2Dx5ty6YVEr-gPExwtsVbTtRuyQx0ttSnMMTB2vfyYjh0O2UXg

36 partidas; 705 rounds; 468 kills; 437 deaths; 258 assists;
53 first_bloods; kd=1.070938215102975; adr=117.06241134751772;
hs_pct=24.50037009622502.
Partidas e K/D/A conferidos com consulta agregada anterior.
ADR/HS/first_bloods sao referencias observadas, ainda sem comparacao independente.
Essa evidencia nao equivale a executar a consulta completa deste diretorio.

## Validacao no Cloud Shell
Na raiz do repositorio:
```bash
bash services/stats/sql/gold/consultas_api/validar_jogador.sh dry-run
bash services/stats/sql/gold/consultas_api/validar_jogador.sh execute
MAPA_ID=__mapa_inexistente_teste__ bash services/stats/sql/gold/consultas_api/validar_jogador.sh execute
JOGADOR_ID=__jogador_inexistente_teste__ bash services/stats/sql/gold/consultas_api/validar_jogador.sh execute
```
O mapa inexistente e teste direto do SQL, nao comportamento HTTP:
a API deve rejeitar filtros desconhecidos conforme contrato.
Esperados: resumo de referencia; recorte vazio; zero linhas, respectivamente.
Registrar bytes informados no dry run antes de concluir validacao/abrir PR.
Conferir soma de partidas dos grupos por agente/mapa = 36 no teste sem filtros.
Validar ainda filtros reais de mapa/agente/torneio e limites de datas.
Nenhum Dockerfile, rota, cache ou SQL de ranking foi alterado.
