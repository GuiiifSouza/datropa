"""Validação do ID token do Firebase Authentication.

Confere assinatura (chaves públicas do Google, com cache pelo Cache-Control),
expiração, `aud` = projeto Firebase, `iss` = securetoken do projeto e `sub`
presente. Não confia no Hosting: toda rota passa por aqui.
"""

from __future__ import annotations

import re
import threading
import time

import requests
from google.auth import exceptions, jwt

from . import config

CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"


class TokenInvalido(Exception):
    pass


class _Certificados:
    def __init__(self, url: str = CERTS_URL):
        self.url = url
        self._certs: dict[str, str] = {}
        self._expira = 0.0
        self._trava = threading.Lock()

    def obter(self) -> dict[str, str]:
        with self._trava:
            if time.time() >= self._expira or not self._certs:
                resp = requests.get(self.url, timeout=5)
                resp.raise_for_status()
                self._certs = resp.json()
                m = re.search(r"max-age=(\d+)", resp.headers.get("Cache-Control", ""))
                self._expira = time.time() + (int(m.group(1)) if m else 3600)
            return self._certs


_certificados = _Certificados()


def validar(token: str, certificados: _Certificados | dict | None = None) -> dict:
    """Devolve as claims do token ou levanta TokenInvalido."""
    projeto = config.FIREBASE_PROJETO
    certs = certificados if isinstance(certificados, dict) else (certificados or _certificados).obter()
    try:
        claims = jwt.decode(token, certs=certs, audience=projeto, clock_skew_in_seconds=10)
    except (ValueError, exceptions.GoogleAuthError) as e:
        raise TokenInvalido(str(e)) from None
    if claims.get("iss") != f"https://securetoken.google.com/{projeto}":
        raise TokenInvalido("emissor inválido")
    if not claims.get("sub"):
        raise TokenInvalido("token sem usuário")
    return claims
