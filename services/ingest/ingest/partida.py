"""Monta a linha do bronze a partir de um JSON de partida.

Usado pelo serviço (evento do bucket) e pela carga manual (`carga_manual/gerar_ndjson.py`).
Só biblioteca padrão: a carga manual roda com `python3` puro.

Uma linha por arquivo (um mapa). O JSON vai intacto, com dois campos a mais:
  _arquivo  nome do arquivo (é onde estão os times e o placar)
  _pasta    subpasta do torneio, ex. "Univavá/Classificatória 1"
"""

from __future__ import annotations

import json
import posixpath
import unicodedata


class PartidaInvalida(ValueError):
    """O arquivo não é uma partida que dá para carregar. Tentar de novo não resolve."""


def nfc(texto: str) -> str:
    # O macOS pode devolver nome com acento decomposto. NFC deixa a busca por texto previsível.
    return unicodedata.normalize("NFC", texto)


def arquivo_e_pasta(caminho_relativo: str) -> tuple[str, str]:
    """`"Univavá/Classificatória 1/X.json"` -> `("X.json", "Univavá/Classificatória 1")`.

    O caminho é relativo à raiz da base (`data/raw` na carga manual, `partidas/` no bucket),
    sempre com `/`.
    """
    pasta, arquivo = posixpath.split(caminho_relativo.strip("/"))
    return nfc(arquivo), nfc(pasta)


def montar_linha(partida, arquivo: str, pasta: str) -> dict:
    """Devolve a partida com `_arquivo` e `_pasta`. Não altera o resto do JSON."""
    if not isinstance(partida, dict):
        raise PartidaInvalida("esperava um objeto JSON")
    partida["_arquivo"] = nfc(arquivo)
    partida["_pasta"] = nfc(pasta)
    return partida


def ler_partida(conteudo: bytes | str, arquivo: str, pasta: str) -> dict:
    """Lê o JSON e devolve a linha do bronze. Levanta `PartidaInvalida` se não der."""
    try:
        partida = json.loads(conteudo)
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise PartidaInvalida(f"JSON inválido: {e}") from None
    return montar_linha(partida, arquivo, pasta)


def linha_ndjson(linha: dict) -> str:
    """Uma linha de NDJSON, sem a quebra no fim."""
    return json.dumps(linha, ensure_ascii=False, separators=(",", ":"))
