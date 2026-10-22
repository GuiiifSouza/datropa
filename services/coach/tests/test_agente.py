"""Loop do agente com o Gemini trocado por respostas prontas (sem GCP)."""

from types import SimpleNamespace

import httpx
import pytest
from google.genai import errors, types

from coach import agente
from coach.tools import REGISTRO


def _texto(t):
    return SimpleNamespace(candidates=[SimpleNamespace(content=types.Content(
        role="model", parts=[types.Part.from_text(text=t)]))], function_calls=None, text=t)


def _tool(nome, args):
    fc = types.FunctionCall(name=nome, args=args)
    return SimpleNamespace(candidates=[SimpleNamespace(content=types.Content(
        role="model", parts=[types.Part(function_call=fc)]))], function_calls=[fc], text=None)


@pytest.fixture
def gemini(monkeypatch):
    """Fila de respostas (ou exceções) do Gemini; guarda o histórico de cada chamada."""
    fila, vistos = [], []

    def generate_content(model, contents, config):
        vistos.append([c.parts[0].text for c in contents])
        item = fila.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    falso = SimpleNamespace(models=SimpleNamespace(generate_content=generate_content))
    monkeypatch.setattr(agente, "cliente", lambda: falso)
    monkeypatch.setattr(agente.time, "sleep", lambda s: None)
    monkeypatch.setitem(REGISTRO["composicoes"].__dict__, "funcao", lambda **k: {"top": [{"taxa": 75.0}]})
    return SimpleNamespace(fila=fila, vistos=vistos)


def test_resposta_sem_numero_nao_e_cobrada(gemini):
    gemini.fila.append(_texto("Qual time você quer analisar?"))
    r = agente.perguntar("como joga o time?")
    assert r.texto == "Qual time você quer analisar?" and len(gemini.vistos) == 1


def test_numero_sem_tool_e_cobrado_e_sai_do_historico(gemini):
    gemini.fila += [_texto("Ganha 100% em 3 partidas."), _tool("composicoes", {"mapa": "Lotus"}),
                    _texto("Ganha 75,0%.")]
    conversa = agente.Conversa()
    r = conversa.perguntar("qual composição mais ganha?")
    assert r.texto == "Ganha 75,0%." and [c.nome for c in r.chamadas] == ["composicoes"]
    assert gemini.vistos[1][-1] == agente.COBRANCA
    textos = [c.parts[0].text for c in conversa.historico]
    assert "Ganha 100% em 3 partidas." not in textos and agente.COBRANCA not in textos


def test_numero_sem_tool_duas_vezes_vira_mensagem_segura(gemini):
    gemini.fila += [_texto("Ganha 100% em 3 partidas."), _texto("Ganha 90%.")]
    conversa = agente.Conversa()
    r = conversa.perguntar("qual composição mais ganha?")
    assert "Não consegui consultar os dados" in r.texto and not r.chamadas
    textos = [c.parts[0].text for c in conversa.historico]
    assert textos == ["qual composição mais ganha?", r.texto]


def test_erro_transitorio_do_vertex_e_repetido(gemini):
    gemini.fila += [httpx.RemoteProtocolError("Server disconnected"),
                    errors.ServerError(503, {"error": {"message": "indisponível"}}),
                    _texto("Qual time?")]
    assert agente.perguntar("oi").texto == "Qual time?"


def test_erro_transitorio_desiste_depois_das_tentativas(gemini):
    gemini.fila += [httpx.RemoteProtocolError("x")] * agente.TENTATIVAS
    with pytest.raises(httpx.RemoteProtocolError):
        agente.perguntar("oi")


def test_erro_do_cliente_nao_e_repetido(gemini):
    gemini.fila += [errors.ClientError(400, {"error": {"message": "inválido"}}), _texto("não devia chegar")]
    with pytest.raises(errors.ClientError):
        agente.perguntar("oi")
    assert len(gemini.vistos) == 1
