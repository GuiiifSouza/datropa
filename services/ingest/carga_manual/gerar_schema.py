"""Gera o schema do bronze lendo todas as linhas do NDJSON.

O autodetect do BigQuery falha na base (ex.: matchInfo.premierMatchInfo vem sempre {}).
Este script junta os tipos vistos em todas as linhas:
  - null não fixa tipo;
  - INTEGER com FLOAT vira FLOAT;
  - objeto vira RECORD com a união dos campos;
  - lista vira REPEATED do tipo dos itens;
  - o que não cabe em tipo do BigQuery (objeto sempre vazio, campo sempre null,
    lista de listas, tipos em conflito) vira JSON, para guardar o valor como veio.

Uso: python3 gerar_schema.py <partidas.ndjson> <schema_bronze.json>
"""

import json
import sys


class Tipo:
    def __init__(self):
        self.escalares = set()  # BOOLEAN, INTEGER, FLOAT, STRING
        self.campos = None      # dict nome -> Tipo, quando é objeto
        self.item = None        # Tipo do item, quando é lista
        self.formas = set()     # "escalar", "objeto", "lista"
        self.lista_com_null = False

    def ver(self, valor):
        if valor is None:
            return
        if isinstance(valor, bool):
            self.formas.add("escalar")
            self.escalares.add("BOOLEAN")
        elif isinstance(valor, int):
            self.formas.add("escalar")
            self.escalares.add("INTEGER")
        elif isinstance(valor, float):
            self.formas.add("escalar")
            self.escalares.add("FLOAT")
        elif isinstance(valor, str):
            self.formas.add("escalar")
            self.escalares.add("STRING")
        elif isinstance(valor, dict):
            self.formas.add("objeto")
            if self.campos is None:
                self.campos = {}
            for nome, v in valor.items():
                self.campos.setdefault(nome, Tipo()).ver(v)
        elif isinstance(valor, list):
            self.formas.add("lista")
            if self.item is None:
                self.item = Tipo()
            for v in valor:
                if v is None:
                    self.lista_com_null = True
                self.item.ver(v)


def tipo_escalar(escalares):
    if escalares == {"INTEGER", "FLOAT"}:
        return "FLOAT"
    if len(escalares) == 1:
        return next(iter(escalares))
    return None


def campo(nome, t, modo="NULLABLE"):
    """Devolve o campo do schema. Lista vira REPEATED; o resto, NULLABLE."""
    if len(t.formas) != 1:
        return {"name": nome, "type": "JSON", "mode": modo}
    forma = next(iter(t.formas))

    if forma == "escalar":
        tipo = tipo_escalar(t.escalares)
        return {"name": nome, "type": tipo or "JSON", "mode": modo}

    if forma == "objeto":
        if not t.campos:
            return {"name": nome, "type": "JSON", "mode": modo}
        filhos = [campo(n, f) for n, f in t.campos.items()]
        return {"name": nome, "type": "RECORD", "mode": modo, "fields": filhos}

    # lista
    if modo == "REPEATED" or t.lista_com_null:
        # BigQuery não aceita lista de listas nem null dentro de lista.
        return {"name": nome, "type": "JSON", "mode": modo}
    if not t.item.formas:
        # Lista sempre vazia ou só com null: sem tipo de item.
        return {"name": nome, "type": "JSON", "mode": "NULLABLE"}
    item = campo(nome, t.item, modo="REPEATED")
    if item["type"] == "JSON":
        # Itens sem tipo comum: guarda a lista inteira como JSON.
        return {"name": nome, "type": "JSON", "mode": "NULLABLE"}
    return item


def main():
    if len(sys.argv) != 3:
        sys.exit("uso: python3 gerar_schema.py <partidas.ndjson> <schema_bronze.json>")
    raiz = Tipo()
    with open(sys.argv[1], encoding="utf-8") as f:
        for linha in f:
            raiz.ver(json.loads(linha))
    schema = [campo(n, t) for n, t in raiz.campos.items()]
    with open(sys.argv[2], "w", encoding="utf-8") as out:
        json.dump(schema, out, ensure_ascii=False, indent=2)
        out.write("\n")
    print(f"schema com {len(schema)} campos de topo -> {sys.argv[2]}")


if __name__ == "__main__":
    main()
