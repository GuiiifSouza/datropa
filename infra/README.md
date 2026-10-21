# infra

Configuração do GCP e do Firebase: projeto, APIs, service accounts, IAM, WIF, bucket, dataset, regras do Firestore.

Dono: Guilherme. Escopo e regras em [AGENTS.md](AGENTS.md).

## Estado em 20/10/2026

Projeto `datropa`, tudo em `southamerica-east1`.

| Recurso | Nome | Observação |
|---|---|---|
| Bucket | `gs://datropa-raw-matches` | JSONs originais em `partidas/`, NDJSON do bronze em `bronze/`. Acesso uniforme, sem acesso público |
| BigQuery | dataset `valorant` | `bronze_partidas` com 336 linhas. A gold é do chico |
| Firestore | `(default)`, modo Native | Regras ainda fechadas (padrão) |
| Vertex AI | `gemini-2.5-flash` | É o único Gemini disponível na região. Os modelos Gemini 3 não estão em `southamerica-east1` |
| Firebase | web app `datropa-front` | Login por e-mail e senha. Hosting em `datropa.web.app` |
| Artifact Registry | `servicos` (Docker) | Imagens em `southamerica-east1-docker.pkg.dev/datropa/servicos/<serviço>`. Guarda as 5 mais novas de cada serviço e apaga o resto com mais de 7 dias |
| WIF | pool `github`, provider `github-actions` | Só aceita token do repo `GuiiifSouza/datropa` (pelo id `1426256768`) na branch `main`. O GitHub Actions entra como `sa-deploy` |

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

O cartão aguenta R$ 500. São três travas:

1. **Orçamento** `datropa` de R$ 500/mês, com aviso por e-mail em 50%, 80%, 90% e 100%.
2. **Corte automático.** O orçamento avisa o tópico Pub/Sub `billing-cap`. A função [`limite-custo`](limite-custo/) desliga o billing do projeto quando o gasto do mês chega a **R$ 400**. A margem existe porque o custo chega ao orçamento com horas de atraso.
3. **Cota do BigQuery:** no máximo 100 GiB de consulta por dia no projeto. Passou disso, a consulta falha até o dia seguinte.

Billing desligado para tudo: Cloud Run, BigQuery, Vertex AI. Para religar, vincule a conta de billing ao projeto no console (Faturamento > Gerenciar projetos).

Ao subir serviço no Cloud Run, use `--max-instances` baixo (2 ou 3).

## Service accounts

Criadas por [`cicd.sh`](cicd.sh), menos `sa-build` e `sa-limite-custo`. O script é idempotente: mudou papel, edite e rode de novo (`bash infra/cicd.sh`, logado como owner).

| Conta | Para quê | Papéis |
|---|---|---|
| `sa-stats` | Cloud Run `stats` | `READER` no dataset `valorant`; `bigquery.jobUser` e `datastore.user` no projeto |
| `sa-coach` | Cloud Run `coach` | `READER` no dataset `valorant`; `bigquery.jobUser` e `aiplatform.user` no projeto |
| `sa-ingest` | Cloud Run `ingest` | `storage.objectViewer` no bucket `datropa-raw-matches`; `WRITER` no dataset `valorant`; `bigquery.jobUser` e `eventarc.eventReceiver` no projeto |
| `sa-deploy` | GitHub Actions, via WIF | `run.developer` no projeto; `artifactregistry.writer` só no repositório `servicos`; `iam.serviceAccountUser` só em `sa-stats`, `sa-coach` e `sa-ingest` |
| `sa-build` | Build das funções e containers. Substitui a conta padrão do Compute | |
| `sa-limite-custo` | Roda a função de corte | `billing.projectManager` no projeto |

As contas `firebase-adminsdk-*`, a padrão do Compute e a do Cloud Build foram criadas pelo Google ao ligar as APIs. Nenhum serviço nosso usa elas. Nenhuma conta tem chave JSON.

## CI/CD

Workflows em [`.github/workflows/`](../.github/workflows/):

| Workflow | Quando roda | O que faz |
|---|---|---|
| `ci.yml` | Todo PR | `actionlint`, `shellcheck` em `infra/` e `docker build` (sem push) dos serviços que mudaram e têm `Dockerfile`. Não autentica no GCP |
| `deploy-stats.yml`, `deploy-coach.yml`, `deploy-ingest.yml` | Push na `main` que mexe em `services/<serviço>/`, ou manual | Chama `deploy-servico.yml`: build, push no Artifact Registry e `gcloud run deploy` com a SA do serviço, `--max-instances 2`, em `southamerica-east1`. Sem `Dockerfile`, o deploy é pulado |
| `deploy-front.yml` | Desligado | Esqueleto do deploy no Firebase Hosting. Liga quando existir `front/` |

O build roda no runner do GitHub, não no Cloud Build. A imagem leva o SHA do commit como tag.

## Pendências

- **Cloud Run público para o Hosting.** A `sa-deploy` não mexe em IAM de serviço. Depois do primeiro deploy de `stats` e `coach`, o Guilherme libera o acesso (o serviço continua validando o JWT do Firebase):

  ```bash
  for s in stats coach; do
    gcloud run services add-iam-policy-binding $s --project datropa --region southamerica-east1 \
      --member allUsers --role roles/run.invoker
  done
  ```

  `ingest` fica privado.
- **Gatilho do Eventarc para o `ingest`**, depois do primeiro deploy dele:

  ```bash
  GCS_SA=$(gcloud storage service-agent --project datropa)
  gcloud projects add-iam-policy-binding datropa --member "serviceAccount:$GCS_SA" --role roles/pubsub.publisher
  gcloud run services add-iam-policy-binding ingest --project datropa --region southamerica-east1 \
    --member serviceAccount:sa-ingest@datropa.iam.gserviceaccount.com --role roles/run.invoker
  gcloud eventarc triggers create ingest-partidas --project datropa --location southamerica-east1 \
    --destination-run-service ingest --destination-run-region southamerica-east1 \
    --event-filters type=google.cloud.storage.object.v1.finalized \
    --event-filters bucket=datropa-raw-matches \
    --service-account sa-ingest@datropa.iam.gserviceaccount.com
  ```

- **Dockerfile** em `services/stats`, `services/coach` e `services/ingest`. Sem ele o deploy não roda.
- **Deploy do front:** `roles/firebasehosting.admin` para a `sa-deploy` e ligar `deploy-front.yml` quando o `front/` tiver esqueleto. Preview por PR precisa de outro provider no WIF.
- **Variáveis e segredos dos serviços** (ID do projeto Firebase, modelo do Gemini): entram como `--set-env-vars` no deploy quando os serviços disserem do que precisam.
- DNS de `devs.datropa.com` e domínio no Hosting.
- Login com Google no Firebase (Authentication > Sign-in method > Google, pelo console).
- Regras do Firestore.
- Proteção da branch `main` exigindo o `ci` verde.
