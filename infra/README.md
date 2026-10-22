# infra

Configuração do GCP e do Firebase: projeto, APIs, service accounts, IAM, WIF, bucket, dataset, regras do Firestore.

Dono: Guilherme. Escopo e regras em [AGENTS.md](AGENTS.md).

## Estado em 21/10/2026

Projeto `datropa`, tudo em `southamerica-east1`.

| Recurso | Nome | Observação |
|---|---|---|
| Bucket | `gs://datropa-raw-matches` | JSONs originais em `partidas/`, NDJSON do bronze em `bronze/`. Acesso uniforme, sem acesso público |
| BigQuery | dataset `valorant` | `bronze_partidas` com 336 linhas. A gold é do chico |
| Firestore | `(default)`, modo Native | Regras em [`firestore.rules`](firestore.rules), publicadas pelo `deploy-front.yml`. Modelo de dados abaixo |
| Vertex AI | `gemini-2.5-flash` | É o único Gemini disponível na região. Os modelos Gemini 3 não estão em `southamerica-east1` |
| Firebase | web app `datropa-front` | Login anônimo (Tropa AI) e por e-mail e senha |
| Firebase Hosting | site `datropa` | `datropa.web.app`, config em [`/firebase.json`](../firebase.json). Rewrites: `/api/coach/**` → Cloud Run `coach`, `/api/stats/**` → Cloud Run `stats` (só entra quando o `stats` estiver no ar), `/p/**` e o resto → `/index.html` (SPA). Deploy pelo `deploy-front.yml` |
| Artifact Registry | `servicos` (Docker) | Imagens em `southamerica-east1-docker.pkg.dev/datropa/servicos/<serviço>`. Guarda as 5 mais novas de cada serviço e apaga o resto com mais de 7 dias |
| WIF | pool `github`, provider `github-actions` | Só aceita token do repo `GuiiifSouza/datropa` (pelo id `1426256768`) na branch `main`. O GitHub Actions entra como `sa-deploy` |
| Cloud Run | `coach` | `https://coach-amnaanrzga-rj.a.run.app`, com a `sa-coach`. Invoker público (`allUsers`), que o próprio CD garante a cada deploy; o serviço valida o JWT do Firebase. Deploy pelo `deploy-coach.yml` |

A config do web app do Firebase é pública, mas não entra no repo. Peça no canal.

## Antes de rodar `gcloud` ou `bq`

A conta owner (`guilherme@souzasec.com`) pede reautenticação de tempos em tempos. Quando o token vence, todo comando falha com `Reauthentication failed. cannot prompt during non-interactive execution`. Agente e script não conseguem refazer o login sozinhos, porque o login abre o navegador.

Antes de qualquer script desta pasta, confira e, se precisar, faça o login no seu terminal:

```bash
gcloud auth print-access-token >/dev/null && echo ok || gcloud auth login guilherme@souzasec.com
```

O `bq` usa a mesma credencial do `gcloud`. Confira também a conta e o projeto ativos (`gcloud config list`): a máquina tem as contas da Nublify e a do Gmail logadas.


- chico e gugu: `bigquery.jobUser` no projeto e escrita (`WRITER`) no dataset `valorant`.
- O front não precisa de acesso ao GCP para rodar local.
- A organização do GCP só aceita contas do próprio domínio. O projeto `datropa` tem exceção na política `iam.allowedPolicyMemberDomains` para aceitar Gmail. Tirar depois do hackathon:

```bash
gcloud org-policies delete iam.allowedPolicyMemberDomains --project datropa
```

## Limite de custo

Limite de R$ 100 até a entrega (baixado de R$ 500 em 22/10). São três travas:

1. **Orçamento** `datropa` de R$ 100/mês, com aviso por e-mail em 50%, 80%, 90% e 100%.
2. **Corte automático.** O orçamento avisa o tópico Pub/Sub `billing-cap`. A função [`limite-custo`](limite-custo/) desliga o billing do projeto quando o gasto do mês chega a **R$ 80**. A margem existe porque o custo chega ao orçamento com horas de atraso.
3. **Cota do BigQuery:** no máximo 100 GiB de consulta por dia no projeto. Passou disso, a consulta falha até o dia seguinte.

Billing desligado para tudo: Cloud Run, BigQuery, Vertex AI. Para religar, vincule a conta de billing ao projeto no console (Faturamento > Gerenciar projetos).

Ao subir serviço no Cloud Run, use `--max-instances` baixo (2 ou 3).

## Firebase Hosting

