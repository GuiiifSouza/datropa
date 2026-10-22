"""Filtros HTTP e semântica do recorte SQL com dados sintéticos, sem GCP."""
import sqlite3
import unittest
from pathlib import Path

import test_api as base


class CalorCanvasHttpTests(unittest.TestCase):
    setUp = base.ApiTests.setUp
    query_results = base.ApiTests.query_results

    def test_invalidos_nao_consultam(self):
        for filtro in (
            "lado=red", "compra=buy", "tempo_inicio_ms=-1",
            "tempo_fim_ms=abc", "tempo_inicio_ms=10&tempo_fim_ms=10",
            "tempo_inicio_ms=20&tempo_fim_ms=10",
            "tempo_inicio_ms=9223372036854775808", "lado=ataque&lado=defesa",
        ):
            with self.subTest(filtro=filtro):
                res = self.http.get("/api/stats/mapas/ascent/calor?tipo=morte&" + filtro)
                self.assertEqual(res.status_code, 400)
        self.client_factory.assert_not_called()

    def test_parametros_contexto_e_chaves_distintas(self):
        ponto = dict(
            partida_id="p1", round=1, evento_id="e1", x=10.0, y=20.0,
            peso=1, tempo_ms=25000, time_id="def", jogador_id="vitima",
            lado="defesa", compra=None,
        )
        resultado = base.row(
            pontos=[ponto], total=1, eventos_elegiveis=1,
            pontos_excluidos=0, transformacao_disponivel=True,
        )
        urls = [
            "/api/stats/mapas/ascent/calor?tipo=morte",
            "/api/stats/mapas/ascent/calor?tipo=morte&lado=defesa",
            "/api/stats/mapas/ascent/calor?tipo=morte&compra=eco",
            "/api/stats/mapas/ascent/calor?tipo=morte&tempo_inicio_ms=0",
            "/api/stats/mapas/ascent/calor?tipo=morte&tempo_fim_ms=30000",
            "/api/stats/mapas/ascent/calor?tipo=abate",
        ]
        self.query_results(*[[resultado] for _ in urls])
        for url in urls:
            res = self.http.get(url)
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["data"], [ponto])
            self.assertEqual(self.http.get(url).json(), res.json())
        self.assertEqual(self.bq.query.call_count, len(urls))
        params = {p.name: p.value for p in
                  self.bq.query.call_args_list[4].kwargs["job_config"].query_parameters}
        self.assertEqual(params["tempo_fim_ms"], 30000)
        self.assertIsNone(params["compra"])


class CalorCanvasSqlTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.row_factory = sqlite3.Row
        self.db.create_function("IF", 3, lambda c, a, b: a if c else b)
        self.db.executescript("""
            CREATE TABLE eventos_round (
                partida_id TEXT, round_indice INT, round INT, id TEXT,
                mapa_id TEXT, tipo TEXT, torneio_id TEXT, data_partida_utc TEXT,
                ator_time_id TEXT, vitima_time_id TEXT, ator_id TEXT, vitima_id TEXT,
                tempo_ms INT, abate_adversario BOOL, dano_final_tipo TEXT,
                x REAL, y REAL
            );
            CREATE TABLE rounds (
                partida_id TEXT, round_indice_origem INT,
                atacante_id TEXT, defensor_id TEXT
            );
            CREATE TABLE economia_time_round (
                partida_id TEXT, round_indice_origem INT, time_id TEXT,
                status_qualidade TEXT, categoria TEXT
            );
            INSERT INTO rounds VALUES ('p1', 0, 'atq', 'def');
            INSERT INTO economia_time_round VALUES
                ('p1', 0, 'atq', 'ok', 'full'),
                ('p1', 0, 'def', 'ok', 'eco');
        """)
        # Executa os CTEs de produção de eventos até recorte.
        # Adapta só nomes de tabelas e os dois acessos a STRUCT para SQLite.
        sql = (Path(__file__).resolve().parents[1] / "queries/mapa_calor.sql").read_text()
        self.sql = "WITH eventos AS (" + sql.split("eventos AS (", 1)[1].split(
            "projetados AS (", 1
        )[0].rstrip().rstrip(",") + " SELECT * FROM recorte"
        for tabela in ("eventos_round", "rounds", "economia_time_round"):
            self.sql = self.sql.replace(f"`datropa.valorant.{tabela}`", tabela)
        self.sql = self.sql.replace("e.posicao.x", "e.x").replace("e.posicao.y", "e.y")

    def evento(self, id="e1", tipo="abate", tempo=25000, adversario=True, dano="Weapon"):
        self.db.execute(
            "INSERT INTO eventos_round VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            ("p1", 0, 1, id, "ascent", tipo, "T", "2026-06-20",
             "atq", "def", "autor", "vitima", tempo, adversario, dano, 10, 20),
        )

    def pontos(self, **filtros):
        params = dict(
            tipo="abate", mapa_id="ascent", torneio_id=None,
            data_inicio=None, data_fim=None, time_id=None, jogador_id=None,
            lado=None, compra=None, tempo_inicio_ms=None, tempo_fim_ms=None,
        )
        params.update(filtros)
        return [dict(r) for r in self.db.execute(self.sql, params)]

    def test_morte_usa_vitima_e_abate_usa_autor(self):
        self.evento()
        morte = self.pontos(tipo="morte", time_id="def", jogador_id="vitima",
                            lado="defesa", compra="eco")
        self.assertEqual(len(morte), 1)
        self.assertEqual(morte[0]["time_id"], "def")
        self.assertEqual(morte[0]["tempo_ms"], 25000)
        self.assertEqual(self.pontos(tipo="morte", time_id="atq"), [])
        self.assertEqual(len(self.pontos(time_id="atq", lado="ataque", compra="full")), 1)
        self.assertEqual(self.pontos(time_id="def"), [])

    def test_faixas_sem_duplicacao_e_tempo_desconhecido(self):
        for id, tempo in (("zero", 0), ("antes", 29999), ("limite", 30000),
                          ("desconhecido", None), ("invalido", -1)):
            self.evento(id=id, tempo=tempo)
        self.assertEqual(
            {r["evento_id"] for r in self.pontos(tempo_inicio_ms=0, tempo_fim_ms=30000)},
            {"zero", "antes"},
        )
        self.assertEqual(
            [r["evento_id"] for r in self.pontos(tempo_inicio_ms=30000)], ["limite"]
        )
        self.assertEqual(len(self.pontos(tempo_fim_ms=30000)), 2)
        self.assertEqual(len(self.pontos()), 5)

    def test_ambiental_na_morte_e_plant_preservado(self):
        self.evento(id="ambiental", adversario=False, dano="Bomb")
        self.assertEqual(self.pontos(), [])
        self.assertEqual(len(self.pontos(tipo="morte")), 1)
        self.evento(id="plant", tipo="plant", dano=None)
        self.assertEqual(len(self.pontos(tipo="plant", time_id="atq",
                                         lado="ataque", compra="full")), 1)

    def test_contexto_ausente_ou_incompleto_permanece_nulo(self):
        self.evento()
        self.db.execute("UPDATE economia_time_round SET status_qualidade='economia_incompleta'")
        self.db.execute("DELETE FROM rounds")
        ponto = self.pontos()[0]
        self.assertIsNone(ponto["compra"])
        self.assertIsNone(ponto["lado"])
        self.assertEqual(self.pontos(compra="full"), [])
        self.assertEqual(self.pontos(lado="ataque"), [])

    def test_lado_e_compra_acompanham_troca_de_lado(self):
        self.evento()
        self.db.execute(
            "INSERT INTO rounds VALUES ('p1', 12, 'def', 'atq')"
        )
        self.db.execute(
            "INSERT INTO economia_time_round VALUES ('p1', 12, 'atq', 'ok', 'pistol')"
        )
        self.db.execute(
            "UPDATE eventos_round SET round_indice=12, round=13"
        )
        pontos = self.pontos(time_id="atq", lado="defesa", compra="pistol")
        self.assertEqual(len(pontos), 1)
        self.assertEqual(pontos[0]["round"], 13)
        self.assertEqual(self.pontos(time_id="atq", lado="ataque"), [])
