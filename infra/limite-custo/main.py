"""Desliga o billing do projeto quando o gasto do mês chega ao limite.

Recebe a notificação do orçamento pelo Pub/Sub (tópico billing-cap).
"""

import base64
import json
import os

import functions_framework
from googleapiclient import discovery

PROJETO = os.environ["PROJETO"]
LIMITE = float(os.environ["LIMITE"])


@functions_framework.cloud_event
def limite_custo(evento):
    aviso = json.loads(base64.b64decode(evento.data["message"]["data"]))
    gasto = float(aviso["costAmount"])
    print(f"gasto {gasto} {aviso.get('currencyCode')} de limite {LIMITE}")
    if gasto < LIMITE:
        return

    billing = discovery.build("cloudbilling", "v1", cache_discovery=False)
    nome = f"projects/{PROJETO}"
    if not billing.projects().getBillingInfo(name=nome).execute().get("billingEnabled"):
        print("billing já está desligado")
        return
    billing.projects().updateBillingInfo(name=nome, body={"billingAccountName": ""}).execute()
    print("billing desligado")