- **Pasta publicada:** `front/dist`. Assumimos Vite (`npm run build` gera `front/dist`). **Confirmar com o front** (Lhobregat e RhuanK); se o framework gerar outra pasta, mude `hosting.public` no `firebase.json`.
- **Sem `front/package.json`**, o CI publica a página provisória de [`hosting-placeholder/`](hosting-placeholder/), para os rewrites já valerem.
- **Rota completa vai para o serviço:** `/api/coach/perguntar` chega no coach como `/api/coach/perguntar`. Cada serviço declara as rotas com o prefixo `/api/<serviço>`.
- **Rewrite para serviço que não existe:** o Hosting recusa o deploy ("Cloud Run service `stats` does not exist in region", conferido em 21/10). Por isso o `deploy-front.yml` tira do deploy os rewrites de serviço que ainda não estão no ar e roda de novo depois de cada `deploy-stats` com sucesso. Enquanto o `stats` não sobe, `/api/stats/**` cai no fallback da SPA e devolve o `index.html`.
- Tudo sai com `Cache-Control: no-cache` (inclusive as rotas da SPA, como `/p/abc`, que sem isso ficavam 1 hora no cache do navegador e mostravam versão velha depois de deploy), menos `/assets/**` (arquivos com hash do Vite), com cache de um ano.

## Firestore: modelo de dados

Regras em [`firestore.rules`](firestore.rules). O cliente só enxerga as duas coleções abaixo; todo o resto é negado. Mudou o modelo? Peça ao Guilherme: regra e teste mudam juntos.

**`usuarios/{uid}`**: perfil. O id é o `uid` do Firebase Auth. Cada um lê, cria, edita e apaga só o próprio documento; ninguém lista a coleção.

| Campo | Tipo | Obrigatório | Limite |
|---|---|---|---|
| `nome` | string | não | 80 caracteres |
| `time_favorito` | string (id do time) | não | 100 caracteres |
| `preferencias` | map | não | 30 chaves |
| `criado_em`, `atualizado_em` | timestamp (`serverTimestamp()`) | não | |

**`estrategias/{codigo}`**: estratégias da prancheta. O id do documento é o código curto do link `/p/<codigo>`: 6 a 24 caracteres `A-Z a-z 0-9 _ -`. Gere um código aleatório de uns 10 caracteres no front.

| Campo | Tipo | Obrigatório | Limite |
|---|---|---|---|
| `dono` | string | sim | igual ao `uid` de quem grava; não muda depois |
| `mapa` | string | sim | 40 caracteres |
| `dados` | string | sim | JSON da prancheta inteira (peças, desenhos, etapas) com `JSON.stringify`, até 300 mil caracteres |
| `titulo` | string | não | 100 caracteres |
| `lado` | string | não | `ataque` ou `defesa` |
| `partida_id`, `round` | string, inteiro | não | round real aberto na prancheta; `round` de 1 a 60 |
| `criado_em`, `atualizado_em` | timestamp (`serverTimestamp()`) | não | `criado_em` não muda na edição |

- **Criar, editar e apagar:** só o dono. Campo fora da tabela é recusado.
- **Abrir pelo link `/p/<codigo>`:** **exige login**, de qualquer usuário. O app inteiro já pede login (as APIs exigem o JWT), o código é aleatório e isso evita leitura anônima em massa. Se o pitch precisar de link aberto sem login, é uma linha na regra (`allow get: if true;`).
- **Listar:** só as próprias, com `where('dono', '==', uid)`. Consulta sem esse filtro é recusada.
- **Por que `dados` é string:** a regra do Firestore não mede o tamanho de map nem de lista aninhada, só de string. Serializar a prancheta é o jeito de ter limite de tamanho de verdade.

**`cache/**`**: do `stats`, pelo Admin SDK (que não passa pelas regras). Cliente não lê nem escreve.

**Testar as regras** (precisa de Java 21+ e Node 24+; o CI roda no job `regras` quando as regras mudam):

```bash
cd infra/firestore-testes
npm ci
npm test   # sobe o emulador do Firestore na porta 8181 e roda regras.test.js
```

## Service accounts

Criadas por [`cicd.sh`](cicd.sh), menos `sa-build` e `sa-limite-custo`. O script é idempotente: mudou papel, edite e rode de novo (`bash infra/cicd.sh`, logado como owner).

