"""Medições com Gemini/BigQuery falsos; nenhuma credencial ou chamada GCP."""
import asyncio
import json
from types import SimpleNamespace

from fastapi.testclient import TestClient
from google.genai import types
import httpx
import pytest

from coach import agente, app as app_mod, auth, config, medir_cli
from coach import bq
from coach.medicao import medir, sessao
from coach.tools import REGISTRO


def texto(t):
    return SimpleNamespace(candidates=[SimpleNamespace(content=types.Content(
        role='model', parts=[types.Part.from_text(text=t)]))], function_calls=None, text=t)


def test_contextos_isolados_e_desativacao():
    async def tarefa(nome):
        with sessao(nome) as m:
            await asyncio.sleep(0)
            with medir('tool', nome):
                pass
        return m

    async def rodar():
        return await asyncio.gather(tarefa('a'), tarefa('b'))
    a, b = asyncio.run(rodar())
    assert [e['nome'] for e in a.eventos] == ['a']
    assert [e['nome'] for e in b.eventos] == ['b']
    assert a.id != b.id and a.total_ms >= 0
    with medir('tool', 'fora') as evento:
        assert evento == {}
    assert len(a.eventos) == 1


def test_falha_preserva_excecao_e_limpa_contexto():
    with pytest.raises(ValueError, match='teste'):
        with sessao('erro') as m:
            with medir('tool', 'falha'):
                raise ValueError('teste')
    assert m.eventos[0]['status'] == 'erro' and m.total_ms >= 0
    with medir('tool', 'depois'):
        pass
    assert len(m.eventos) == 1


def test_bigquery_cache_sem_modificar_resultado(monkeypatch):
    job = SimpleNamespace(cache_hit=True, total_bytes_processed=0,
                          result=lambda: [{'valor': 1.2345}])
    monkeypatch.setattr(bq, 'cliente', lambda: SimpleNamespace(query=lambda *a, **k: job))
    with sessao('teste') as m:
        r = bq.CONSULTAS['ids.times'].rodar()
    assert r == [{'valor': 1.23}]
    e = m.eventos[0]
    assert e['cache_hit'] is True and e['linhas'] == 1 and e['bytes_processados'] == 0
    assert 'valor' not in json.dumps(m.relatorio())


def test_gemini_retry_e_tool_erro_medidos(monkeypatch):
    fc = types.FunctionCall(name='composicoes', args={})
    chamada = SimpleNamespace(candidates=[SimpleNamespace(content=types.Content(
        role='model', parts=[types.Part(function_call=fc)]))], function_calls=[fc], text=None)
    fila = [httpx.RemoteProtocolError('falha'), chamada, texto('Sem dados disponíveis.')]

    def gerar(**kwargs):
        r = fila.pop(0)
        if isinstance(r, Exception):
            raise r
        return r
    monkeypatch.setattr(agente, 'cliente', lambda: SimpleNamespace(models=SimpleNamespace(generate_content=gerar)))
    monkeypatch.setattr(agente.time, 'sleep', lambda s: None)
    monkeypatch.setattr(REGISTRO['composicoes'], 'funcao', lambda **k: {'erro': 'sem dados'})
    with sessao('teste') as m:
        r = agente.perguntar('pergunta de teste')
    assert r.texto == 'Sem dados disponíveis.'
    gemini = [e for e in m.eventos if e['tipo'] == 'gemini']
    assert [e['status'] for e in gemini] == ['erro', 'ok', 'ok']
    assert [e['tentativa'] for e in gemini] == [1, 2, 1]
    assert any(e['tipo'] == 'espera_retry' for e in m.eventos)
    assert next(e for e in m.eventos if e['tipo'] == 'tool')['status'] == 'erro_tool'
    assert 'pergunta de teste' not in json.dumps(m.relatorio())


def test_http_mede_thread_sem_mudar_envelope_ou_auth(monkeypatch, caplog):
    class Falso:
        def __init__(self, *args):
            pass

        def perguntar(self, pergunta):
            with medir('tool', 'falsa'):
                return agente.Resposta('Resposta de teste.')
    monkeypatch.setattr(agente, 'Conversa', Falso)
    monkeypatch.setattr(config, 'AUTH_DESLIGADA', False)
    monkeypatch.setattr(auth, 'validar', lambda token: {'sub': 'teste'})
    monkeypatch.setattr(app_mod, 'limite', app_mod._Limite())
    monkeypatch.setattr(app_mod, 'cota_diaria', app_mod.cota.Cota(usar_firestore=False))
    monkeypatch.setenv('COACH_MEDIR_TEMPOS', '1')
    caplog.set_level('INFO', logger='coach.app')
    client = TestClient(app_mod.app)
    r = client.post('/api/coach/perguntar', json={'pergunta': 'texto privado'},
                    headers={'Authorization': 'Bearer segredo'})
    assert r.status_code == 200
    assert r.json()['data'] == {'resposta': 'Resposta de teste.', 'tools': []}
    linhas = [x.message for x in caplog.records if x.message.startswith('coach_tempos ')]
    medicao = json.loads(linhas[-1].removeprefix('coach_tempos '))
    assert medicao['http_status'] == 200 and medicao['total_ms'] >= 0
    assert any(e['nome'] == 'falsa' for e in medicao['eventos'])
    assert 'texto privado' not in linhas[-1] and 'segredo' not in linhas[-1]
    assert client.post('/api/coach/perguntar', json={'pergunta': 'oi'}).status_code == 401
    caplog.clear()
    monkeypatch.delenv('COACH_MEDIR_TEMPOS')
    client.post('/api/coach/perguntar', json={'pergunta': 'oi'})
    assert not any(x.message.startswith('coach_tempos ') for x in caplog.records)


def test_cli_salva_repeticoes_e_nao_sobrescreve(monkeypatch, tmp_path):
    class Falso:
        def perguntar(self, pergunta):
            with medir('gemini', 'generate_content', tentativa=1):
                return agente.Resposta('Resposta simulada.')
    monkeypatch.setattr(agente, 'Conversa', Falso)
    saida = tmp_path / 'tempos.json'
    args = ['--repeticoes', '2', '--saida', str(saida), 'pergunta']
    assert medir_cli.main(args) == 0
    r = json.loads(saida.read_text())
    assert len(r['resultados']) == 2
    assert r['resultados'][0]['resposta'] == 'Resposta simulada.'
    with pytest.raises(SystemExit):
        medir_cli.main(args)
