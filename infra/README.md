# infra

Configuração do GCP e do Firebase: projeto, APIs, service accounts, IAM, WIF, bucket, dataset, regras do Firestore.

Dono: Guilherme. Escopo e regras em [AGENTS.md](AGENTS.md).

## Estado em 19/10/2026

Projeto `datropa`, tudo em `southamerica-east1`.

| Recurso | Nome | Observação |
|---|---|---|
| Bucket | `gs://datropa-raw-matches` | JSONs originais em `partidas/`, NDJSON do bronze em `bronze/`. Acesso uniforme, sem acesso público |
| BigQuery | dataset `valorant` | `bronze_partidas` com 330 linhas. A gold é do chico |
| Firestore | `(default)`, modo Native | Regras ainda fechadas (padrão) |
| Vertex AI | `gemini-2.5-flash` | É o único Gemini disponível na região. Os modelos Gemini 3 não estão em `southamerica-east1` |
| Firebase | web app `datropa-front` | Login por e-mail e senha. Hosting em `datropa.web.app` |

A config do web app do Firebase é pública, mas não entra no repo. Peça no canal.

## Acessos

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

| Conta | Para quê |
|---|---|
| `sa-build` | Build das funções e containers. Substitui a conta padrão do Compute |
| `sa-limite-custo` | Roda a função de corte. Tem `billing.projectManager` no projeto |

As contas `firebase-adminsdk-*`, a padrão do Compute e a do Cloud Build foram criadas pelo Google ao ligar as APIs. Nenhum serviço nosso usa elas.

## Pendências

- DNS de `devs.datropa.com` e domínio no Hosting.
- Login com Google no Firebase (Authentication > Sign-in method > Google, pelo console).
- Service accounts de `stats`, `coach` e `ingest`, WIF e CI/CD.
- Regras do Firestore.
