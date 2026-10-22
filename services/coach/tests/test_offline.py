"""Testes que não tocam no GCP."""

import importlib

import pytest

from coach import catalogos, config
from coach.bq import CONSULTAS
from coach.tools import REGISTRO


def test_tools_ligadas():
    assert set(REGISTRO) == {
        "buscar_entidade", "stats_jogador", "stats_time",
        "comparar_times", "economia_time", "pos_plant_retake", "composicoes",
        "resumo_partida", "scouting_time", "abrir_na_prancheta",
        "ranking_jogadores", "ranking_times",
    }
    assert "consulta_livre" not in REGISTRO


@pytest.mark.parametrize("nome", list(CONSULTAS))
def test_consultas_so_select_e_parametrizadas(nome):
    c = CONSULTAS[nome]
    sql = c.texto()
    assert sql.split(None, 1)[0].upper() in ("SELECT", "WITH")
    for proibido in ("INSERT", "UPDATE", "DELETE", "MERGE", "DROP", "CREATE", "ALTER"):
        assert f"{proibido} " not in sql.upper()
    for parametro in c.tipos:
        assert f"@{parametro}" in sql
    assert set(c.exemplo) == set(c.tipos)


def test_parametros_errados_nao_chegam_no_bq():
    c = CONSULTAS["stats_time.resumo"]
    with pytest.raises(ValueError):
        c._job_config({"time_id": "x"}, dry_run=True)
    with pytest.raises(ValueError):
        c._job_config({"time_id": "x", "mapa_id": None, "sql": "DROP"}, dry_run=True)
    job = c._job_config({"time_id": "x", "mapa_id": None}, dry_run=True)
    assert job.maximum_bytes_billed == config.MAX_BYTES_BILLED


def test_tool_rejeita_argumento_desconhecido():
    r = REGISTRO["stats_time"].executar({"time_id": "x", "sql": "SELECT 1"})
    assert "erro" in r
    r = REGISTRO["stats_jogador"].executar({})
    assert "erro" in r


def test_mapa_e_agente_invalidos_viram_erro_sem_consulta():
    assert "erro" in REGISTRO["stats_time"].executar({"time_id": "x", "mapa": "Dust2"})
    assert "erro" in REGISTRO["stats_jogador"].executar({"jogador_id": "x", "agente": "Tracer"})


def test_tabela_configuravel(monkeypatch):
    monkeypatch.setenv("COACH_GOLD_PREFIXO", "chico_teste_")
    monkeypatch.setenv("COACH_TABELA_STATS_TIME", "outra_stats_time")
    cfg = importlib.reload(config)
    try:
        assert cfg.tabela("ranking_jogador") == "`datropa.valorant.chico_teste_ranking_jogador`"
        assert cfg.tabela("stats_time") == "`datropa.valorant.outra_stats_time`"
        monkeypatch.setenv("COACH_TABELA_STATS_TIME", "x`; DROP TABLE y; --")
        with pytest.raises(ValueError):
            cfg.tabela("stats_time")
    finally:
        monkeypatch.delenv("COACH_GOLD_PREFIXO")
        monkeypatch.delenv("COACH_TABELA_STATS_TIME")
        importlib.reload(config)


def test_catalogos():
    assert catalogos.mapa_id("Lotus") == "jam"
    assert catalogos.mapa_id("jam") == "jam"
    assert catalogos.mapa_id("dust2") is None
    assert catalogos.nome_mapa("bonsai") == "Split"
    jett = catalogos.agente_id("jett")
    assert catalogos.nome_agente(jett) == "Jett"
    assert catalogos.agente_id("kayo") == catalogos.agente_id("KAY/O")
    assert catalogos.nome_agente("uuid-desconhecido") == "uuid-desconhecido"
    assert catalogos.normalizar("  Ufmt_Turuna  São ") == "ufmt turuna sao"
