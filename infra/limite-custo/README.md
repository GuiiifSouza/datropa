# limite-custo

Função que desliga o billing do projeto quando o gasto do mês chega ao limite. Recebe o aviso do orçamento pelo tópico `billing-cap`.

O limite fica na variável `LIMITE`, em reais. Hoje é 80, com o orçamento de 100.

## Deploy

```bash
gcloud functions deploy limite-custo --gen2 --project datropa --region southamerica-east1 \
  --runtime python312 --source infra/limite-custo --entry-point limite_custo \
  --trigger-topic billing-cap \
  --service-account sa-limite-custo@datropa.iam.gserviceaccount.com \
  --trigger-service-account sa-limite-custo@datropa.iam.gserviceaccount.com \
  --build-service-account projects/datropa/serviceAccounts/sa-build@datropa.iam.gserviceaccount.com \
  --set-env-vars PROJETO=datropa,LIMITE=80 --max-instances 1 --memory 256Mi
```

## Testar sem desligar nada

Mande um gasto abaixo do limite e veja o log:

```bash
gcloud pubsub topics publish billing-cap --project datropa \
  --message='{"costAmount":1.23,"budgetAmount":500,"currencyCode":"BRL"}'
```

O log deve mostrar `gasto 1.23 BRL de limite 400.0`. Nunca teste com valor acima do limite: o billing desliga de verdade.
