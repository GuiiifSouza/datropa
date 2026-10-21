# Gold — entrega oficial do Chico

Versao gold_336_v1, publicada em datropa.valorant (southamerica-east1).
13 tabelas, 336 partidas, 24 verificacoes conjuntas aprovadas.

- [Entrega e pendencias](ENTREGA_CHICO.md)
- [Decisoes de consumo para API/front/coach](OFICIALIZACAO_E_API.md)
- [Evidencias da publicacao](PUBLICACAO_GOLD_336_V1.md)
- SQLs de producao: oficial/*.sql
- Validacoes: oficial/validacoes/*.sql
- Utilitario local dos HTMLs: validacoes/atualizar_htmls_mortes.py

Rotina apos publicacao:
```bash
python3 services/stats/sql/gold/oficial/publicar_gold.py verificar
python3 services/stats/sql/gold/oficial/publicar_gold.py validar
```
verificar faz apenas dry runs; validar executa consultas somente leitura.
publicar serve apenas para primeira criacao em destinos inexistentes.
Nao repetir publicacao sobre as tabelas atuais. Cada consulta tem limite de 1 GiB.
SQLs e planos antigos de teste foram removidos; historico Git preserva-os.
Nenhuma tabela de teste foi apagada no BigQuery.
