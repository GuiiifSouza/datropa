from collections import OrderedDict
from copy import deepcopy
from threading import Lock
from time import monotonic

TTL_SECONDS = 300
MAX_ENTRIES = 128

_cache = OrderedDict()
_lock = Lock()


def obter_cache(chave):
    with _lock:
        item = _cache.get(chave)

        if item is None:
            return None

        expira_em, resposta = item

        if monotonic() >= expira_em:
            del _cache[chave]
            return None

        _cache.move_to_end(chave)
        return deepcopy(resposta)


def salvar_cache(chave, resposta):
    with _lock:
        agora = monotonic()

        vencidas = [
            existente
            for existente, (expira_em, _) in _cache.items()
            if agora >= expira_em
        ]

        for existente in vencidas:
            del _cache[existente]

        _cache[chave] = (
            agora + TTL_SECONDS,
            deepcopy(resposta),
        )
        _cache.move_to_end(chave)

        while len(_cache) > MAX_ENTRIES:
            _cache.popitem(last=False)