| Conta | Para quê | Papéis |
|---|---|---|
| `sa-stats` | Cloud Run `stats` | `READER` no dataset `valorant`; `bigquery.jobUser` e `datastore.user` no projeto |
| `sa-coach` | Cloud Run `coach` | `READER` no dataset `valorant`; `bigquery.jobUser` e `aiplatform.user` no projeto |
| `sa-ingest` | Cloud Run `ingest` | `storage.objectViewer` no bucket `datropa-raw-matches`; `WRITER` no dataset `valorant`; `bigquery.jobUser` e `eventarc.eventReceiver` no projeto |
| `sa-deploy` | GitHub Actions, via WIF | `run.developer`, `eventarc.developer`, `firebasehosting.admin`, `firebaserules.admin` e `serviceusage.serviceUsageConsumer` (o `firebase-tools` confere se a API do Firestore está ligada) no projeto; `deployRunIam` no projeto (papel próprio: só ler e gravar IAM de serviço do Cloud Run, para o `allUsers` e o invoker do Eventarc); `artifactregistry.writer` só no repositório `servicos`; `iam.serviceAccountUser` só em `sa-stats`, `sa-coach` e `sa-ingest` |
| `sa-build` | Build das funções e containers. Substitui a conta padrão do Compute | |
| `sa-limite-custo` | Roda a função de corte | `billing.projectManager` no projeto |
| Agente do Cloud Storage (`service-19667506828@gs-project-accounts…`) | Publica os eventos do bucket para o Eventarc | `pubsub.publisher` no projeto |

As contas `firebase-adminsdk-*`, a padrão do Compute e a do Cloud Build foram criadas pelo Google ao ligar as APIs. Nenhum serviço nosso usa elas. Nenhuma conta tem chave JSON.

## CI/CD

Workflows em [`.github/workflows/`](../.github/workflows/):

| Workflow | Quando roda | O que faz |
|---|---|---|
| `ci.yml` | Todo PR | `actionlint`, `shellcheck` em `infra/`, teste das regras do Firestore no emulador (job `regras`, só quando as regras mudam) e `docker build` (sem push) dos serviços que mudaram e têm `Dockerfile`. Não autentica no GCP |
| `deploy-stats.yml`, `deploy-coach.yml`, `deploy-ingest.yml` | Push na `main` que mexe em `services/<serviço>/`, ou manual | Chama `deploy-servico.yml`: build, push no Artifact Registry e `gcloud run deploy` com a SA do serviço, `--max-instances 2`, em `southamerica-east1`. Sem `Dockerfile`, o deploy é pulado. Depois do deploy: `stats` e `coach` ficam com `allUsers` como invoker (o Hosting precisa; o serviço valida o JWT). `ingest` fica privado, e o CD garante o invoker da `sa-ingest` e o gatilho `ingest-partidas` do Eventarc |
| `deploy-front.yml` | Push na `main` que mexe em `front/**`, `firebase.json`, `.firebaserc`, `infra/firestore.rules` ou `infra/hosting-placeholder/`; depois de cada `deploy-stats` com sucesso; ou manual | Build do front (`npm ci && npm run build` em `front/`) ou a página provisória, tira os rewrites de serviço que ainda não existe e roda `firebase deploy --only hosting,firestore:rules` com o `firebase-tools` fixo na versão do workflow. Sem preview por PR: o WIF só aceita a `main` |

O build roda no runner do GitHub, não no Cloud Build. A imagem leva o SHA do commit como tag. O deploy é automático: o primeiro sai sozinho no push que trouxer o `Dockerfile` do serviço para a `main`.

**Proteção da `main`:** merge só com os checks `lint`, `build (stats)`, `build (coach)` e `build (ingest)` verdes. Sem force push e sem apagar a branch. Admin (o Guilherme) ainda consegue passar por cima numa emergência. Mudou o nome de um job no `ci.yml`? Atualize os checks exigidos em Settings > Branches, senão todo PR fica travado esperando um check que não existe mais.

**Gatilho do `ingest`:** dispara para todo arquivo novo no bucket, inclusive o NDJSON em `bronze/`. O `ingest` precisa ignorar o que não estiver em `partidas/`.

## Pendências

- **Dockerfile** em `services/stats` e `services/ingest`. Sem ele o deploy não roda. O `coach` já tem.
- ~~**Deploy do front:** papéis da `sa-deploy` e `deploy-front.yml` ligado.~~ Feito em 21/10. Falta: preview por PR (precisa de outro provider no WIF) e confirmar com o front a pasta do build (`front/dist`).
- **Variáveis e segredos dos serviços**: entram como `--set-env-vars` no deploy quando os serviços disserem do que precisam. O `coach` não precisa: os padrões dele (projeto Firebase `datropa`, `gemini-2.5-flash`) já são os de produção.
- Login com Google no Firebase (Authentication > Sign-in method > Google, pelo console).
- ~~Regras do Firestore.~~ Feito em 21/10 (modelo acima).

## Dívida técnica

- **DNS de `devs.datropa.com`** e domínio no Hosting. Por enquanto o front fica em `datropa.web.app`.
