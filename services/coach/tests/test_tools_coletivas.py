"""Tools coletivas, resumo, scouting e prancheta, com o BigQuery trocado por linhas falsas."""

import copy

import pytest

from coach import catalogos
from coach.bq import Consulta
from coach.tools import REGISTRO

JETT = catalogos.agente_id("Jett")
OMEN = catalogos.agente_id("Omen")
SOVA = catalogos.agente_id("Sova")
KJ = catalogos.agente_id("Killjoy")
RAZE = catalogos.agente_id("Raze")


@pytest.fixture
def bq(monkeypatch):
    """Troca Consulta.rodar por um dict nome_da_consulta -> linhas. Guarda as chamadas."""
    respostas: dict[str, list[dict]] = {}
    chamadas: list[tuple[str, dict]] = []

    def rodar(self, **valores):
        # Mesma checagem do _job_config: só os parâmetros declarados chegam no BigQuery.
        assert set(valores) == set(self.tipos), (self.nome, valores)
        chamadas.append((self.nome, valores))
        return copy.deepcopy(respostas.get(self.nome, []))

    monkeypatch.setattr(Consulta, "rodar", rodar)
    rodar.respostas, rodar.chamadas = respostas, chamadas
    return rodar


def executar(nome, **args):
    return REGISTRO[nome].executar(args)


def test_registro_tem_descricao_e_schema_coerente():
    for t in REGISTRO.values():
        assert len(t.descricao) > 80, t.nome
        props = t.parametros.get("properties", {})
        assert set(t.parametros.get("required", [])) <= set(props), t.nome
        assert all(p.get("description") for p in props.values()), t.nome


@pytest.mark.parametrize("nome,args", [
    ("economia_time", {"time_id": "t", "mapa": "Dust2"}),
    ("pos_plant_retake", {"time_id": "t", "mapa": "Dust2"}),
    ("composicoes", {"mapa": "Dust2"}),
    ("comparar_times", {"time_a_id": "a", "time_b_id": "b", "mapa": "Dust2"}),
    ("scouting_time", {"time_id": "t", "mapa": "Dust2"}),
    ("comparar_times", {"time_a_id": "a", "time_b_id": "a"}),
    ("resumo_partida", {}),
    ("abrir_na_prancheta", {"partida_id": "p", "round": 0}),
    ("abrir_na_prancheta", {"partida_id": "p", "round": "x"}),
])
def test_erros_sem_consulta(bq, nome, args):
    assert "erro" in executar(nome, **args)
    assert bq.chamadas == []


def _cat(categoria, lado, rounds, vitorias, total=False, todos_lados=False, partidas=3):
    return {"categoria": categoria, "lado": lado, "total": total, "todos_lados": todos_lados,
            "rounds": rounds, "vitorias": vitorias, "partidas": partidas, "rounds_com_alerta": 0,
            "classificacao_versao": "equipamento_time_10000_20000_pistol_v2"}


ECONOMIA = [
    _cat(None, None, 62, 33, total=True, todos_lados=True),
    _cat("full", None, 40, 25, todos_lados=True),
    _cat("pistol", None, 6, 4, todos_lados=True),
    _cat("eco", None, 14, 4, todos_lados=True),
    _cat(None, None, 2, 0, todos_lados=True),  # economia incompleta
    _cat("full", "ataque", 20, 15),
    _cat("eco", "defesa", 7, 1),
]


