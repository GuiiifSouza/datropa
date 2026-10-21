# services/coach

Coach de IA: agente no Vertex AI (Gemini) que escolhe tools com consultas prontas na gold. Roda no Cloud Run com a `sa-coach`, só leitura.

Dono: Guilherme. Escopo e regras em [AGENTS.md](AGENTS.md).

## Stack

- **Python 3.12** com [uv](https://docs.astral.sh/uv/).
- **`google-genai`** (SDK novo do Gemini) apontando para o **Vertex AI**, modelo `gemini-2.5-flash`, projeto `datropa`, região `southamerica-east1`. É o único Gemini disponível na região.
- **Function calling com loop próprio** (`coach/agente.py`), sem o automático do SDK: limita os passos, registra cada tool chamada e devolve o rastro junto com a resposta.
- **`google-cloud-bigquery`** para as consultas, com credenciais ADC (local: `gcloud auth application-default login`; no Cloud Run: a `sa-coach`).

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

## Falta para o Cloud Run

- Rota HTTP (`POST /api/coach/perguntar`) com validação do JWT do Firebase e Dockerfile.
- Histórico da conversa por usuário (hoje fica em memória na CLI).
- Tools de quarta: coletivas (`comparar_times`, `economia_time`, `pos_plant_retake`, `composicoes`), `resumo_partida`, `abrir_na_prancheta` e scouting.

## Catálogos

`coach/catalogos/agentes.json` é cópia do catálogo do gugu (branch `data/gugu-catalogos-uuid`, `services/stats/data/agentes.json`). A confirmação da organização para essa fonte ainda está pendente. UUID fora do catálogo aparece como veio. Os mapas (codinome → nome) vêm de `docs/dados.md`.
