# services/coach

Coach de IA: agente no Vertex AI (Gemini) que escolhe tools com consultas prontas na gold. Roda no Cloud Run com a `sa-coach`, só leitura.

Dono: Guilherme. Escopo e regras em [AGENTS.md](AGENTS.md).

## Stack

- **Python 3.12** com [uv](https://docs.astral.sh/uv/).
- **`google-genai`** (SDK novo do Gemini) apontando para o **Vertex AI**, modelo `gemini-2.5-flash`, projeto `datropa`, região `southamerica-east1`. É o único Gemini disponível na região.
- **Function calling com loop próprio** (`coach/agente.py`), sem o automático do SDK: limita os passos, registra cada tool chamada e devolve o rastro junto com a resposta.
- **`google-cloud-bigquery`** para as consultas, com credenciais ADC (local: `gcloud auth application-default login`; no Cloud Run: a `sa-coach`).
- **FastAPI + uvicorn** para a rota HTTP, em container (`Dockerfile`, `python:3.12-slim` + uv).

Por que não o ADK: com três a dez tools e um loop simples, o SDK direto é menos dependência e menos mágica para depurar no prazo do hackathon. Se precisar de multiagente depois, o registro de tools migra fácil.

## Como funciona

```
pergunta → Gemini (function calling)
            ├─ buscar_entidade(texto)                → id do time/jogador
            ├─ stats_time / stats_jogador            → números da gold
            ├─ comparar_times / scouting_time        → análise de confronto e de adversário
            ├─ economia_time / pos_plant_retake / composicoes → análise coletiva
            ├─ resumo_partida(partida_id | time_id)  → uma partida round a round
            ├─ ranking_jogadores / ranking_times     → quem lidera um critério num torneio, fase ou mapa
            ├─ abrir_na_prancheta(partida_id, round) → eventos do round + link da prancheta
            └─ resposta em português, citando os números das tools
```

- O Gemini não escreve SQL. Cada tool roda `Consulta`s prontas (`coach/bq.py`), com query parameters e `maximum_bytes_billed` (padrão 200 MB por consulta).
- Toda consulta passa por uma checagem de que começa com `SELECT`/`WITH`. Parâmetro que a tool não declarou é recusado antes de chegar no BigQuery.
- `time_id` e `jogador_id` passam por `coach/tools/ids.py` antes de consultar. O Gemini às vezes troca um caractere ao copiar o id longo (aconteceu 2 vezes em 11 perguntas no teste real de 21/10). Id com até 2 caracteres de diferença, ou prefixo de 12+ caracteres, vira o id real se só um bater; senão volta erro e o agente refaz `buscar_entidade`. A lista de ids (`ids.times` 0,02 MiB, `ids.jogadores` 0,03 MiB) fica em cache por 10 minutos.
- `consulta_livre` não existe no registro: fica desligada.
- **Resposta com número sem tool é cobrada.** Se o modelo responde citando número sem ter chamado nenhuma tool na pergunta, o loop pede uma vez que ele consulte as tools e tira a resposta inventada do histórico. Se insistir, a resposta vira uma mensagem dizendo que não conseguiu consultar os dados. Aconteceu no teste real de 22/10 ("100% de vitória em 3 partidas" sem tool).
- **Falha passageira do Vertex é repetida** até 3 vezes: conexão fechada pelo servidor (`RemoteProtocolError`, que o SDK não repete; também aconteceu em 22/10) e 408/429/5xx.
- A tela do front manda a pergunta com o prefixo `[Contexto da tela: <tipo> <id> (<rótulo>)]`. O prompt manda usar esse id direto (partida, time ou jogador).
- O prompt de sistema (`coach/prompt.py`) obriga a citar só números vindos das tools, avisar amostra pequena e tratar `null` como indisponível.

## Tools

| Tool | Parâmetros | Lê | Devolve |
|---|---|---|---|
| `buscar_entidade` | `texto`, `tipo?` (time, jogador, mapa, agente) | `stats_time`, `ranking_jogador` | Candidatos por nome, com busca aproximada (sem acento, contém, `EDIT_DISTANCE` por palavra). Mapa e agente saem dos catálogos locais |
| `stats_jogador` | `jogador_id`, `mapa?`, `agente?` | `stats_jogador_partida` | Partidas, vitórias, K/D/A, ACS, K/D, ADR, HS%, first bloods/deaths, top 5 agentes e quebra por mapa |
| `stats_time` | `time_id`, `mapa?` | `stats_time`, `stats_time_partida`, `stats_jogador_partida` | Resumo geral, por mapa (fortes e fracos), ataque/defesa, elenco com números de cada jogador e últimas 5 partidas |
| `comparar_times` | `time_a_id`, `time_b_id`, `mapa?` | `stats_time_partida`, `pos_plant_retake_partida`, `stats_jogador_partida`, `economia_time_round` | Os dois lado a lado (vitórias, % rounds, ataque/defesa, K/D do time, ADR médio, first blood %, pós-plant, retake, taxa por compra), resultado por mapa e confrontos diretos |
| `economia_time` | `time_id`, `mapa?` | `economia_time_round` | Rounds e vitórias por compra (pistol, eco, force, full), por lado, contra cada compra do adversário e no round depois do pistol |
| `pos_plant_retake` | `time_id`, `mapa?` | `pos_plant_retake_partida`, `rounds` | Conversão pós-plant e vitórias da defesa depois de sofrer plant (geral e por mapa), % de rounds de ataque com plant e plants por site |
| `composicoes` | `time_id?`, `mapa?` | `composicao_time_partida` | As 10 composições mais usadas (do time ou do campeonato), com agentes, funções, aparições e taxa de vitória |
| `resumo_partida` | `partida_id?` ou `time_id` + `adversario_id?` + `mapa?` | `partidas`, `stats_time_partida`, `stats_jogador_partida`, `rounds`, `economia_time_round` | Placar, placar no intervalo, jogadores (ACS, K/D/A, ADR, HS%), round a round com compras, destaques com critério explícito. `mvp` fica `null` (sem critério oficial na gold) |
| `scouting_time` | `time_id`, `mapa?` | as consultas de `stats_time`, `composicoes`, `economia_time` e `pos_plant_retake`, em paralelo | Mapas, lado forte (geral e por mapa), composição mais usada por mapa, economia, pós-plant/retake, site preferido no ataque e jogadores-chave |
| `ranking_jogadores` | `ordenar_por` (acs, kd, adr, hs_pct, kills, first_bloods), `torneio?`, `mapa?`, `agente?`, `classe?`, `time_id?`, `min_partidas?` (3), `limite?` (5, máx. 10) | `stats_jogador_partida` | Os primeiros no critério, com os números de cada um e quantos jogadores passaram no mínimo de partidas |
| `ranking_times` | `ordenar_por` (taxa_vitoria, taxa_rounds, ataque, defesa, pos_plant, retake), `torneio?`, `mapa?`, `min_partidas?` (3), `limite?` (5, máx. 10) | `stats_time_partida`, `pos_plant_retake_partida` | Os primeiros no critério, com vitórias, rounds, ataque/defesa, pós-plant e retake. Em pós-plant e retake só entra time com 10+ oportunidades |
| `abrir_na_prancheta` | `partida_id`, `round` (base 1) | `partidas`, `rounds`, `mapas`, `eventos_round`, `stats_jogador_partida` | Link da prancheta, linha do tempo do round (abates, plant, defuse com descrição em texto, posição e snapshot dos jogadores) e a transformação do mapa |

`torneio` é uma chave fixa (`UNIVAVA`, `UNIVAVA_G`, `UNIVAVA_C1` a `C4`, `RUSH`, `RUSHE`, `RUSH2`, `RUSH_INCLUSIVO`) que vira uma regex sobre `torneio_id` em `coach/catalogos`. `UNIVAVA` e `RUSH` juntam todas as fases. A regex nunca vem do modelo.

As métricas seguem a gold do chico (`services/stats/sql/gold/oficial/`, PR #7): filtro antes de agregar, razões recalculadas pelos totais, ADR e HS% `null` quando o recorte tem registro com alerta. Economia segue `equipamento_time_10000_20000_pistol_v2` (`ECONOMIA.md`), pós-plant/retake segue `resultado_apos_plant_v1` (`POS_PLANT_RETAKE.md`: mede resultado, não prova tentativa de retake) e composição só conta `composicao_valida` (`COMPOSICOES.md`).

### Bytes por consulta (dry run em 21/10/2026, gold `gold_336_v1`; conferido de novo em 22/10, mesmos bytes)

| Consulta | Bytes |
|---|---|
| `comparar_times.indicadores` / `.por_mapa` / `.confrontos` | 1,57 MiB / 0,09 MiB / 0,15 MiB |
| `economia_time.por_categoria` / `.contra_adversario` / `.pos_pistol` | 2,12 MiB / 2,47 MiB / 1,50 MiB |
| `pos_plant_retake.totais` / `.por_site` | 0,11 MiB / 1,40 MiB |
| `composicoes.agregado` | 0,22 MiB |
| `resumo_partida.partida` / `.buscar` / `.jogadores` / `.rounds` | 0,11 MiB / 0,16 MiB / 1,03 MiB / 3,38 MiB |
| `abrir_na_prancheta.round` / `.eventos` | 1,80 MiB / **47,35 MiB** |
| `stats_jogador.resumo` / `.por_agente` / `.por_mapa` (com ACS, 22/10) | 0,80 MiB / 0,80 MiB / 0,70 MiB |
| `ranking.jogadores` / `ranking.times` (22/10) | 0,84 MiB / 0,18 MiB |

`scouting_time` não tem SQL próprio: soma as consultas que usa (cerca de 6 MiB). `abrir_na_prancheta.eventos` lê a coluna `jogadores` de `eventos_round` inteira, porque a tabela não é particionada nem clusterizada; fica bem abaixo do teto de 200 MB. Se o chico clusterizar `eventos_round` por `partida_id`, o custo real cai bastante sem mudar o coach.

## Prancheta: contrato do link

Segue `docs/api.md`, seção 6, e é a rota que o front usa (`front/src/App.tsx`, rota `/prancheta`).

```
/prancheta?partida_id=<partida_id>&round=<n>
```

- `partida_id`: `partida_id` da gold (o `matchId` do JSON), com URL encoding.
- `round`: número público, começando em 1 (o `round` da gold; não somar 1).
- `abrir_na_prancheta` devolve `prancheta.url` (relativo) e `prancheta.url_completa` (`COACH_FRONT_URL` + caminho). O coach só gera o link depois de conferir que a partida e o round existem.
- A tela pode carregar o round pela rota do `stats` (`GET /partidas/{partida_id}/rounds/{round}/eventos`). O resultado da tool também traz os eventos no mesmo formato da gold (posições em coordenada do jogo, arredondadas para inteiro, mais `transformacao_mapa` com os seis coeficientes), dentro de `data.tools[].resultado` da resposta do coach.
- Se o front mudar o caminho, muda só `link_prancheta` em `coach/tools/abrir_na_prancheta.py`.
- A base é `https://datropa.web.app`, onde o Hosting está. `devs.datropa.com` ainda não tem DNS (dívida técnica em `infra/README.md`); quando tiver, troque o padrão de `COACH_FRONT_URL` em `coach/config.py`.

### Adicionar uma tool

1. Crie `coach/tools/<nome>.py` com as `Consulta`s (SQL + tipos + exemplo para o dry run) e uma função decorada com `@tool(nome, descricao, parametros)`. A função recebe os argumentos e devolve um dict; erro esperado é `raise ErroTool("...")`.
2. Importe o módulo no fim de `coach/tools/__init__.py`.
3. Rode `uv run pytest` e `uv run python -m coach.cli --dry-run`.

## Tabelas

O nome das tabelas vem da configuração, nunca do modelo:

| Variável | Padrão | Para quê |
|---|---|---|
| `COACH_PROJETO` | `datropa` | Projeto GCP |
| `COACH_REGIAO` | `southamerica-east1` | Vertex AI e BigQuery |
| `COACH_MODELO` | `gemini-2.5-flash` | Modelo |
| `COACH_DATASET` | `valorant` | Dataset da gold |
| `COACH_GOLD_PREFIXO` | vazio | Prefixo nos nomes da gold, para apontar para outra versão das tabelas |
| `COACH_TABELA_<NOME>` | — | Sobrescreve uma tabela só, ex.: `COACH_TABELA_STATS_TIME=stats_time_v2` |
| `COACH_MAX_BYTES_BILLED` | `209715200` | Teto por consulta |
| `COACH_MAX_PASSOS` | `6` | Rodadas de tool por pergunta |
| `COACH_FRONT_URL` | `https://datropa.web.app` | Base do link absoluto da prancheta |

## Rodar local

```bash
cd services/coach
gcloud auth application-default login   # conta com acesso ao projeto datropa
uv sync
uv run python -m coach.cli                          # conversa
uv run python -m coach.cli "como joga o time Turuna?"
uv run python -m coach.cli --tool buscar_entidade '{"texto": "turuna"}'   # tool direto, sem Gemini
uv run python -m coach.cli --dry-run                 # bytes de cada consulta
```

## Testes

```bash
uv run pytest                                        # offline, sem GCP
COACH_TESTE_REAL=1 uv run pytest tests/test_perguntas.py -s   # perguntas reais (gasta BigQuery e Gemini)
```

O teste real confere que o agente chamou as tools esperadas, sem erro, e que todo número da resposta aparece no resultado das tools.

## Rota HTTP

O Firebase Hosting reescreve `/api/coach/**` para o Cloud Run, com o caminho completo.

```
POST /api/coach/perguntar
Authorization: Bearer <ID token do Firebase>
Content-Type: application/json

{"pergunta": "como joga o time Turuna?",
 "historico": [{"papel": "usuario", "texto": "..."}, {"papel": "coach", "texto": "..."}]}
```

Resposta (envelope de `docs/api.md`):

```json
{"data": {"resposta": "texto em português",
          "tools": [{"nome": "stats_time", "argumentos": {"time_id": "..."}, "resultado": {}}]},
 "meta": {"modelo": "gemini-2.5-flash", "atualizado_em": null}}
```

- **JWT do Firebase validado no serviço** (`coach/auth.py`): assinatura pelas chaves públicas do Google (com cache), `exp`, `aud` = projeto, `iss` = `https://securetoken.google.com/<projeto>` e `sub`. Sem token ou token inválido: 401 `UNAUTHENTICATED`.
- O serviço não guarda estado. O front manda o `historico` em texto (até 20 turnos). Os resultados de tool não voltam no histórico, então o agente consulta de novo quando precisa de número.
- `tools` traz o que o agente consultou, para o front mostrar a fonte dos números.
- Limite de 20 perguntas por usuário a cada 10 minutos, por instância: 429 `RATE_LIMITED` com `Retry-After`.
- Corpo com campo desconhecido, pergunta vazia ou com mais de 1000 caracteres: 400 `INVALID_ARGUMENT`. Falha do Gemini ou do BigQuery: 503 `DATA_UNAVAILABLE`.

Variáveis da rota, além das de cima:

| Variável | Padrão | Para quê |
|---|---|---|
| `COACH_FIREBASE_PROJETO` | igual a `COACH_PROJETO` | `aud` e `iss` esperados no token |
| `COACH_CORS_ORIGENS` | vazio | Origens liberadas, separadas por vírgula (ex.: `http://localhost:5173`). Pelo Hosting não precisa |
| `COACH_LIMITE_PERGUNTAS`, `COACH_JANELA_LIMITE_S` | `20`, `600` | Limite por usuário |
| `COACH_AUTH_DESLIGADA` | — | `1` desliga o JWT para testar local. Ignorada no Cloud Run (`K_SERVICE` definido) |

Rodar local:

```bash
COACH_AUTH_DESLIGADA=1 uv run uvicorn coach.app:app --port 8081
curl -s -X POST localhost:8081/api/coach/perguntar -H 'Content-Type: application/json' \
  -d '{"pergunta": "quem é o melhor jogador da Azure Bears Golden?"}'
```

Container:

```bash
docker build -t coach .
docker run -p 8081:8080 -e COACH_AUTH_DESLIGADA=1 \
  -v ~/.config/gcloud/application_default_credentials.json:/adc.json:ro \
  -e GOOGLE_APPLICATION_CREDENTIALS=/adc.json coach
```

## Deploy

Push na `main` que mexe em `services/coach/**` dispara `.github/workflows/deploy-coach.yml`: build desta pasta, push no Artifact Registry e `gcloud run deploy coach` com a `sa-coach`, `--max-instances 2`, em `southamerica-east1`. Os padrões de `coach/config.py` já servem para produção, então o deploy não precisa de `--set-env-vars`.

O serviço sobe privado. Para o Hosting conseguir chamar, o Guilherme libera o invoker público uma vez (comando em `infra/README.md`, "Pendências"); o JWT continua sendo validado no serviço.

## Falta

- **Teste ponta a ponta com token real do Firebase**, pelo front. Não feito em 22/10: o front entrou na `main` nesse dia (PR #15) e o teste exige login com conta real. Até lá a validação do JWT foi testada com chave própria nos testes e com o serviço no ar respondendo 401 sem token. Conferir: login no front, pergunta na tela do coach, resposta 200 com números, e 401 depois do logout.
- **Perguntas da demo:** testadas em 22/10 contra o Vertex e a gold, 13 de 13 em duas rodadas seguidas. Lista e respostas em [PERGUNTAS_DEMO.md](PERGUNTAS_DEMO.md). As do gugu não foram achadas no repo; as 10 saíram das sugestões da tela do coach no front.
- MVP e rounds decisivos seguem sem critério oficial: `resumo_partida` devolve `mvp: null` e destaques com critério explícito.

## Catálogos

`coach/catalogos/agentes.json` é cópia do catálogo do gugu (branch `data/gugu-catalogos-uuid`, `services/stats/data/agentes.json`). A confirmação da organização para essa fonte ainda está pendente. UUID fora do catálogo aparece como veio. Os mapas (codinome → nome) vêm de `docs/dados.md`.