def test_economia_time(bq):
    bq.respostas["economia_time.por_categoria"] = ECONOMIA
    bq.respostas["economia_time.contra_adversario"] = [
        {"categoria": "full", "categoria_adversario": "eco", "rounds": 10, "vitorias": 9},
        {"categoria": "eco", "categoria_adversario": "full", "rounds": 8, "vitorias": 2},
    ]
    bq.respostas["economia_time.pos_pistol"] = [
        {"venceu_pistol": True, "rounds": 4, "vitorias": 3},
        {"venceu_pistol": False, "rounds": 2, "vitorias": 0},
    ]
    r = executar("economia_time", time_id="t", mapa="Lotus")
    assert "erro" not in r
    assert r["filtros"]["mapa"] == "Lotus"
    assert bq.chamadas[0][1] == {"time_id": "t", "mapa_id": "jam"}
    assert [c["categoria"] for c in r["por_categoria"]] == ["pistol", "eco", "full"]
    full = r["por_categoria"][2]
    assert full["taxa_vitoria_pct"] == 62.5 and full["pct_dos_rounds"] == round(100 * 40 / 62, 2)
    assert r["rounds_sem_classificacao"] == 2
    assert r["por_lado"][0] == {"lado": "ataque", "categoria": "full", "rounds": 20, "vitorias": 15,
                                "taxa_vitoria_pct": 75.0}
    assert r["contra_compra_adversario"][0]["compra_time"] == "eco"
    assert r["round_apos_pistol"]["apos_vencer_pistol"]["taxa_vitoria_pct"] == 75.0
    assert r["round_apos_pistol"]["apos_perder_pistol"]["taxa_vitoria_pct"] == 0.0


def test_economia_time_sem_rounds(bq):
    assert "erro" in executar("economia_time", time_id="nao-existe")


def _pp(mapa_id, geral, opp, vpp, ore, vre, alerta=0, partidas=2):
    return {"mapa_id": mapa_id, "geral": geral, "partidas": partidas,
            "pos_plant_oportunidades": opp, "pos_plant_vitorias": vpp,
            "retake_oportunidades": ore, "retake_vitorias": vre, "desarmes": vre,
            "vitorias_defesa_pos_plant_por_tempo": 0, "registros_com_alerta": alerta}


def test_pos_plant_retake(bq):
    bq.respostas["pos_plant_retake.totais"] = [
        _pp(None, True, 30, 21, 20, 6, partidas=4),
        _pp("ascent", False, 18, 15, 10, 3),
        _pp("jam", False, 12, 6, 10, 3, alerta=1),
    ]
    bq.respostas["pos_plant_retake.por_site"] = [
        {"mapa_id": "ascent", "lado": "ataque", "site": "A", "rounds": 6, "vitorias": 5},
        {"mapa_id": "ascent", "lado": "ataque", "site": "B", "rounds": 12, "vitorias": 10},
        {"mapa_id": "ascent", "lado": "ataque", "site": None, "rounds": 6, "vitorias": 1},
        {"mapa_id": "ascent", "lado": "defesa", "site": "A", "rounds": 10, "vitorias": 3},
        {"mapa_id": "ascent", "lado": "defesa", "site": None, "rounds": 14, "vitorias": 10},
    ]
    r = executar("pos_plant_retake", time_id="t")
    assert r["geral"]["pos_plant"] == {"oportunidades": 30, "vitorias": 21, "taxa_sucesso_pct": 70.0}
    assert r["geral"]["retake"]["taxa_sucesso_pct"] == 30.0
    ascent, lotus = r["por_mapa"]
    assert ascent["mapa"] == "Ascent" and lotus["mapa"] == "Lotus"
    ataque = ascent["plants_por_site"]["ataque"]
    assert ataque["rounds"] == 24 and ataque["rounds_com_plant"] == 18 and ataque["pct_rounds_com_plant"] == 75.0
    assert [s["site"] for s in ataque["sites"]] == ["B", "A"]
    # Registro com alerta: taxa indisponível, contagem preservada.
    assert lotus["pos_plant"]["taxa_sucesso_pct"] is None and lotus["pos_plant"]["oportunidades"] == 12
    assert lotus["plants_por_site"] == {}


def _comp(mapa_id, agentes, aparicoes, vitorias, times=1):
    return {"mapa_id": mapa_id, "composicao_id": f"composicao_{mapa_id}_{aparicoes}", "agente_ids": agentes,
            "aparicoes": aparicoes, "vitorias": vitorias, "derrotas": aparicoes - vitorias,
            "taxa_vitoria_pct": 100.0 * vitorias / aparicoes, "times": times,
            "aparicoes_no_recorte": 20, "composicoes_distintas": 4}


