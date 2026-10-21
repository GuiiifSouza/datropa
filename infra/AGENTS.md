# infra

Configuração do GCP e do Firebase: projeto, APIs, service accounts, IAM, WIF, bucket, dataset, regras do Firestore.

**Dono:** Guilherme. Leia também o [AGENTS.md da raiz](/AGENTS.md) e o [plano de ação](/docs/plano-de-acao.md).

## Escopo

- Tudo que exige permissão de owner no GCP ou no Firebase.

## Regras

- **Mexa só nesta pasta.** Precisou de algo em outra, peça ao dono (veja `.github/CODEOWNERS`) ou abra uma issue.
- Só o Guilherme altera esta pasta. Precisa de algo? Peça no canal.
- Nada de chave, segredo ou `.env` aqui. O repo é público.
- Antes de rodar `gcloud` ou `bq`, teste com `gcloud auth print-access-token`. Se der `Reauthentication failed`, pare e peça ao Guilherme para rodar `gcloud auth login guilherme@souzasec.com` no terminal dele. Não tente contornar com outra conta.
