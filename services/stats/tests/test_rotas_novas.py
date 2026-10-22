import unittest

import test_api as base
from app import cache


class RotasNovasTests(unittest.TestCase):
    setUp = base.ApiTests.setUp
    query_results = base.ApiTests.query_results
    assert_slots_available = base.ApiTests.assert_slots_available

    PREFIXO = "/api/stats"

    ROTAS = [
        "/times/t1",
        "/times/t1/economia",
        "/times/t1/pos-plant-retake",
        "/partidas",
        "/partidas/p1",
        "/partidas/p1/rounds/1/eventos",
        "/composicoes",
        "/comparacoes/times?time_a_id=t1&time_b_id=t2",
        "/mapas",
        "/mapas/ascent/calor?tipo=abate",
        "/agentes",
        "/busca?q=teste",
        "/catalogos",
    ]

    def test_parametros_invalidos_nao_consultam(self):
        caminhos = [
            "/busca?q=a",
            "/busca?q=%20%20",
            "/busca?q=teste&tipo=arma",
            "/busca?q=teste&q=outro",
            "/comparacoes/times?time_a_id=t1",
            "/comparacoes/times?time_a_id=t1&time_b_id=t1",
            "/partidas/p1?mapa_id=ascent",
            "/partidas/p1/rounds/0/eventos",
            "/partidas/p1/rounds/abc/eventos",
            "/mapas/ascent/calor",
            "/mapas/ascent/calor?tipo=defuse",
            "/catalogos?page=1",
            "/agentes?page_size=101",
            "/composicoes?page=0",
            "/times/t1/economia?data_inicio=2026-02-30",
            "/times/t1/pos-plant-retake"
            "?data_inicio=2026-06-22&data_fim=2026-06-20",
        ]

        for caminho in caminhos:
            with self.subTest(caminho=caminho):
                resposta = self.http.get(self.PREFIXO + caminho)
                self.assertEqual(resposta.status_code, 400)
                self.assertEqual(
                    resposta.json()["error"]["code"],
                    "INVALID_ARGUMENT",
                )

        self.client_factory.assert_not_called()

    def test_detalhes_inexistentes_liberam_vagas(self):
        caminhos = [
            "/times/inexistente",
            "/times/inexistente/economia",
            "/times/inexistente/pos-plant-retake",
            "/partidas/inexistente",
            "/partidas/p1/rounds/999/eventos",
            "/mapas/inexistente/calor?tipo=abate",
            "/comparacoes/times?time_a_id=t1&time_b_id=inexistente",
        ]

        for caminho in caminhos:
            with self.subTest(caminho=caminho):
                self.query_results([])
                resposta = self.http.get(self.PREFIXO + caminho)
                self.assertEqual(resposta.status_code, 404)
                self.assertEqual(
                    resposta.json()["error"]["code"],
                    "NOT_FOUND",
                )
                self.assert_slots_available()

        self.assertFalse(cache._cache)

    def test_listagens_vazias_preservam_total_e_cache(self):
        casos = [
            ("/partidas", "partidas"),
            ("/composicoes", "composicoes"),
            ("/mapas", "mapas"),
            ("/agentes", "agentes"),
            ("/busca?q=teste", "resultados"),
        ]

        for caminho, campo in casos:
            with self.subTest(caminho=caminho):
                self.bq.query.reset_mock()
                self.query_results([
                    base.row(**{campo: [], "total": 7})
                ])

                separador = "&" if "?" in caminho else "?"
                url = (
                    self.PREFIXO + caminho
                    + separador + "page=4&page_size=3"
                )

                resposta = self.http.get(url)
                self.assertEqual(resposta.status_code, 200)
                self.assertEqual(resposta.json()["data"], [])
                self.assertEqual(
                    resposta.json()["pagination"],
                    {"page": 4, "page_size": 3, "total": 7},
                )
                self.assertEqual(
                    self.http.get(url).json(),
                    resposta.json(),
                )
                self.assertEqual(self.bq.query.call_count, 1)

                config = self.bq.query.call_args.kwargs["job_config"]
                self.assertEqual(
                    config.maximum_bytes_billed, 1073741824
                )
                parametros = {
                    p.name: p.value for p in config.query_parameters
                }
                self.assertEqual(parametros["limite"], 3)
                self.assertEqual(parametros["deslocamento"], 9)
                self.assert_slots_available()

    def test_economia_e_pos_plant_preservam_nulos(self):
        economia = {
            "time_id": "t1",
            "categorias": [
                {
                    "tipo": tipo,
                    "rounds": 0,
                    "vitorias": 0,
                    "taxa_vitoria_pct": None,
                }
                for tipo in ("pistol", "eco", "force", "full")
            ],
            "classificacao_versao":
                "equipamento_time_10000_20000_pistol_v2",
            "rounds_sem_classificacao": 0,
        }

        pos_plant = {
            "time_id": "t1",
            "pos_plant": {
                "oportunidades": 0,
                "vitorias": 0,
                "taxa_sucesso_pct": None,
            },
            "retake": {
                "oportunidades": 0,
                "vitorias": 0,
                "taxa_sucesso_pct": None,
            },
        }

        for caminho, dados in [
            ("/times/t1/economia", economia),
            ("/times/t1/pos-plant-retake", pos_plant),
        ]:
            with self.subTest(caminho=caminho):
                self.bq.query.reset_mock()
                self.query_results([base.row(**dados)])
                url = self.PREFIXO + caminho

                resposta = self.http.get(url)
                self.assertEqual(resposta.status_code, 200)
                self.assertEqual(resposta.json()["data"], dados)
                self.assertEqual(
                    self.http.get(url).json(), resposta.json()
                )
                self.assertEqual(self.bq.query.call_count, 1)
                self.assert_slots_available()

    def test_eventos_preservam_snapshots_e_coordenadas(self):
        evento = {
            "id": "e1",
            "ordem": 1,
            "tipo": "defuse",
            "tempo_ms": 100000,
            "posicao": {"x": -3106.0, "y": -7114.0},
            "arma_id": None,
            "jogadores": [
                {
                    "jogador_id": "j1",
                    "time_id": "t1",
                    "agente_id": None,
                    "posicao": {"x": -3106.0, "y": -7114.0},
                }
            ],
        }

        dados = {
            "partida_id": "p1",
            "mapa_id": "ascent",
            "round": 5,
            "eventos": [evento],
        }

        self.query_results([base.row(**dados)])
        url = self.PREFIXO + "/partidas/p1/rounds/5/eventos"

        resposta = self.http.get(url)
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["data"], dados)
        self.assertEqual(self.http.get(url).json(), resposta.json())
        self.assertEqual(self.bq.query.call_count, 1)

        parametros = {
            p.name: p.value
            for p in self.bq.query.call_args.kwargs[
                "job_config"
            ].query_parameters
        }
        self.assertEqual(parametros["round"], 5)
        self.assert_slots_available()

    def test_calor_preserva_contadores_na_pagina_vazia(self):
        self.query_results([
            base.row(
                mapa_id="ascent",
                transformacao_disponivel=True,
                total=8,
                eventos_elegiveis=10,
                pontos_excluidos=2,
                pontos=[],
            )
        ])

        resposta = self.http.get(
            self.PREFIXO
            + "/mapas/ascent/calor?tipo=plant&page=4&page_size=3"
        )

        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        self.assertEqual(corpo["data"], [])
        self.assertEqual(corpo["pagination"]["total"], 8)
        self.assertEqual(corpo["meta"]["pontos_excluidos"], 2)
        self.assertEqual(
            corpo["meta"]["eventos_elegiveis"],
            corpo["pagination"]["total"]
            + corpo["meta"]["pontos_excluidos"],
        )
        self.assert_slots_available()

    def test_falhas_nas_rotas_nao_viram_dados_vazios(self):
        self.bq.query.side_effect = RuntimeError("Falha simulada")

        for caminho in self.ROTAS:
            with self.subTest(caminho=caminho):
                with self.assertLogs(level="ERROR"):
                    resposta = self.http.get(
                        self.PREFIXO + caminho
                    )

                self.assertEqual(resposta.status_code, 503)
                self.assertEqual(
                    resposta.json()["error"]["code"],
                    "DATA_UNAVAILABLE",
                )
                self.assertNotIn("data", resposta.json())
                self.assert_slots_available()

        self.assertFalse(cache._cache)

    def test_rotas_sem_vaga_nao_abrem_bigquery(self):
        for _ in range(4):
            self.assertTrue(
                base.database.CONSULTAS_SIMULTANEAS.acquire(
                    blocking=False
                )
            )

        try:
            for caminho in self.ROTAS:
                with self.subTest(caminho=caminho):
                    resposta = self.http.get(
                        self.PREFIXO + caminho
                    )
                    self.assertEqual(resposta.status_code, 503)
                    self.assertIn(
                        "Servidor ocupado",
                        resposta.json()["error"]["message"],
                    )

            self.client_factory.assert_not_called()
        finally:
            for _ in range(4):
                base.database.CONSULTAS_SIMULTANEAS.release()

        self.assert_slots_available()


if __name__ == "__main__":
    unittest.main()