def test_composicoes(bq):
    bq.respostas["composicoes.agregado"] = [_comp("jam", [JETT, OMEN, SOVA, KJ, RAZE], 8, 5, times=3)]
    r = executar("composicoes", mapa="Lotus")
    assert bq.chamadas[0][1] == {"time_id": None, "mapa_id": "jam"}
    c = r["composicoes"][0]
    assert sorted(c["agentes"]) == ["Jett", "Killjoy", "Omen", "Raze", "Sova"]
    assert c["estrutura"] == {"Controlador": 1, "Duelista": 2, "Iniciador": 1, "Sentinela": 1}
    assert c["mapa"] == "Lotus" and c["taxa_vitoria_pct"] == 62.5 and c["times_que_usaram"] == 3
    assert r["aparicoes_no_recorte"] == 20 and r["composicoes_distintas"] == 4


def test_composicoes_vazio(bq):
    assert "erro" in executar("composicoes", time_id="t")


def _ind(time_id, nome, partidas, vitorias):
    return {"time_id": time_id, "nome": nome, "partidas": partidas, "vitorias": vitorias,
            "derrotas": partidas - vitorias, "empates": 0, "rounds_jogados": 100, "rounds_ganhos": 55,
            "rounds_ataque": 50, "vitorias_ataque": 30, "rounds_defesa": 50, "vitorias_defesa": 25,
            "alertas_time": 0, "pos_plant_oportunidades": 20, "pos_plant_vitorias": 15,
            "retake_oportunidades": 10, "retake_vitorias": 4, "alertas_pos_plant": 0,
            "kills": 300, "deaths": 250, "first_bloods": 52, "first_deaths": 48, "dano_total": 70000,
            "rounds_jogador": 500, "alertas_jogador": 0,
            "pistols": 8, "pistols_vencidos": 4, "ecos": 10, "ecos_vencidos": 2,
            "forces": 20, "forces_vencidos": 8, "fulls": 62, "fulls_vencidos": 40}


def test_comparar_times(bq):
    bq.respostas["comparar_times.indicadores"] = [_ind("a", "Time A", 4, 3), _ind("b", "Time B", 4, 1)]
    bq.respostas["comparar_times.por_mapa"] = [
        {"time_id": "a", "mapa_id": "jam", "partidas": 2, "vitorias": 2, "rounds_jogados": 40, "rounds_ganhos": 26},
        {"time_id": "b", "mapa_id": "jam", "partidas": 1, "vitorias": 0, "rounds_jogados": 20, "rounds_ganhos": 8},
        {"time_id": "a", "mapa_id": "ascent", "partidas": 2, "vitorias": 1, "rounds_jogados": 40, "rounds_ganhos": 20},
    ]
    bq.respostas["comparar_times.confrontos"] = [
        {"partida_id": "p1", "torneio_id": "T", "mapa_id": "jam", "data_partida_utc": "2026-07-25",
         "placar": 13, "placar_adversario": 8, "venceu": True, "empate": False,
         "total": 1, "vitorias_a": 1, "vitorias_b": 0, "empates": 0},
    ]
    r = executar("comparar_times", time_a_id="a", time_b_id="b")
    a, b = r["time_a"], r["time_b"]
    assert a["time"] == "Time A" and a["taxa_vitoria_pct"] == 75.0 and b["taxa_vitoria_pct"] == 25.0
    assert a["kd_time"] == 1.2 and a["adr_medio_jogador"] == 140.0 and a["taxa_first_blood_pct"] == 52.0
    assert a["pos_plant_taxa_pct"] == 75.0 and a["full_taxa_pct"] == round(100 * 40 / 62, 2)
    assert r["por_mapa"][0]["mapa"] == "Lotus" and r["por_mapa"][0]["time_b"]["partidas"] == 1
    assert r["por_mapa"][1]["time_b"] is None
    d = r["confrontos_diretos"]
    assert d["partidas"] == 1 and d["vitorias_time_a"] == 1 and d["ultimas"][0]["vencedor"] == "Time A"
    assert d["ultimas"][0]["partida_id"] == "p1"


