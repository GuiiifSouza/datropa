"""Junta os JSONs da base num NDJSON para o bronze.

Uma linha por arquivo (um mapa). O JSON vai intacto, com dois campos a mais:
  _arquivo  nome do arquivo
  _pasta    subpasta relativa à entrada, ex. "Univavá/Classificatória 1"

A linha é montada por `ingest/partida.py`, o mesmo código do serviço do Eventarc.

Uso: python3 gerar_ndjson.py <pasta_dos_jsons> <saida.ndjson>
"""

import json
import os
import sys

# services/ingest no path, para importar o módulo do serviço com python3 puro.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ingest.partida import PartidaInvalida, arquivo_e_pasta, linha_ndjson, montar_linha  # noqa: E402


def main():
    if len(sys.argv) != 3:
        sys.exit("uso: python3 gerar_ndjson.py <pasta_dos_jsons> <saida.ndjson>")
    entrada, saida = sys.argv[1], sys.argv[2]

    arquivos = []
    for raiz, _, nomes in os.walk(entrada):
        for nome in nomes:
            if nome.endswith(".json"):
                arquivos.append(os.path.join(raiz, nome))
    arquivos.sort()

    pasta_saida = os.path.dirname(saida)
    if pasta_saida:
        os.makedirs(pasta_saida, exist_ok=True)

    with open(saida, "w", encoding="utf-8") as out:
        for caminho in arquivos:
            with open(caminho, encoding="utf-8") as f:
                partida = json.load(f)
            relativo = os.path.relpath(caminho, entrada).replace(os.sep, "/")
            arquivo, pasta = arquivo_e_pasta(relativo)
            try:
                linha = montar_linha(partida, arquivo, pasta)
            except PartidaInvalida as e:
                sys.exit(f"{caminho}: {e}")
            out.write(linha_ndjson(linha))
            out.write("\n")

    print(f"{len(arquivos)} arquivos -> {saida}")


if __name__ == "__main__":
    main()
