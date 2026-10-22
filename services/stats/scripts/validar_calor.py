"""Dry runs do calor: valida SQL no BigQuery sem executar consultas de dados."""
from pathlib import Path

from google.cloud import bigquery


def main():
    sql = (
        Path(__file__).resolve().parents[1] / "queries/mapa_calor.sql"
    ).read_text(encoding="utf-8")
    with bigquery.Client(
        project="datropa", location="southamerica-east1"
    ) as client:
        for tipo in ("abate", "plant", "morte"):
            parametros = [
                bigquery.ScalarQueryParameter("mapa_id", "STRING", "ascent"),
                bigquery.ScalarQueryParameter("tipo", "STRING", tipo),
                bigquery.ScalarQueryParameter("torneio_id", "STRING", None),
                bigquery.ScalarQueryParameter("time_id", "STRING", None),
                bigquery.ScalarQueryParameter("jogador_id", "STRING", None),
                bigquery.ScalarQueryParameter("lado", "STRING", "ataque"),
                bigquery.ScalarQueryParameter("compra", "STRING", "eco"),
                bigquery.ScalarQueryParameter("tempo_inicio_ms", "INT64", 0),
                bigquery.ScalarQueryParameter("tempo_fim_ms", "INT64", 30000),
                bigquery.ScalarQueryParameter("data_inicio", "DATE", None),
                bigquery.ScalarQueryParameter("data_fim", "DATE", None),
                bigquery.ScalarQueryParameter("limite", "INT64", 3),
                bigquery.ScalarQueryParameter("deslocamento", "INT64", 0),
            ]
            config = bigquery.QueryJobConfig(
                dry_run=True,
                use_query_cache=False,
                maximum_bytes_billed=1073741824,
                query_parameters=parametros,
            )
            job = client.query(sql, job_config=config)
            print(f"{tipo} | SQL validado | {job.total_bytes_processed} bytes estimados")


if __name__ == "__main__":
    main()