def test_comparar_times_sem_partidas(bq):
    bq.respostas["comparar_times.indicadores"] = [_ind("a", "Time A", 4, 3)]
    r = executar("comparar_times", time_a_id="a", time_b_id="b")
    assert "time_b" in r["erro"]


PARTIDA = {"partida_id": "p1", "torneio_id": "UNIVAVA_C2", "mapa_id": "jam", "data_partida_utc": "2026-07-25",
           "inicio": None, "duracao_ms": 2478000, "rounds_jogados": 4, "time_a_id": "a", "time_a_nome": "Time A",
           "time_b_id": "b", "time_b_nome": "Time B", "placar_a": 3, "placar_b": 1, "vencedor_id": "a",
           "status_qualidade": "ok"}

JOGADORES = [
    {"jogador_id": "j1", "nome": "Ana", "tag": "BR1", "time_id": "a", "agente_id": JETT, "rounds": 4, "score": 1000,
     "kills": 8, "deaths": 2, "assists": 1, "kd": 4.0, "adr": 200.0, "hs_pct": 30.0, "first_bloods": 2,
     "first_deaths": 0},
    {"jogador_id": "j2", "nome": "Bia", "tag": None, "time_id": "b", "agente_id": OMEN, "rounds": 4, "score": 600,
     "kills": 3, "deaths": 6, "assists": 2, "kd": 0.5, "adr": 90.0, "hs_pct": None, "first_bloods": 1,
     "first_deaths": 2},
]


def _round(n, vencedor, atacante, compra_ataque, compra_defesa, site=None):
    defensor = "b" if atacante == "a" else "a"
    return {"round": n, "vencedor_id": vencedor, "atacante_id": atacante, "defensor_id": defensor,
            "lado_vencedor": "ataque" if vencedor == atacante else "defesa", "resultado": "eliminacao",
            "plant_site": site, "round_atipico": False, "compra_ataque": compra_ataque, "compra_defesa": compra_defesa}


def test_resumo_partida_por_time(bq):
    bq.respostas["resumo_partida.buscar"] = [
        {"partida_id": "p1", "torneio_id": "T", "mapa_id": "jam", "data_partida_utc": "2026-07-25",
         "adversario": "Time B", "placar": 3, "placar_adversario": 1, "venceu": True},
        {"partida_id": "p0", "torneio_id": "T", "mapa_id": "ascent", "data_partida_utc": "2026-07-20",
         "adversario": "Time B", "placar": 5, "placar_adversario": 13, "venceu": False},
    ]
    bq.respostas["resumo_partida.partida"] = [PARTIDA]
    bq.respostas["resumo_partida.jogadores"] = JOGADORES
    bq.respostas["resumo_partida.rounds"] = [
        _round(1, "b", "a", "pistol", "pistol"),
        _round(2, "a", "a", "eco", "full", site="A"),
        _round(3, "a", "a", "full", "eco"),
        _round(13, "a", "b", "pistol", "pistol"),
    ]
    r = executar("resumo_partida", time_id="a", adversario_id="b", mapa="Lotus")
    assert bq.chamadas[0] == ("resumo_partida.buscar", {"time_id": "a", "adversario_id": "b", "mapa_id": "jam"})
    assert r["partida_id"] == "p1" and r["mapa"] == "Lotus" and r["vencedor"] == "Time A"
    assert r["placar"] == {"Time A": 3, "Time B": 1}
    assert r["placar_no_intervalo"] == {"Time A": 2, "Time B": 1}
    assert r["maior_sequencia_de_rounds"] == {"Time A": 3, "Time B": 1}
    assert r["mvp"] is None
    assert r["destaques"]["maior_acs"] == {"jogador": "Ana#BR1", "time": "Time A", "acs": 250.0}
    assert r["destaques"]["vitorias_com_compra_inferior"] == [
        {"round": 2, "vencedor": "Time A", "compra_vencedor": "eco", "compra_perdedor": "full"}]
    assert r["jogadores"][1]["jogador"] == "Bia" and r["jogadores"][1]["agente"] == "Omen"
    assert r["rounds"][1]["compras"] == {"Time A": "eco", "Time B": "full"}
    assert r["outras_partidas"][0]["partida_id"] == "p0" and r["outras_partidas"][0]["mapa"] == "Ascent"
    assert "mapa_id" not in r["outras_partidas"][0]
    assert r["duracao_min"] == 41.3


