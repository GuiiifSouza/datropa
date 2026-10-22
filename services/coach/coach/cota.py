"""Cota diária de perguntas: por usuário (`sub` do token) e global (o serviço inteiro).

Protege o orçamento do projeto: com login anônimo, qualquer pessoa ganha um token válido.
A pergunta é contada antes de chamar o Gemini; pergunta recusada não conta.

Dois armazenamentos:
- memória (padrão): contador no processo, por instância do Cloud Run. Zera quando a
  instância reinicia (deploy ou escala a zero).
- Firestore (`COACH_LIMITE_FIRESTORE=1`): `limites/{AAAA-MM-DD}` e
  `limites/{AAAA-MM-DD}_{uid}`, campo `n`, numa transação. Vale para todas as instâncias.
  Exige `roles/datastore.user` na `sa-coach`. Se o Firestore falhar, registra no log e
  cai para o contador em memória; a pergunta não é derrubada.

O dia é o de São Paulo (UTC-3 fixo: o Brasil não tem horário de verão desde 2019).
"""

from __future__ import annotations

import datetime as dt
import logging
import threading

from . import config

log = logging.getLogger("coach.cota")

FUSO = dt.timezone(dt.timedelta(hours=-3))
COLECAO = "limites"


class CotaEsgotada(Exception):
    def __init__(self, escopo: str, segundos_ate_virar: int):
        self.escopo = escopo
        self.segundos_ate_virar = segundos_ate_virar
        super().__init__(escopo)


def agora() -> dt.datetime:
    return dt.datetime.now(FUSO)


def _dia_e_espera() -> tuple[str, int]:
    momento = agora()
    amanha = (momento + dt.timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return momento.strftime("%Y-%m-%d"), max(1, int((amanha - momento).total_seconds()))


class _Memoria:
    def __init__(self):
        self._trava = threading.Lock()
        self._dia = ""
        self._global = 0
        self._usuarios: dict[str, int] = {}

    def contar(self, uid: str, dia: str) -> str | None:
        """Conta a pergunta ou devolve o escopo esgotado."""
        with self._trava:
            if dia != self._dia:
                self._dia, self._global, self._usuarios = dia, 0, {}
            if self._usuarios.get(uid, 0) >= config.LIMITE_DIARIO_USUARIO:
                return "usuario"
            if self._global >= config.LIMITE_DIARIO_GLOBAL:
                return "global"
            self._usuarios[uid] = self._usuarios.get(uid, 0) + 1
            self._global += 1
            return None


class _Firestore:
    def __init__(self):
        self._cliente = None
        self._trava = threading.Lock()

    def _db(self):
        with self._trava:
            if self._cliente is None:
                from google.cloud import firestore
                self._cliente = firestore.Client(project=config.PROJETO)
            return self._cliente

    def contar(self, uid: str, dia: str) -> str | None:
        from google.cloud import firestore

        db = self._db()
        ref_global = db.collection(COLECAO).document(dia)
        ref_usuario = db.collection(COLECAO).document(f"{dia}_{uid}")

        @firestore.transactional
        def _tx(tx):
            n_usuario = (ref_usuario.get(transaction=tx, timeout=5).to_dict() or {}).get("n", 0)
            n_global = (ref_global.get(transaction=tx, timeout=5).to_dict() or {}).get("n", 0)
            if n_usuario >= config.LIMITE_DIARIO_USUARIO:
                return "usuario"
            if n_global >= config.LIMITE_DIARIO_GLOBAL:
                return "global"
            tx.set(ref_usuario, {"n": n_usuario + 1, "dia": dia})
            tx.set(ref_global, {"n": n_global + 1, "dia": dia})
            return None

        return _tx(db.transaction())


class Cota:
    def __init__(self, usar_firestore: bool | None = None):
        if usar_firestore is None:
            usar_firestore = config.LIMITE_FIRESTORE
        self.memoria = _Memoria()
        self.firestore = _Firestore() if usar_firestore else None

    def contar(self, uid: str) -> None:
        """Conta uma pergunta de `uid`. Levanta CotaEsgotada se passou de algum limite."""
        dia, espera = _dia_e_espera()
        escopo = None
        if self.firestore is not None:
            try:
                escopo = self.firestore.contar(uid, dia)
            except Exception:
                log.exception("cota: falha no Firestore, usando contador em memória")
                escopo = self.memoria.contar(uid, dia)
        else:
            escopo = self.memoria.contar(uid, dia)
        if escopo:
            log.warning("cota esgotada escopo=%s uid=%s dia=%s", escopo, uid, dia)
            raise CotaEsgotada(escopo, espera)
