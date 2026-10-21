# API de estatísticas — DA TROPA

Responsáveis: Gugu pela API e Chico por `sql/gold/`.

Backend em Python 3.12 com FastAPI, preparado para execução em
container no Cloud Run com a conta de serviço `sa-stats`.

## Estado atual

Implementado e testado no Cloud Shell:

- Ranking com dados reais da Gold no BigQuery.
- Paginação, filtros combinados e ordenação.
- Validação de parâmetros e respostas de erro.
- Cache em memória por 5 minutos, com até 128 respostas.
- Coordenação de chamadas iguais dentro do mesmo processo.
- Até quatro execuções de ranking simultâneas por processo.
- Build Docker e inicialização do container.

O deploy e o acesso ao BigQuery dentro do container ainda não
foram validados. As demais rotas do contrato continuam pendentes.

## Acesso público

Por decisão do escopo atual, as rotas de estatísticas não exigem
login nem token Firebase. Isso não altera a política do coach,
a hospedagem do frontend ou as regras da prancheta.

As credenciais do Google Cloud ficam no backend. Não incluir
credenciais, tokens ou arquivos `.env` no Git ou na imagem Docker.

A exigência de JWT nos documentos anteriores precisa ser
atualizada para refletir essa decisão.

## Executar localmente

Comandos na raiz do repositório:

```bash
python3 -m venv services/stats/.venv

services/stats/.venv/bin/python -m pip install \
  -r services/stats/requirements.txt

services/stats/.venv/bin/python -m uvicorn app.main:app \
  --app-dir services/stats \
  --host 127.0.0.1 \
  --port 8080
```

O acesso ao BigQuery exige credenciais Google Cloud disponíveis
ao processo, com permissão para executar consultas e ler a Gold.

## Rotas implementadas

### GET /api/stats/status

Verifica se o servidor responde. Não verifica a conexão com BigQuery.

### GET /api/stats/ranking

Parâmetros opcionais:

| Parâmetro | Regra |
|---|---|
| page | Inteiro positivo; padrão 1 |
| page_size | De 1 a 100; padrão 20 |
| ordem | kills_desc, kd_desc ou adr_desc; padrão kills_desc |
| mapa_id | Identificador do mapa |
| agente_id | Identificador do agente |
| time_id | Identificador do time |
| torneio_id | Identificador do torneio |
| data_inicio | YYYY-MM-DD, inclusiva em UTC |
| data_fim | YYYY-MM-DD, inclusiva em UTC |

Parâmetros desconhecidos, repetidos ou inválidos retornam HTTP 400.
Uma página sem resultados retorna lista vazia e preserva o total.

Resposta:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 0
  },
  "meta": {
    "atualizado_em": null
  }
}
```

`atualizado_em` permanece null enquanto o instante da carga não
estiver disponível. Não representa o horário da requisição.

## Consultas e métricas

- Projeto: `datropa`.
- Dataset: `valorant`.
- Região: `southamerica-east1`.
- Sem filtros: `ranking_jogador`.
- Com filtros: `stats_jogador_partida`, filtrada antes da agregação.
- Toda consulta tem `maximum_bytes_billed` de 1 GiB.
- K/D usa a divisão dos totais; denominador zero produz null.
- ADR e HS% respeitam os alertas de qualidade da Gold.
- Valores nulos ficam no fim da ordenação; jogador_id desempata.
- Não há mínimo de partidas para participar do ranking.

Dry runs registrados na carga `gold_336_v1`:

| Consulta | Bytes estimados |
|---|---:|
| Ranking geral, nas três ordenações | 93.951 |
| Ranking filtrado por Ascent, nas três ordenações | 973.913 |
| Contagem geral | 0 |

As estimativas podem mudar após alterações nos dados ou nas consultas.
A contagem geral executada retornou 411 jogadores; o recorte Ascent,
293 jogadores.

## Cache e concorrência

A chave do cache inclui versão da Gold, versão da resposta, filtros,
ordenação e paginação. Ao mudar a carga ou o formato, atualizar
a versão correspondente.

- TTL: 300 segundos.
- Capacidade: 128 respostas por processo.
- Reiniciar o processo apaga o cache.
- Erros não são armazenados.
- Chamadas iguais são coordenadas por travas no mesmo processo.
- As travas têm quantidade fixa; chamadas diferentes podem
  compartilhar uma trava e aguardar.
- Sem vaga de execução, o ranking retorna HTTP 503.

Cache e limite não são compartilhados entre instâncias.
O limite de concorrência não equivale a limite de requisições
por visitante nem a teto global de custo.

## Container

Build, na raiz do repositório:

```bash
docker build -t datropa-stats:local services/stats
```

Executar:

```bash
docker run --rm \
  -p 127.0.0.1:8081:8080 \
  datropa-stats:local
```

Teste em outro terminal:

```bash
curl -i http://127.0.0.1:8081/api/stats/status
```

O servidor usa a variável PORT, padrão 8080, e um único worker.
O comando acima não fornece credenciais para consultar BigQuery.

## Pendências

- Demais rotas de `docs/api.md` e integração dos SQLs do Chico.
- Testes adicionais dos filtros e da expiração do cache.
- Tratamento de consultas que continuem após timeout.
- Política de limite de requisições para publicação pública.
- Atualização do contrato e das instruções de autenticação.
- Registro confiável do instante de carga.
- Validação do BigQuery no ambiente do container/Cloud Run.
- Deploy e teste integrado com todas as chamadas do frontend.

O frontend deve controlar chamadas repetidas, ignorar respostas
antigas ao trocar filtros e mostrar falhas por componente.
Falhas não devem ser convertidas em estatísticas zeradas.

Infraestrutura e deploy ficam alinhados com Guilherme.
## Atualização — detalhe de jogador integrado

Implementada a rota pública GET /api/stats/jogadores/{jogador_id},
usando a consulta preparada por Chico e copiada para
queries/jogador_detalhe.sql.

Aceita torneio_id, mapa_id, agente_id, data_inicio e data_fim.
Compartilha cache e limite de quatro execuções com o ranking.

Testado pela API no Cloud Shell:
- duduziN sem filtros: 36 partidas, 468 kills, 437 deaths, 258 assists.
- Ascent: 12 partidas, 168 kills, 135 deaths, 78 assists.
- Jogador inexistente: 404.
- Período sem partidas: identidade preservada, contagens zero,
  taxas null e listas vazias.
- Repetição do recorte vazio: cache HIT e HTTP 200.
- Ranking geral preservado: Kaytoh com 628 kills e total 411.

Imagem Docker reconstruída e status respondeu 200.
BigQuery dentro do container continua pendente de validação.

Esta atualização substitui as referências anteriores que indicavam
a rota de jogador como pendente. Demais rotas continuam pendentes.