def test_resumo_partida_inexistente(bq):
    assert "erro" in executar("resumo_partida", partida_id="nao-existe")
    assert "erro" in executar("resumo_partida", time_id="sem-partidas")


ROUND = {"partida_id": "p1", "mapa_id": "jam", "rounds_jogados": 21, "time_a_id": "a", "time_a_nome": "Time A",
         "time_b_id": "b", "time_b_nome": "Time B", "round": 3, "vencedor_id": "a", "atacante_id": "b",
         "defensor_id": "a", "resultado": "desarme", "plant_site": "C", "round_atipico": False,
         "transformacao_json": '{"u_x":0.0,"u_y":0.000072,"u_offset":0.454789,"v_x":-0.000072,"v_y":0.0,'
                               '"v_offset":0.917752}',
         "status_calibracao": "validada"}


def _evento(ordem, tipo, ator, vitima=None, dano="Weapon", site=None, self_kill=False):
    return {"id": f"evento_{ordem}", "ordem": ordem, "tipo": tipo, "tempo_ms": 12166 * ordem, "ator_id": ator,
            "vitima_id": vitima, "assistente_ids": [], "arma_id": None, "dano_final_tipo": dano, "site": site,
            "posicao": {"x": 5018.37, "y": 560.61},
            "jogadores": [{"jogador_id": "j1", "posicao": {"x": 1.4, "y": -2.6}},
                          {"jogador_id": "j2", "posicao": None}],
            "self_kill": self_kill, "fogo_amigo": False, "abate_adversario": tipo == "abate" and not self_kill,
            "status_qualidade": "ok"}


def test_abrir_na_prancheta(bq):
    bq.respostas["abrir_na_prancheta.round"] = [ROUND]
    bq.respostas["resumo_partida.jogadores"] = JOGADORES
    bq.respostas["abrir_na_prancheta.eventos"] = [
        _evento(1, "abate", "j2", "j1"),
        _evento(2, "plant", "j2", site="C", dano=None),
        _evento(3, "abate", "j2", "j2", dano="Bomb", self_kill=True),
        _evento(4, "defuse", "j1", dano=None),
    ]
    r = executar("abrir_na_prancheta", partida_id="p1", round=3.0)
    assert bq.chamadas[0][1] == {"partida_id": "p1", "round": 3}
    assert r["prancheta"]["url"] == "/prancheta?partida_id=p1&round=3"
    assert r["prancheta"]["url_completa"].endswith("/prancheta?partida_id=p1&round=3")
    assert "a confirmar" in r["prancheta"]["contrato"]
    assert r["ataque"] == "Time B" and r["defesa"] == "Time A" and r["vencedor"] == "Time A"
    assert r["transformacao_mapa"]["u_y"] == 0.000072  # sem o arredondamento de bq._limpar
    lados = {j["jogador"]: j["lado"] for j in r["jogadores"]}
    assert lados == {"Ana#BR1": "defesa", "Bia": "ataque"}
    e1, e2, e3, e4 = r["eventos"]
    assert e1["tempo"] == "0:12" and e1["descricao"] == "Bia (Omen, Time B) abateu Ana#BR1 (Jett, Time A)"
    assert e1["posicao"] == {"x": 5018, "y": 561}
    assert e1["jogadores"] == [{"jogador_id": "j1", "posicao": {"x": 1, "y": -3}},
                               {"jogador_id": "j2", "posicao": None}]
    assert e2["descricao"] == "Bia (Omen, Time B) plantou a spike no site C"
    assert e3["descricao"] == "Bia (Omen, Time B): morte pela spike"
    assert e4["descricao"] == "Ana#BR1 (Jett, Time A) desarmou a spike"


