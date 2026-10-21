#!/usr/bin/env bash
# Service accounts dos serviços, IAM, Artifact Registry e Workload Identity Federation do GitHub Actions.
#
# Idempotente: pode rodar de novo, só cria o que falta e as bindings não duplicam.
# Sem segredo e sem chave JSON. Rode da raiz do repo, logado como owner do projeto:
#
#   bash infra/cicd.sh
#
# Precisa de gcloud, bq e jq.
set -euo pipefail

PROJETO=datropa
REGIAO=southamerica-east1
DATASET=valorant
BUCKET=datropa-raw-matches
REPO_AR=servicos
REPO_GH=GuiiifSouza/datropa
REPO_GH_ID=1426256768 # id numérico do repo no GitHub; não muda se o repo for renomeado ou recriado por outro
POOL=github
PROVIDER=github-actions

NUMERO=$(gcloud projects describe "$PROJETO" --format='value(projectNumber)')
sa() { echo "$1@$PROJETO.iam.gserviceaccount.com"; }

log() { printf '\n== %s\n' "$*"; }

projeto_role() { # membro role
  gcloud projects add-iam-policy-binding "$PROJETO" --member "$1" --role "$2" \
    --condition=None --quiet --format=none
}

# Acesso no nível do dataset (READER ou WRITER), sem tocar nas outras entradas.
dataset_acesso() { # email role
  local tmp
  tmp=$(mktemp)
  bq --project_id="$PROJETO" show --format=prettyjson "$PROJETO:$DATASET" \
    | jq --arg e "$1" --arg r "$2" '
        {access: ((.access | map(select(.userByEmail != $e))) + [{role: $r, userByEmail: $e}])}' >"$tmp"
  bq --project_id="$PROJETO" update --source "$tmp" "$PROJETO:$DATASET" >/dev/null
  rm -f "$tmp"
}

log "APIs"
gcloud services enable --project "$PROJETO" \
  run.googleapis.com artifactregistry.googleapis.com eventarc.googleapis.com aiplatform.googleapis.com \
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com

log "Service accounts"
criar_sa() { # nome descrição
  if gcloud iam service-accounts describe "$(sa "$1")" --project "$PROJETO" >/dev/null 2>&1; then
    echo "$1 já existe"
  else
    gcloud iam service-accounts create "$1" --project "$PROJETO" --display-name "$2"
  fi
}
criar_sa sa-stats "Cloud Run stats"
criar_sa sa-coach "Cloud Run coach"
criar_sa sa-ingest "Cloud Run ingest"
criar_sa sa-deploy "GitHub Actions: deploy no Cloud Run"

log "sa-stats: lê o valorant, roda job do BigQuery, cache no Firestore"
dataset_acesso "$(sa sa-stats)" READER
projeto_role "serviceAccount:$(sa sa-stats)" roles/bigquery.jobUser
projeto_role "serviceAccount:$(sa sa-stats)" roles/datastore.user

log "sa-coach: só lê o valorant, roda job do BigQuery, chama o Vertex AI"
dataset_acesso "$(sa sa-coach)" READER
projeto_role "serviceAccount:$(sa sa-coach)" roles/bigquery.jobUser
projeto_role "serviceAccount:$(sa sa-coach)" roles/aiplatform.user

log "sa-ingest: lê o bucket, escreve no valorant, recebe evento do Eventarc"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member "serviceAccount:$(sa sa-ingest)" --role roles/storage.objectViewer --format=none
dataset_acesso "$(sa sa-ingest)" WRITER
projeto_role "serviceAccount:$(sa sa-ingest)" roles/bigquery.jobUser
projeto_role "serviceAccount:$(sa sa-ingest)" roles/eventarc.eventReceiver

log "Artifact Registry"
if gcloud artifacts repositories describe "$REPO_AR" --project "$PROJETO" --location "$REGIAO" >/dev/null 2>&1; then
  echo "$REPO_AR já existe"
else
  gcloud artifacts repositories create "$REPO_AR" --project "$PROJETO" --location "$REGIAO" \
    --repository-format docker --description "Imagens dos serviços no Cloud Run"
fi
# Guarda as 5 imagens mais novas de cada serviço e apaga o resto com mais de 7 dias.
politica=$(mktemp)
cat >"$politica" <<'JSON'
[
  {"name": "manter-5-recentes", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 5}},
  {"name": "apagar-antigas", "action": {"type": "Delete"}, "condition": {"olderThan": "7d"}}
]
JSON
gcloud artifacts repositories set-cleanup-policies "$REPO_AR" --project "$PROJETO" --location "$REGIAO" \
  --policy "$politica" --no-dry-run --format=none
