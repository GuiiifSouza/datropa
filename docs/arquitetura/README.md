# Arquitetura

![Arquitetura do Da Tropa no Google Cloud](arquitetura-da-tropa.png)

Versão vetorial: [arquitetura-da-tropa.svg](arquitetura-da-tropa.svg). Fonte do desenho: [arquitetura.py](arquitetura.py).

## Visão geral

Tudo roda num projeto GCP só, com todos os serviços na mesma região. O front é uma SPA no Firebase Hosting. As rotas `/api/**` são reescritas para quatro microsserviços no Cloud Run, cada um com a própria service account. Os dados das partidas entram como JSON no Cloud Storage, viram tabelas no BigQuery e alimentam as estatísticas, o coach de IA e a apuração do bolão.

## Componentes

| Componente | Serviço GCP | Papel |
|---|---|---|
| Front | Firebase Hosting | SPA em `datropa.com.br`. Rewrites de `/api/stats/**`, `/api/coach/**` e `/api/bolao/**` para o Cloud Run |
| Login | Firebase Authentication | Emite o JWT que o front manda em toda chamada de API |
| `stats` | Cloud Run (`sa-stats`) | Rankings, desempenho por time e mapa, meta de agentes. Lê a camada gold e guarda cache no Firestore |
| `coach` | Cloud Run (`sa-coach`) | Coach de IA. Usa o Gemini para transformar pergunta em SQL ou texto, valida o SQL e roda só leitura na gold |
| `bolao` | Cloud Run (`sa-bolao`) | Palpites e ranking do bolão. Só pontos, sem dinheiro |
| `ingest` | Cloud Run (`sa-ingest`) | Recebe o evento de arquivo novo, carrega o bronze, atualiza o gold e avisa que a partida entrou |
| Partidas brutas | Cloud Storage `raw-matches` | JSONs da base oficial do hackathon, sem transformação |
| Analytics | BigQuery, dataset `valorant` | `bronze`: NDJSON aninhado como chegou. `gold`: tabelas prontas para consulta |
| App | Firestore | Usuários, palpites, pontuação e cache de estatísticas |
| Eventos | Pub/Sub `match-ingested` | Liga a ingestão à apuração do bolão |
| IA | Vertex AI (Gemini) | NL → SQL, scouting e resumo de partidas |
| Imagens | Artifact Registry | Imagens dos containers de cada serviço |

## Fluxos

Os números batem com as setas do diagrama.

### Usuário (azul)

1. O usuário abre `datropa.com.br` no navegador ou no celular.
2. Faz login no Firebase Authentication e recebe um JWT.
3. O front chama `/api/<serviço>/**`. O Hosting reescreve para o Cloud Run certo.
4. `stats` lê a gold no BigQuery e usa o Firestore como cache.
5. `coach`:
   - **5a.** manda a pergunta ao Gemini, que devolve SQL ou texto;
   - **5b.** valida o SQL e roda na gold, só leitura.
6. `bolao` grava palpites e lê o ranking no Firestore.

### Ingestão de partidas (verde)

7. Os JSONs da base do hackathon sobem para o bucket `raw-matches` (a base é fechada: só os arquivos da organização).
8. O Eventarc avisa o `ingest` que chegou arquivo novo.
9. O `ingest` carrega o NDJSON no bronze e atualiza as tabelas gold.

### Eventos (laranja)

10. O `ingest` publica em `match-ingested`.
11. O `bolao` recebe a mensagem, apura os palpites da partida e atualiza o ranking.

## Camadas de dados

**Bronze.** Uma linha por partida, NDJSON aninhado do jeito que veio da API. Não se corrige nada aqui: se o dado veio errado, reprocessa a partir do bucket.

**Gold.** Tabelas planas, prontas para leitura: rankings, desempenho por time e mapa, meta de agentes. É a única camada que `stats` e `coach` leem.

**Firestore.** Estado da aplicação: usuários, palpites, pontuação e cache. Nada analítico mora aqui.

## Segurança

- **Uma service account por serviço**, com privilégio mínimo. Nenhum serviço usa a conta padrão do Compute.
- **Coach só lê.** `sa-coach` tem leitura no dataset `valorant` e nada mais. O SQL gerado passa por validação antes de rodar:
  - só `SELECT`;
  - limite de bytes processados (`maximum_bytes_billed`);
  - dry run antes da execução real.
- **Token validado em cada serviço.** Todo microsserviço confere o JWT do Firebase. Não dá para confiar só no Hosting.
- **Mesma região** para todos os serviços: menos latência e nenhum tráfego entre regiões.
- **Sem chave JSON.** O CI autentica no GCP por Workload Identity Federation.

## CI/CD

- Monorepo no GitHub: `/front` e `/services/<nome>`.
- Push ou PR dispara o GitHub Actions, que autentica no GCP via Workload Identity Federation.
- Cada serviço vira uma imagem no Artifact Registry. O deploy no Cloud Run acontece só para a pasta que mudou.
- O front faz deploy no Firebase Hosting, com canal de preview por PR.

## Decisões

| Decisão | Por quê |
|---|---|
| Cloud Run em vez de GKE | Escala a zero, cobra por uso e não tem cluster para manter. O tráfego de um campeonato universitário é baixo e em picos |
| BigQuery para analytics | Os dados de partida são aninhados e as consultas são agregações. Cabe no free tier por bastante tempo |
| Firestore para estado do app | Leitura rápida por documento, integra direto com o Firebase Auth e não precisa de servidor |
| Bronze/gold, sem silver | Volume pequeno. Uma camada intermediária só adicionaria passo. Se a gold ficar complexa, a silver entra |
| Pub/Sub entre ingest e bolão | O `ingest` não precisa saber quem consome a partida nova. Outro consumidor entra sem mexer nele |
| Bolão só de pontos | Sem dinheiro, sem aposta. Evita regulação e pagamento |

## Regerar o diagrama

Precisa do Graphviz (`brew install graphviz`).

```bash
cd docs/arquitetura
uv run --with diagrams python arquitetura.py
```

Gera `arquitetura-da-tropa.png` e `.svg`. Mudou a arquitetura? Atualize o `.py`, regere as imagens e ajuste este arquivo no mesmo commit.
