#!/usr/bin/env bash
# Executar no Cloud Shell. Padrao: dry run; execute para consultar.
set -euo pipefail
pasta_sql="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
modo="${1:-dry-run}"
opcoes=()
case "$modo" in
  dry-run) opcoes+=(--dry_run) ;;
  execute) ;;
  *) echo "Uso: bash validar_jogador.sh [dry-run|execute]" >&2; exit 2 ;;
esac
bq --project_id=datropa --location=southamerica-east1 query \
  --use_legacy_sql=false --maximum_bytes_billed=1073741824 \
  --format=prettyjson "${opcoes[@]}" \
  --parameter="jogador_id:STRING:${JOGADOR_ID:-BGGCT8BEb6ej9WVEvzG0F2RazRuo2Dx5ty6YVEr-gPExwtsVbTtRuyQx0ttSnMMTB2vfyYjh0O2UXg}" \
  --parameter="torneio_id:STRING:${TORNEIO_ID:-}" \
  --parameter="mapa_id:STRING:${MAPA_ID:-}" \
  --parameter="agente_id:STRING:${AGENTE_ID:-}" \
  --parameter="data_inicio:STRING:${DATA_INICIO:-}" \
  --parameter="data_fim:STRING:${DATA_FIM:-}" \
  < "$pasta_sql/jogador_detalhe.sql"
