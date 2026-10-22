"""Mede perguntas reais via CLI. Usa Gemini/BigQuery e consome cotas.

    python -m coach.medir_cli --saida tempos.json "Compare Wolf Gaming e Azure Bears Golden"
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import statistics

from . import config
from .medicao import sessao


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('pergunta')
    p.add_argument('--repeticoes', type=int, default=3)
    p.add_argument('--saida', type=Path, default=Path('tempos_coach.json'))
    a = p.parse_args(argv)
    if not 1 <= a.repeticoes <= 10:
        p.error('--repeticoes deve ficar entre 1 e 10')
    if a.saida.exists():
        p.error('arquivo de saida ja existe; escolha outro nome para preservar a medicao anterior')
    # As importacoes ficam fora do cronometro; o primeiro cliente/conexao fica dentro.
    from .agente import Conversa

    resultados = []
    print('TESTE REAL: usa Gemini/BigQuery; nao altera tabelas nem o site.')
    print('Cada repeticao comeca sem historico. A primeira pode inicializar clientes/cache.')
    for i in range(a.repeticoes):
        erro = None
        resposta = None
        with sessao('cli') as m:
            try:
                resposta = Conversa().perguntar(a.pergunta)
            except Exception as e:
                # So a classe: excecoes de terceiros podem conter detalhes sensiveis.
                erro = type(e).__name__
        r = m.relatorio()
        r.update(repeticao=i + 1, erro=erro,
                 resposta=resposta.texto if resposta else None,
                 tools=[c.nome for c in resposta.chamadas] if resposta else [])
        r['tools_com_erro'] = [c.nome for c in resposta.chamadas if 'erro' in c.resultado] if resposta else []
        resultados.append(r)
        # Salva cada repeticao: falha posterior nao perde os tempos anteriores.
        a.saida.write_text(json.dumps({
            'modelo': config.MODELO, 'regiao': config.REGIAO,
            'medido_em_utc': datetime.now(timezone.utc).isoformat(),
            'observacao': 'CLI: nao inclui navegador, JWT, cota HTTP, rede do site nem startup do container.',
            'resultados': resultados,
        }, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f"\nRepeticao {i + 1}: {m.total_ms / 1000:.2f}s | erro={erro or 'nenhum'} | tools_com_erro={r['tools_com_erro']}")
        for e in r['eventos']:
            extra = f" | cache={e['cache_hit']}" if 'cache_hit' in e else ''
            print(f"  {e['tipo']:12s} {e['nome']:36s} {e['ms']/1000:6.2f}s | {e['status']}{extra}")
        if resposta:
            print('RESPOSTA:', resposta.texto)
        if erro:
            print('Teste interrompido apos falha; corrija o acesso antes de repetir.')
            return 1
    print(f"\nMediana: {statistics.median(r['total_ms'] for r in resultados)/1000:.2f}s")
    print('BigQuery esta incluido em tool: nao somar camadas diferentes.')
    print('Resumo salvo em:', a.saida)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
