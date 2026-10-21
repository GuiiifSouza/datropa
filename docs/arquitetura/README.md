# Arquitetura

![Arquitetura do Da Tropa no Google Cloud](arquitetura-da-tropa.png)

Versão vetorial: [arquitetura-da-tropa.svg](arquitetura-da-tropa.svg). Fonte do desenho: [arquitetura.py](arquitetura.py).

## Visão geral

Tudo roda num projeto GCP só, com todos os serviços na mesma região. O front é uma SPA no Firebase Hosting. As rotas `/api/**` são reescritas para os microsserviços no Cloud Run, cada um com a própria service account. Os dados das partidas entram como JSON no Cloud Storage, viram tabelas no BigQuery e alimentam as estatísticas, a análise coletiva, o coach de IA e a prancheta tática.

## Componentes

| Componente | Serviço GCP | Papel |
|---|---|---|
| Front | Firebase Hosting | SPA em `devs.datropa.com`, com a prancheta tática. Rewrites de `/api/stats/**` e `/api/coach/**` para o Cloud Run |
| Login | Firebase Authentication | Emite o JWT que o front manda em toda chamada de API |
| `stats` | Cloud Run (`sa-stats`) | Rankings, desempenho por time, mapa e agente, análise coletiva e eventos de round para a prancheta. Lê a gold e guarda cache no Firestore |
| `coach` | Cloud Run (`sa-coach`) | Coach de IA. Agente no Gemini que escolhe tools; cada tool é uma consulta pronta e parametrizada na gold, só leitura |
| `ingest` | Cloud Run (`sa-ingest`) | Recebe o evento de arquivo novo, carrega o bronze e atualiza a gold |
| Partidas brutas | Cloud Storage `raw-matches` | JSONs da base oficial do hackathon, sem transformação. O nome real do bucket é `datropa-raw-matches`, porque nome de bucket é global |
| Analytics | BigQuery, dataset `valorant` | `bronze`: NDJSON aninhado como chegou. `gold`: tabelas prontas para consulta |
| App | Firestore | Usuários, estratégias salvas da prancheta (código curto) e cache de estatísticas |
| IA | Vertex AI (Gemini) | Agente do coach com function calling, scouting e resumo de partidas |
| Imagens | Artifact Registry | Imagens dos containers de cada serviço |
| Limite de custo | Orçamento + Pub/Sub `billing-cap` + Cloud Run function `limite-custo` | Desliga o billing do projeto quando o gasto do mês chega a R$ 400. Fora do diagrama. Detalhes em [infra/README.md](../../infra/README.md) |

## Fluxos

Os números batem com as setas do diagrama.

### Usuário (azul)

1. O usuário abre `devs.datropa.com` no navegador ou no celular.
2. Faz login no Firebase Authentication e recebe um JWT.
3. O front chama `/api/<serviço>/**`. O Hosting reescreve para o Cloud Run certo.
4. `stats` lê a gold no BigQuery e usa o Firestore como cache.
5. `coach`:
   - **5a.** manda a pergunta ao agente no Gemini, que escolhe quais tools chamar e com quais parâmetros;
   - **5b.** cada tool roda uma consulta pronta e parametrizada na gold, só leitura. O agente lê o resultado e responde citando os números.
6. A prancheta salva e lê as estratégias direto no Firestore pelo SDK do Firebase, protegida pelas regras do Firestore.

### Ingestão de partidas (verde)

7. Os JSONs da base do hackathon sobem para o bucket `datropa-raw-matches` (a base é fechada: só os arquivos da organização).
8. O Eventarc avisa o `ingest` que chegou arquivo novo.
9. O `ingest` carrega o NDJSON no bronze e atualiza as tabelas gold.

## Coach: agente com tools

O Gemini não escreve SQL. Ele recebe a pergunta, escolhe uma ou mais tools, o `coach` executa e devolve as linhas, e o Gemini responde citando os números.

```
pergunta → Gemini (Vertex AI, function calling)
            ├─ chama tool(s) → coach roda SQL parametrizado na gold → devolve linhas
            └─ resposta em texto, citando os números
```

| Tool | Parâmetros | O que devolve |
|---|---|---|
| `buscar_entidade` | texto | Time, jogador ou mapa que bate com o nome (resolve diferenças de grafia) |
| `stats_jogador` | jogador, mapa?, agente? | K/D/A, ADR, HS%, first bloods, agentes mais usados |
| `stats_time` | time, mapa? | Vitórias, rounds, desempenho por lado, mapas fortes e fracos |
| `comparar_times` | time_a, time_b | Indicadores lado a lado e confrontos diretos |
| `economia_time` | time, mapa? | Resultado por tipo de compra (eco, force, full) |
| `pos_plant_retake` | time, mapa? | Conversão pós-plant e taxa de retake |
| `composicoes` | time?, mapa? | Composições de agentes e taxa de vitória |
| `resumo_partida` | partida | Placar, MVP, rounds decisivos |
| `abrir_na_prancheta` | partida, round | Link da prancheta com o round carregado |
| `consulta_livre` | sql | **Reserva, desligada por padrão.** Só `SELECT` na gold, dry run e `LIMIT` forçado |

