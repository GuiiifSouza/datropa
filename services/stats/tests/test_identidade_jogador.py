"""Regressão da escolha do nick, sem BigQuery ou credenciais."""
import re
import sqlite3
import unittest
from pathlib import Path


class IdentidadeJogadorTests(unittest.TestCase):
    def escolher_nome(self, registros):
        sql = (
            Path(__file__).resolve().parents[1]
            / "queries" / "jogador_detalhe.sql"
        ).read_text(encoding="utf-8")
        identidade = sql.split("), identidade AS (", 1)[1].split(
            "), recorte AS (", 1
        )[0]
        ordem = re.search(r"ORDER BY\s+(.+?)\s*\)", identidade, re.S).group(1)
        # Executa apenas a ordenação SQL de produção em dados sintéticos.
        # Não valida o dialeto completo nem o serviço do BigQuery.
        with sqlite3.connect(":memory:") as db:
            db.execute("CREATE TABLE historico (inicio TEXT, partida_id TEXT, nome TEXT)")
            db.executemany("INSERT INTO historico VALUES (?, ?, ?)", registros)
            return db.execute(
                f"SELECT nome FROM historico ORDER BY {ordem} LIMIT 1"
            ).fetchone()[0]

    def test_horarios_iguais_usam_maior_id_como_ranking(self):
        self.assertEqual(self.escolher_nome([
            ("2026-09-01", "a", "Nick A"),
            ("2026-09-01", "z", "Nick Z"),
        ]), "Nick Z")

    def test_data_mais_recente_precede_id(self):
        self.assertEqual(self.escolher_nome([
            ("2026-08-01", "z", "Antigo"),
            ("2026-09-01", "a", "Atual"),
            (None, "zz", "Sem data"),
        ]), "Atual")

    def test_datas_desconhecidas_desempatam_por_id(self):
        self.assertEqual(self.escolher_nome([
            (None, "a", "Nick A"),
            (None, "z", "Nick Z"),
        ]), "Nick Z")
