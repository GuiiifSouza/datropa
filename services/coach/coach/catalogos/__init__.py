"""Tradução de nomes: mapa (codinome interno) e agente (UUID).

agentes.json é cópia do catálogo do gugu (branch data/gugu-catalogos-uuid,
services/stats/data/agentes.json). UUID sem entrada no catálogo fica como veio.
"""

from __future__ import annotations

import json
import unicodedata
from functools import lru_cache
from pathlib import Path

# mapa_id da gold (codinome em minúsculas) -> nome público. Fonte: docs/dados.md.
MAPAS = {
    "ascent": "Ascent",
    "bonsai": "Split",
    "triad": "Haven",
    "jam": "Lotus",
    "foxtrot": "Breeze",
    "canyon": "Fracture",
    "pitt": "Pearl",
    "juliett": "Sunset",
    "plummet": "Summit",
    "infinity": "Abyss",
}


def normalizar(texto: str) -> str:
    """Minúsculas, sem acento, `_` vira espaço, espaços colapsados."""
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return " ".join(texto.lower().replace("_", " ").split())


def nome_mapa(mapa_id: str | None) -> str | None:
    if mapa_id is None:
        return None
    return MAPAS.get(mapa_id.lower(), mapa_id)


def mapa_id(texto: str | None) -> str | None:
    """Aceita nome público ou codinome. Devolve None se não for um mapa conhecido."""
    if not texto:
        return None
    n = normalizar(texto)
    for codinome, publico in MAPAS.items():
        if n in (codinome, normalizar(publico)):
            return codinome
    return None


@lru_cache(maxsize=1)
def _agentes() -> dict[str, dict]:
    dados = json.loads((Path(__file__).parent / "agentes.json").read_text(encoding="utf-8"))
    return {a["uuid"].lower(): a for a in dados}


def nome_agente(uuid: str | None) -> str | None:
    if uuid is None:
        return None
    a = _agentes().get(uuid.lower())
    return a["nome"] if a else uuid


def classe_agente(uuid: str | None) -> str | None:
    a = _agentes().get((uuid or "").lower())
    return a["classe"] if a else None


def agente_id(texto: str | None) -> str | None:
    """Aceita nome do agente ou UUID. Devolve None se não reconhecer."""
    if not texto:
        return None
    n = normalizar(texto)
    if n in _agentes():
        return n
    for uuid, a in _agentes().items():
        if normalizar(a["nome"]).replace("/", "") == n.replace("/", ""):
            return uuid
    return None