Os nomes e parâmetros finais ficam em `docs/api.md`. Em Python, o ADK (Agent Development Kit) do Google já traz o loop de tools; em outra linguagem, basta usar function calling direto na API do Vertex.

## Prancheta tática

Tela no estilo do [valoplant.gg](https://valoplant.gg/pt/9193DF), feita no front:

| Parte | O que faz |
|---|---|
| Mapa e lado | Minimapa 2D do mapa escolhido, com alternância entre ataque e defesa |
| Peças | Arrastar ícone de agente e de habilidade para o mapa |
| Desenho | Lápis, borracha, seta, texto |
| Etapas | Sequência de 1 a N, com play para animar |
| Salvar e compartilhar | Grava no Firestore e gera link curto (`devs.datropa.com/p/<código>`). Abrir o link exige login. Modelo de dados em [infra/README.md](../../infra/README.md) |
| Round real | Abre qualquer round da base: as posições dos 10 jogadores em cada abate, plant e defuse viram etapas (replay 2D) |
| Mapa de calor | O mesmo componente de mapa pintando abates e plants por time ou jogador |

As posições vêm de `kills[].playerLocations`, `victimLocation`, `plantLocation`, `plantPlayerLocations` e `defuseLocation`, em coordenada do jogo. A gold `mapas` guarda a escala e o deslocamento de cada mapa para converter para o minimapa.

## Camadas de dados

**Bronze.** Tabela `valorant.bronze_partidas`. Uma linha por mapa, NDJSON aninhado do jeito que veio da API, com o nome do arquivo em `_arquivo`. Não se corrige nada aqui: se o dado veio errado, reprocessa a partir do bucket.

**Gold.** Tabelas planas, prontas para leitura: rankings, desempenho por time, mapa e agente, análise coletiva (economia, pós-plant, retake, composições), `eventos_round` (posição dos jogadores em cada abate, plant e defuse) e `mapas` (minimapa e conversão de coordenada do jogo para o minimapa). É a única camada que `stats` e `coach` leem.

**Firestore.** Estado da aplicação: usuários, estratégias da prancheta e cache. Nada analítico mora aqui.

## Segurança

- **Uma service account por serviço**, com privilégio mínimo. Nenhum serviço usa a conta padrão do Compute.
- **Coach só lê.** `sa-coach` tem leitura no dataset `valorant` e nada mais. O Gemini não escreve SQL: ele escolhe tools, e cada tool roda uma consulta pronta e parametrizada, com `maximum_bytes_billed`.
- **SQL livre só de reserva.** A tool `consulta_livre` fica desligada por padrão. Se for ligada, aceita só `SELECT` na gold, faz dry run antes e força `LIMIT`.
- **Token validado em cada serviço.** Todo microsserviço confere o JWT do Firebase. Não dá para confiar só no Hosting.
- **Mesma região** para todos os serviços: menos latência e nenhum tráfego entre regiões.
- **Sem chave JSON.** O CI autentica no GCP por Workload Identity Federation.

## CI/CD

- Monorepo no GitHub: `/front` e `/services/<nome>`.
- Push ou PR dispara o GitHub Actions, que autentica no GCP via Workload Identity Federation.
- Cada serviço vira uma imagem no Artifact Registry. O deploy no Cloud Run acontece só para a pasta que mudou.
- O front e as regras do Firestore vão para o Firebase Hosting pelo `deploy-front.yml`, no push na `main`. Canal de preview por PR ainda não: o WIF só aceita a `main`. Config em `firebase.json` e detalhes em [infra/README.md](../../infra/README.md).

## Decisões

| Decisão | Por quê |
|---|---|
| Cloud Run em vez de GKE | Escala a zero, cobra por uso e não tem cluster para manter. O tráfego de um campeonato universitário é baixo e em picos |
| BigQuery para analytics | Os dados de partida são aninhados e as consultas são agregações. Cabe no free tier por bastante tempo |
| Firestore para estado do app | Leitura rápida por documento, integra direto com o Firebase Auth e não precisa de servidor |
| Bronze/gold, sem silver | Volume pequeno. Uma camada intermediária só adicionaria passo. Se a gold ficar complexa, a silver entra |
| Coach como agente com tools | SQL gerado livre erra e é difícil de validar. Consulta pronta e testada dá número certo; o Gemini só escolhe qual usar e explica |
| Prancheta grava direto no Firestore | Não precisa de serviço para salvar desenho. As regras do Firestore garantem que cada um só edita o que é seu |
| Região única `southamerica-east1` (São Paulo) | Menor latência para quem usa no Brasil. BigQuery, Cloud Run, Firestore, Eventarc e Vertex AI (Gemini) estão disponíveis nela |
| Primeira versão em `devs.datropa.com` | Ambiente do hackathon. O domínio principal fica para depois |
| Linguagem do back e framework do front | **Em aberto.** Registrar aqui quando o time decidir |

## Regerar o diagrama

Precisa do Graphviz (`brew install graphviz`).

```bash
cd docs/arquitetura
uv run --with diagrams python arquitetura.py
```

Gera `arquitetura-da-tropa.png` e `.svg`. Mudou a arquitetura? Atualize o `.py`, regere as imagens e ajuste este arquivo no mesmo commit.