rm -f "$politica"

log "sa-deploy: deploy no Cloud Run, push no Artifact Registry, actAs só nas 3 contas"
projeto_role "serviceAccount:$(sa sa-deploy)" roles/run.developer
gcloud artifacts repositories add-iam-policy-binding "$REPO_AR" --project "$PROJETO" --location "$REGIAO" \
  --member "serviceAccount:$(sa sa-deploy)" --role roles/artifactregistry.writer --format=none
for s in sa-stats sa-coach sa-ingest; do
  gcloud iam service-accounts add-iam-policy-binding "$(sa "$s")" --project "$PROJETO" \
    --member "serviceAccount:$(sa sa-deploy)" --role roles/iam.serviceAccountUser --format=none
done

log "sa-deploy: IAM dos serviços do Cloud Run (allUsers e invoker do Eventarc)"
# Papel próprio em vez de run.admin: só lê e grava a policy de serviço do Cloud Run.
# Fica no projeto inteiro: o Cloud Run não avalia condição por nome de serviço, e o
# run.developer acima já deixa a sa-deploy atualizar qualquer serviço do projeto.
PAPEL_IAM_RUN=deployRunIam
PERMISSOES_IAM_RUN=run.services.getIamPolicy,run.services.setIamPolicy
if gcloud iam roles describe "$PAPEL_IAM_RUN" --project "$PROJETO" >/dev/null 2>&1; then
  gcloud iam roles update "$PAPEL_IAM_RUN" --project "$PROJETO" \
    --permissions "$PERMISSOES_IAM_RUN" --quiet --format=none
else
  gcloud iam roles create "$PAPEL_IAM_RUN" --project "$PROJETO" --stage GA \
    --title "Deploy: IAM dos serviços do Cloud Run" --permissions "$PERMISSOES_IAM_RUN" --format=none
fi
projeto_role "serviceAccount:$(sa sa-deploy)" "projects/$PROJETO/roles/$PAPEL_IAM_RUN"
# Cria o gatilho do Eventarc do ingest no CD.
projeto_role "serviceAccount:$(sa sa-deploy)" roles/eventarc.developer

log "Eventarc: o agente do Cloud Storage publica os eventos do bucket"
# `storage service-agent` só informa o e-mail; quem cria a conta é o `services identity create`.
gcloud beta services identity create --service storage.googleapis.com --project "$PROJETO" --format=none
# A saída vem com quebra de linha e espaços na frente do e-mail.
AGENTE_GCS=$(gcloud storage service-agent --project "$PROJETO" | tr -d '[:space:]')
projeto_role "serviceAccount:$AGENTE_GCS" roles/pubsub.publisher

log "Workload Identity Federation"
if gcloud iam workload-identity-pools describe "$POOL" --project "$PROJETO" --location global >/dev/null 2>&1; then
  echo "pool $POOL já existe"
else
  gcloud iam workload-identity-pools create "$POOL" --project "$PROJETO" --location global \
    --display-name "GitHub Actions"
fi

# Só o repo GuiiifSouza/datropa (pelo id) e só a branch main. PR e outras branches não autenticam.
CONDICAO="assertion.repository_id == '$REPO_GH_ID' && assertion.ref == 'refs/heads/main'"
MAPA="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref"
if gcloud iam workload-identity-pools providers describe "$PROVIDER" --project "$PROJETO" \
  --location global --workload-identity-pool "$POOL" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers update-oidc "$PROVIDER" --project "$PROJETO" \
    --location global --workload-identity-pool "$POOL" \
    --attribute-mapping "$MAPA" --attribute-condition "$CONDICAO" --format=none
  echo "provider $PROVIDER atualizado"
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --project "$PROJETO" \
    --location global --workload-identity-pool "$POOL" --display-name "GitHub $REPO_GH" \
    --issuer-uri https://token.actions.githubusercontent.com \
    --attribute-mapping "$MAPA" --attribute-condition "$CONDICAO"
fi

gcloud iam service-accounts add-iam-policy-binding "$(sa sa-deploy)" --project "$PROJETO" \
  --role roles/iam.workloadIdentityUser --format=none \
  --member "principalSet://iam.googleapis.com/projects/$NUMERO/locations/global/workloadIdentityPools/$POOL/attribute.repository_id/$REPO_GH_ID"

log "Pronto"
echo "workload_identity_provider: projects/$NUMERO/locations/global/workloadIdentityPools/$POOL/providers/$PROVIDER"
echo "service_account:            $(sa sa-deploy)"
echo "imagens:                    $REGIAO-docker.pkg.dev/$PROJETO/$REPO_AR/<serviço>"