def test_abrir_na_prancheta_link_escapa_id():
    from coach.tools.abrir_na_prancheta import link_prancheta
    assert link_prancheta("a b&c", 2)["url"] == "/prancheta?partida_id=a+b%26c&round=2"


def test_abrir_na_prancheta_round_inexistente(bq):
    bq.respostas["abrir_na_prancheta.round"] = [{**ROUND, "round": None}]
    r = executar("abrir_na_prancheta", partida_id="p1", round=30)
    assert "21 rounds" in r["erro"]


def test_abrir_na_prancheta_partida_inexistente(bq):
    assert "não encontrada" in executar("abrir_na_prancheta", partida_id="x", round=1)["erro"]


def test_scouting_time(bq):
    resumo_geral = {"escopo": "geral", "nome": "Time A", "mapa_id": None, "partidas": 4, "vitorias": 3,
                    "derrotas": 1, "empates": 0, "taxa_vitoria_pct": 75.0, "taxa_rounds_pct": 55.0,
                    "taxa_ataque_pct": 61.0, "taxa_defesa_pct": 50.0}
    resumo_mapa = {**resumo_geral, "escopo": "mapa", "mapa_id": "jam", "partidas": 2, "taxa_ataque_pct": 52.0,
                   "taxa_defesa_pct": 50.0}
    bq.respostas["stats_time.resumo"] = [resumo_geral, resumo_mapa]
    bq.respostas["stats_time.elenco"] = [
        {"jogador_id": "j1", "identidade": {"nome": "Ana", "tag": "BR1"}, "partidas": 4, "kd": 1.5, "adr": 150.0,
         "first_bloods": 10, "first_deaths": 5, "agente_principal_id": JETT},
    ]
    bq.respostas["composicoes.agregado"] = [_comp("jam", [JETT, OMEN, SOVA, KJ, RAZE], 2, 2)]
    bq.respostas["economia_time.por_categoria"] = ECONOMIA
    bq.respostas["pos_plant_retake.totais"] = [_pp(None, True, 30, 21, 20, 6), _pp("jam", False, 10, 5, 8, 2)]
    bq.respostas["pos_plant_retake.por_site"] = [
        {"mapa_id": "jam", "lado": "ataque", "site": "A", "rounds": 5, "vitorias": 3},
        {"mapa_id": "jam", "lado": "ataque", "site": "C", "rounds": 5, "vitorias": 2},
        {"mapa_id": "jam", "lado": "ataque", "site": None, "rounds": 10, "vitorias": 4},
    ]
    r = executar("scouting_time", time_id="a")
    assert r["time"] == "Time A" and r["geral"]["lado_forte"] == "ataque"
    lotus = r["mapas"][0]
    assert lotus["mapa"] == "Lotus" and lotus["lado_forte"] == "equilibrado"
    assert lotus["composicao_mais_usada"]["estrutura"]["Duelista"] == 2
    assert lotus["pos_plant_taxa_pct"] == 50.0 and lotus["retake_taxa_pct"] == 25.0
    assert lotus["site_preferido_ataque"] == {"site": "A", "plants": 5, "pct_dos_plants": 50.0,
                                              "empatado_com": ["C"]}
    assert lotus["pct_rounds_ataque_com_plant"] == 50.0
    assert r["economia"]["por_categoria"][0]["categoria"] == "pistol"
    assert r["pos_plant_retake"]["pos_plant_taxa_pct"] == 70.0
    assert r["jogadores"][0]["jogador"] == "Ana#BR1" and r["jogadores"][0]["agente_principal"] == "Jett"
    assert r["amostra_pequena"] is False
    usadas = {n for n, _ in bq.chamadas}
    assert usadas == {"stats_time.resumo", "stats_time.elenco", "composicoes.agregado",
                      "economia_time.por_categoria", "pos_plant_retake.totais", "pos_plant_retake.por_site"}


def test_scouting_time_inexistente(bq):
    assert "não encontrado" in executar("scouting_time", time_id="x")["erro"]
