"""Perguntas reais contra o Vertex AI e a gold. Gasta BigQuery e Gemini.

    COACH_TESTE_REAL=1 uv run pytest tests/test_perguntas.py -s

Confere que o agente chamou as tools certas, sem erro, e que todo número da
resposta aparece no resultado das tools (a regra de não inventar).
"""

import json
import os
import re

import pytest

pytestmark = pytest.mark.skipif(
    os.environ.get("COACH_TESTE_REAL") != "1", reason="defina COACH_TESTE_REAL=1 para rodar"
)

PERGUNTAS = [
    ("Como joga o time Turuna?", {"buscar_entidade", "stats_time"}),
    ("Quem é o melhor jogador da Azure Bears Golden?", {"buscar_entidade", "stats_time"}),
    ("Em qual mapa a CEUB Octopus Vulgaris vai melhor e em qual sofre mais?", {"buscar_entidade", "stats_time"}),
    ("Qual o melhor jogador da UFMT Turuna? Me mostra os números dele de Jett.", {"buscar_entidade", "stats_jogador"}),
    ("Compara a UFMT Turuna com a Unicamp Tritons Black.", {"buscar_entidade", "comparar_times"}),
    ("Como a UFMT Turuna se sai nos rounds de eco e de force?", {"buscar_entidade", "economia_time"}),
    ("A Unicamp Tritons Black converte bem depois de plantar? E no retake?", {"buscar_entidade", "pos_plant_retake"}),
    ("Qual composição mais ganha em Lotus?", {"composicoes"}),
    ("Quero estudar a Unicamp Tritons Black para o próximo jogo. Como eles jogam?",
     {"buscar_entidade", "scouting_time"}),
    ("Resume o último jogo da UFMT Turuna contra a Unicamp Tritons Black.", {"buscar_entidade", "resumo_partida"}),
    ("Abre na prancheta o round 3 do jogo da UFMT Turuna contra a Unicamp Tritons Black.",
     {"buscar_entidade", "resumo_partida", "abrir_na_prancheta"}),
]

_NUM = re.compile(r"(?<![\w.,])\d+(?:[.,]\d+)?")


def _numeros(obj, saida: set[float]):
    if isinstance(obj, bool) or obj is None:
        return
    if isinstance(obj, (int, float)):
        saida.add(float(obj))
    elif isinstance(obj, dict):
        for v in obj.values():
            _numeros(v, saida)
    elif isinstance(obj, list):
        saida.add(float(len(obj)))
        for v in obj:
            _numeros(v, saida)
    elif isinstance(obj, str):
        for m in _NUM.findall(obj):
            saida.add(float(m.replace(",", ".")))


def numeros_sem_fonte(texto: str, resultados: list[dict]) -> list[str]:
    fonte: set[float] = set()
    for r in resultados:
        _numeros(r, fonte)
    sem_fonte = []
    for bruto in _NUM.findall(texto):
        n = float(bruto.replace(",", "."))
        if n <= 5 and n.is_integer():  # "top 3", "5 últimas": contagem trivial
            continue
        casas = len(bruto.replace(",", ".").split(".")[1]) if "." in bruto or "," in bruto else 0
        if not any(round(f, casas) == n or round(f) == n for f in fonte):
            sem_fonte.append(bruto)
    return sem_fonte


@pytest.mark.parametrize("pergunta,tools_esperadas", PERGUNTAS)
def test_pergunta(pergunta, tools_esperadas):
    from coach.agente import perguntar

    resp = perguntar(pergunta)
    print(f"\n### {pergunta}")
    for c in resp.chamadas:
        print(f"  [tool] {c.nome}({json.dumps(c.argumentos, ensure_ascii=False)})")
    print(resp.texto)

    usadas = {c.nome for c in resp.chamadas}
    assert tools_esperadas <= usadas, f"tools usadas: {usadas}"
    assert not [c for c in resp.chamadas if c.nome != "buscar_entidade" and "erro" in c.resultado]
    assert resp.texto
    assert re.search(r"\d", resp.texto), "a resposta não cita nenhum número"
    sem_fonte = numeros_sem_fonte(resp.texto, [c.resultado for c in resp.chamadas])
    assert not sem_fonte, f"números sem fonte nas tools: {sem_fonte}"
