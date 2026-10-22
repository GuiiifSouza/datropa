"""Perguntas reais contra o Vertex AI e a gold. Gasta BigQuery e Gemini.

    COACH_TESTE_REAL=1 uv run pytest tests/test_perguntas.py -s

Confere que o agente chamou as tools certas, sem erro, e que todo número da
resposta aparece no resultado das tools (a regra de não inventar).
"""

import functools
import json
import os
import re

import pytest

pytestmark = pytest.mark.skipif(
    os.environ.get("COACH_TESTE_REAL") != "1", reason="defina COACH_TESTE_REAL=1 para rodar"
)

# Ids reais da gold gold_336_v1, usados no prefixo que a tela do front manda (Coach.tsx).
# O jogador sai da gold na hora ({JOGADOR_ID}, {JOGADOR}): o repo é público e não guarda nick de jogador.
WOLF_GAMING = "time_f613d8d5755a4046b6a7c6dcb116a5e51ebc4c53fa42c9fb2bdfb73b22f46cfb"
SPLIT_MACKLOGIC_WOLF = "a8065391-13ad-43b6-b56d-c7f637544b49"

# As 10 primeiras são as perguntas da demo (sugestões da tela do coach, PERGUNTAS_DEMO.md).
PERGUNTAS = [
    ("Quem foi o melhor jogador da fase de grupos do Univavá?", {"ranking_jogadores"}),
    ("Qual time converte melhor depois de plantar a spike?", {"ranking_times"}),
    ("[Contexto da tela: jogador {JOGADOR_ID} ({JOGADOR})] Em qual agente o {JOGADOR} rende mais?",
     {"stats_jogador"}),
    (f"[Contexto da tela: time {WOLF_GAMING} (Wolf Gaming)] Faz um scouting do Wolf Gaming: mapas, lado forte, "
     "composição e jogadores-chave.", {"scouting_time"}),
    ("Macklogic Red ou Azure Bears Golden: quem está melhor?", {"buscar_entidade", "comparar_times"}),
    ("Como o Wolf Gaming se sai nos rounds de force?", {"buscar_entidade", "economia_time"}),
    ("Quem segura melhor depois de plantar a spike: Minerva Thunders ou UFMT Turuna?",
     [{"buscar_entidade", "pos_plant_retake"}, {"buscar_entidade", "comparar_times"}]),
    ("Qual composição mais ganha em Lotus?", {"composicoes"}),
    ("Me conta como foi o Split entre Macklogic Red e Wolf Gaming.", {"buscar_entidade", "resumo_partida"}),
    (f"[Contexto da tela: partida {SPLIT_MACKLOGIC_WOLF} (Split · Wolf Gaming x Macklogic Red)] Qual foi o round "
     "que decidiu esse mapa? Abre ele na prancheta.", {"abrir_na_prancheta"}),
    # Cobertura das tools que a demo não usa.
    ("Em qual mapa a CEUB Octopus Vulgaris vai melhor e em qual sofre mais?", {"buscar_entidade", "stats_time"}),
    ("Qual o melhor jogador da UFMT Turuna? Me mostra os números dele de Jett.",
     [{"buscar_entidade", "stats_jogador", "stats_time"}, {"buscar_entidade", "stats_jogador", "ranking_jogadores"}]),
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
        # A tool já arredonda para 2 casas (61,848 vira 61,85); o modelo pode arredondar o valor
        # real para 1 casa (61,8). Aceita até meia unidade da casa citada mais esse 0,005.
        folga = 0.5 * 10 ** -casas + 0.005 + 1e-9
        if not any(abs(f - n) <= folga or round(f) == n for f in fonte):
            sem_fonte.append(bruto)
    return sem_fonte


@functools.lru_cache(maxsize=1)
def _jogador() -> dict:
    """1º por ACS na fase de grupos do Univavá (o mesmo da pergunta 1)."""
    from coach.tools import REGISTRO

    r = REGISTRO["ranking_jogadores"].executar({"ordenar_por": "acs", "torneio": "UNIVAVA_G", "limite": 1})
    return r["ranking"][0]


@pytest.mark.parametrize("pergunta,tools_esperadas", PERGUNTAS)
def test_pergunta(pergunta, tools_esperadas):
    from coach.agente import perguntar

    if "{JOGADOR" in pergunta:
        j = _jogador()
        pergunta = pergunta.replace("{JOGADOR_ID}", j["jogador_id"]).replace("{JOGADOR}", j["jogador"])

    resp = perguntar(pergunta)
    print(f"\n### {pergunta}")
    for c in resp.chamadas:
        print(f"  [tool] {c.nome}({json.dumps(c.argumentos, ensure_ascii=False)})")
    print(resp.texto)

    usadas = {c.nome for c in resp.chamadas}
    alternativas = tools_esperadas if isinstance(tools_esperadas, list) else [tools_esperadas]
    assert any(a <= usadas for a in alternativas), f"tools usadas: {usadas}"
    assert not [c for c in resp.chamadas if c.nome != "buscar_entidade" and "erro" in c.resultado]
    assert resp.texto
    assert re.search(r"\d", resp.texto), "a resposta não cita nenhum número"
    sem_fonte = numeros_sem_fonte(resp.texto, [c.resultado for c in resp.chamadas])
    assert not sem_fonte, f"números sem fonte nas tools: {sem_fonte}"
