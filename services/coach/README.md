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
            ├─ buscar_entidade(texto)          → id do time/jogador
            ├─ stats_time(time_id, mapa?)       → números da gold
            ├─ stats_jogador(jogador_id, ...)   → números da gold
            └─ resposta em português, citando os números das tools
```

- O Gemini não escreve SQL. Cada tool roda `Consulta`s prontas (`coach/bq.py`), com query parameters e `maximum_bytes_billed` (padrão 200 MB por consulta).
- Toda consulta passa por uma checagem de que começa com `SELECT`/`WITH`. Parâmetro que a tool não declarou é recusado antes de chegar no BigQuery.
- `consulta_livre` não existe no registro: fica desligada.
- O prompt de sistema (`coach/prompt.py`) obriga a citar só números vindos das tools, avisar amostra pequena e tratar `null` como indisponível.

## Tools

| Tool | Parâmetros | Lê | Devolve |
|---|---|---|---|
| `buscar_entidade` | `texto`, `tipo?` (time, jogador, mapa, agente) | `stats_time`, `ranking_jogador` | Candidatos por nome, com busca aproximada (sem acento, contém, `EDIT_DISTANCE` por palavra). Mapa e agente saem dos catálogos locais |
| `stats_jogador` | `jogador_id`, `mapa?`, `agente?` | `stats_jogador_partida` | Partidas, vitórias, K/D/A, K/D, ADR, HS%, first bloods/deaths, top 5 agentes e quebra por mapa |
| `stats_time` | `time_id`, `mapa?` | `stats_time`, `stats_time_partida`, `stats_jogador_partida` | Resumo geral, por mapa (fortes e fracos), ataque/defesa, elenco com números de cada jogador e últimas 5 partidas |

As métricas seguem a gold do chico (`services/stats/sql/gold/oficial/`, PR #7): filtro antes de agregar, razões recalculadas pelos totais, ADR e HS% `null` quando o recorte tem registro com alerta.

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

- **Teste ponta a ponta com token real do Firebase**, pelo front, quando o rewrite `/api/coach/**` estiver no Hosting. Até agora a validação do JWT foi testada com chave própria nos testes e com token falso no serviço no ar (401). Conferir: login no front, pergunta na tela do coach, resposta 200 com números, e 401 depois do logout. Entra no teste de quarta 20h (deploy final e ponta a ponta).
- Tools de quarta: coletivas (`comparar_times`, `economia_time`, `pos_plant_retake`, `composicoes`), `resumo_partida`, `abrir_na_prancheta` e scouting.

## Catálogos

`coach/catalogos/agentes.json` é cópia do catálogo do gugu (branch `data/gugu-catalogos-uuid`, `services/stats/data/agentes.json`). A confirmação da organização para essa fonte ainda está pendente. UUID fora do catálogo aparece como veio. Os mapas (codinome → nome) vêm de `docs/dados.md`.
