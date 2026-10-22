"""Ajustes pedidos pelo front: nomes de torneio, ordem das listas e nick mais recente."""
import json
import re
import unittest

import test_api as base
from app.database import carregar_sql

TORNEIOS = {
    "RUSH2": "Rush Series · Esquenta 2",
    "RUSHE": "Rush Series · Esquenta",
    "RUSH_INCLUSIVO": "Rush Series · Inclusivo",
    "UNIVAVA_C1": "Univavá · Classificatória 1",
    "UNIVAVA_C2": "Univavá · Classificatória 2",
    "UNIVAVA_C3": "Univavá · Classificatória 3",
    "UNIVAVA_C4": "Univavá · Classificatória 4",
    "UNIVAVA_G": "Univavá · Fase de grupos",
}


def compactar(sql):
    return re.sub(r"\s+", " ", sql)


class AjustesFrontTests(unittest.TestCase):
    setUp = base.ApiTests.setUp
    query_results = base.ApiTests.query_results
    assert_slots_available = base.ApiTests.assert_slots_available

    def parametros(self):
        params = self.bq.query.call_args.kwargs["job_config"].query_parameters
        return {p.name: p.value for p in params}

    # 1. Nomes amigáveis dos torneios
    def test_catalogos_envia_nomes_dos_torneios(self):
        self.query_results([base.row(torneios=[], mapas=[], agentes=[], armas=[], armaduras=[])])
        response = self.http.get("/api/stats/catalogos")
        self.assertEqual(response.status_code, 200)

        torneios = json.loads(self.parametros()["torneios_json"])
        self.assertEqual({t["id"]: t["nome"] for t in torneios}, TORNEIOS)

        sql = compactar(self.bq.query.call_args.args[0])
        self.assertIn("COALESCE(c.nome, t.id) AS nome", sql)
        self.assertNotIn("id, id AS nome", sql)
        self.assert_slots_available()

    def test_catalogos_preserva_nomes_vindos_da_consulta(self):
        torneios = [{"id": "UNIVAVA_G", "nome": TORNEIOS["UNIVAVA_G"]}]
        self.query_results([base.row(torneios=torneios, mapas=[], agentes=[], armas=[], armaduras=[])])
        data = self.http.get("/api/stats/catalogos").json()["data"]
        self.assertEqual(data["torneios"], torneios)

    # 2. Agentes e mapas por partidas, vitórias, nome e ID
    def test_jogador_ordena_agentes_e_mapas_por_partidas(self):
        agentes = [
            {"agente_id": "neon", "partidas": 12, "vitorias": 6, "taxa_vitoria_pct": 50.0, "nome": "Neon"},
            {"agente_id": "vyse", "partidas": 8, "vitorias": 6, "taxa_vitoria_pct": 75.0, "nome": "Vyse"},
        ]
        self.query_results([base.row(id="p1", nome="Kaytoh", times=[], resumo={}, agentes=agentes, mapas=[])])
        response = self.http.get("/api/stats/jogadores/p1")
        self.assertEqual(response.json()["data"]["agentes"], agentes)

        params = self.parametros()
        self.assertIn("Neon", params["agentes_json"])
        sql = compactar(self.bq.query.call_args.args[0])
        self.assertIn("ORDER BY a.partidas DESC, a.vitorias DESC, c.nome ASC NULLS LAST, a.agente_id", sql)
        self.assertIn("ORDER BY m.partidas DESC, m.vitorias DESC, c.nome ASC NULLS LAST, m.mapa_id", sql)
        self.assertNotIn("ORDER BY a.agente_id)", sql)

    def test_time_ordena_mapas_por_partidas(self):
        sql = compactar(carregar_sql("time_detalhe.sql"))
        self.assertIn("ORDER BY m.partidas DESC, m.vitorias DESC, c.nome ASC NULLS LAST, m.mapa_id", sql)
        self.assertIn("SELECT AS STRUCT m.*, c.nome", sql)

    # 3. Nick mais recente
    def test_ranking_filtrado_usa_nick_do_historico_inteiro(self):
        self.query_results([base.row(jogadores=[], total=0)])
        response = self.http.get("/api/stats/ranking?torneio_id=RUSH_INCLUSIVO")
        self.assertEqual(response.status_code, 200)

        sql = compactar(self.bq.query.call_args.args[0])
        # O nick não pode sair do recorte filtrado (base/totais).
        self.assertNotIn("ARRAY_AGG( STRUCT(nome, tag)", sql)
        self.assertIn("FROM `datropa.valorant.ranking_jogador`", sql)
        self.assertIn("LEFT JOIN identidades i ON i.jogador_id = t.jogador_id", sql)

    def test_partida_traz_nick_recente_e_nick_da_partida(self):
        jogadores = [{"jogador_id": "j1", "nome": "CAAP Meowolet", "nome_partida": "Mimikyu"}]
        self.query_results([base.row(id="m1", jogadores=jogadores, rounds=[])])
        data = self.http.get("/api/stats/partidas/m1").json()["data"]
        self.assertEqual(data["jogadores"], jogadores)

        sql = compactar(self.bq.query.call_args.args[0])
        self.assertIn("COALESCE(i.nome, s.nome) AS nome", sql)
        self.assertIn("s.nome AS nome_partida", sql)
        self.assertIn("FROM `datropa.valorant.ranking_jogador`", sql)


if __name__ == "__main__":
    unittest.main()
