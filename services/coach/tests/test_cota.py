"""Cota diária do coach: por usuário, global, virada do dia e queda para memória."""

import datetime as dt
import logging

import pytest

from coach import config, cota


@pytest.fixture
def relogio(monkeypatch):
    momento = {"agora": dt.datetime(2026, 10, 22, 23, 59, 0, tzinfo=cota.FUSO)}
    monkeypatch.setattr(cota, "agora", lambda: momento["agora"])
    monkeypatch.setattr(config, "LIMITE_DIARIO_USUARIO", 3)
    monkeypatch.setattr(config, "LIMITE_DIARIO_GLOBAL", 5)
    return momento


def _esgota(c, uid):
    with pytest.raises(cota.CotaEsgotada) as e:
        c.contar(uid)
    return e.value


def test_limite_por_usuario(relogio):
    c = cota.Cota(usar_firestore=False)
    for _ in range(3):
        c.contar("a")
    erro = _esgota(c, "a")
    assert erro.escopo == "usuario"
    assert erro.segundos_ate_virar == 60  # 23:59 -> meia-noite de São Paulo
    c.contar("b")  # outro usuário segue


def test_limite_global(relogio):
    c = cota.Cota(usar_firestore=False)
    for uid in ["a", "a", "b", "b", "c"]:
        c.contar(uid)
    assert _esgota(c, "d").escopo == "global"
    assert "d" not in c.memoria._usuarios  # pergunta recusada não conta


def test_virada_do_dia_no_fuso_de_sao_paulo(relogio):
    c = cota.Cota(usar_firestore=False)
    for _ in range(3):
        c.contar("a")
    _esgota(c, "a")
    # 02:59 UTC do dia 23 ainda é dia 22 em São Paulo
    relogio["agora"] = dt.datetime(2026, 10, 23, 2, 59, tzinfo=dt.timezone.utc).astimezone(cota.FUSO)
    _esgota(c, "a")
    relogio["agora"] = dt.datetime(2026, 10, 23, 0, 0, 1, tzinfo=cota.FUSO)
    c.contar("a")


class _FirestoreFalso:
    def __init__(self, falhar=False):
        self.falhar = falhar
        self.n: dict[str, int] = {}

    def contar(self, uid, dia):
        if self.falhar:
            raise RuntimeError("403 Missing or insufficient permissions")
        if self.n.get(f"{dia}_{uid}", 0) >= config.LIMITE_DIARIO_USUARIO:
            return "usuario"
        if self.n.get(dia, 0) >= config.LIMITE_DIARIO_GLOBAL:
            return "global"
        self.n[f"{dia}_{uid}"] = self.n.get(f"{dia}_{uid}", 0) + 1
        self.n[dia] = self.n.get(dia, 0) + 1
        return None


def test_firestore_quando_ligado(relogio):
    c = cota.Cota(usar_firestore=False)
    c.firestore = _FirestoreFalso()
    for _ in range(3):
        c.contar("a")
    assert _esgota(c, "a").escopo == "usuario"
    assert c.firestore.n == {"2026-10-22_a": 3, "2026-10-22": 3}
    assert c.memoria._global == 0


def test_queda_para_memoria_se_firestore_falhar(relogio, caplog):
    c = cota.Cota(usar_firestore=False)
    c.firestore = _FirestoreFalso(falhar=True)
    with caplog.at_level(logging.ERROR, logger="coach.cota"):
        for _ in range(3):
            c.contar("a")  # não derruba a pergunta
    assert "falha no Firestore" in caplog.text
    assert _esgota(c, "a").escopo == "usuario"  # a memória segue contando


def test_documentos_do_firestore(monkeypatch, relogio):
    """O caminho do Firestore com cliente falso: ids dos documentos, campos e limite."""
    from google.cloud import firestore

    docs: dict[str, dict] = {}

    class Snap:
        def __init__(self, dados):
            self.dados = dados

        def to_dict(self):
            return dict(self.dados) if self.dados else None

    class Doc:
        def __init__(self, id_):
            self.id = id_

        def get(self, transaction=None, timeout=None):
            return Snap(docs.get(self.id))

    class Colecao:
        def document(self, id_):
            return Doc(id_)

    class Tx:
        def set(self, ref, dados):
            docs[ref.id] = dados

    class Cliente:
        def collection(self, nome):
            assert nome == "limites"
            return Colecao()

        def transaction(self):
            return Tx()

    monkeypatch.setattr(firestore, "transactional", lambda f: f)
    fs = cota._Firestore()
    fs._cliente = Cliente()
    for _ in range(3):
        assert fs.contar("uid1", "2026-10-22") is None
    assert fs.contar("uid1", "2026-10-22") == "usuario"
    assert docs == {"2026-10-22_uid1": {"n": 3, "dia": "2026-10-22"},
                    "2026-10-22": {"n": 3, "dia": "2026-10-22"}}
