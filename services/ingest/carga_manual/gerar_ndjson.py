"""Junta os JSONs da base num NDJSON para o bronze.

Uma linha por arquivo (um mapa). O JSON vai intacto, com dois campos a mais:
  _arquivo  nome do arquivo
  _pasta    subpasta relativa à entrada, ex. "Univavá/Classificatória 1"

Uso: python3 gerar_ndjson.py <pasta_dos_jsons> <saida.ndjson>
"""

import json
import os
import sys
import unicodedata


def nfc(texto):
    # O macOS pode devolver nome com acento decomposto. NFC deixa a busca por texto previsível.
    return unicodedata.normalize("NFC", texto)


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
            if not isinstance(partida, dict):
                sys.exit(f"{caminho}: esperava um objeto JSON")
            pasta = os.path.relpath(os.path.dirname(caminho), entrada)
            partida["_arquivo"] = nfc(os.path.basename(caminho))
            partida["_pasta"] = "" if pasta == "." else nfc(pasta.replace(os.sep, "/"))
            out.write(json.dumps(partida, ensure_ascii=False, separators=(",", ":")))
            out.write("\n")

    print(f"{len(arquivos)} arquivos -> {saida}")


if __name__ == "__main__":
    main()
