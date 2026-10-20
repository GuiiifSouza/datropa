"""Publicacao inicial da Gold. Nao substitui tabelas existentes.

Uso: python3 services/stats/sql/gold/oficial/publicar_gold.py verificar|publicar|validar
verificar: dry run das fontes de teste; nao cria tabelas.
publicar: preflight, dry run e criacao sequencial dos destinos oficiais, validacao.
validar: somente consultas de validacao nos destinos oficiais.
"""
import datetime
import json
from pathlib import Path
import subprocess
import sys

ORDEM = ['partidas', 'stats_jogador_partida', 'stats_time_partida', 'rounds',
         'ranking_jogador', 'stats_time', 'stats_mapa', 'stats_agente', 'mapas',
         'eventos_round', 'pos_plant_retake_partida', 'composicao_time_partida',
         'economia_time_round']
RAIZ = Path(__file__).resolve().parent
BQ = ['bq', '--project_id=datropa', '--location=southamerica-east1']
LOG = None


def executar(args, sql=None):
    cmd = BQ + args
    r = subprocess.run(cmd, input=sql, text=True, capture_output=True)
    registro = {'comando': cmd, 'codigo': r.returncode,
                'stdout': r.stdout, 'stderr': r.stderr}
    with LOG.open('a', encoding='utf-8') as f:
        f.write(json.dumps(registro, ensure_ascii=False) + '\n')
    print(r.stdout, end='')
    print(r.stderr, end='', file=sys.stderr)
    if r.returncode:
        raise RuntimeError('Comando falhou; publicacao interrompida. Veja o log.')
    return r.stdout


def consulta(path, extra=()):
    return executar(['query', '--use_legacy_sql=false',
                     '--maximum_bytes_billed=1073741824', *extra],
                    path.read_text(encoding='utf-8'))


def validar():
    # Guarda todas as saidas individuais para revisao humana.
    for path in sorted((RAIZ / 'validacoes').glob('*_oficial.sql')):
        if path.name != 'conjunto_oficial.sql':
            print('VALIDACAO:', path.name)
            consulta(path, ['--format=json', '--max_rows=1000'])
    out = consulta(RAIZ / 'validacoes/conjunto_oficial.sql',
                   ['--format=json', '--max_rows=1000'])
    rows = json.loads(out)
    if len(rows) != 24 or not all(str(r['passou']).lower() == 'true' for r in rows):
        raise RuntimeError('Validacao conjunta reprovada; nao liberar consumo pela API.')
    print('24 verificacoes conjuntas aprovadas. Revise tambem as saidas individuais no log.')


def main():
    global LOG
    if len(sys.argv) != 2 or sys.argv[1] not in ('verificar', 'publicar', 'validar'):
        raise SystemExit(__doc__)
    modo = sys.argv[1]
    pasta = Path('evidencias_gold_oficial')
    pasta.mkdir(exist_ok=True)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    LOG = pasta / f'{stamp}_{modo}.jsonl'
    print('Log:', LOG)
    if modo == 'verificar':
        for nome in ORDEM:
            print('DRY RUN TESTE:', nome)
            consulta(RAIZ.parent / f'{nome}.sql', ['--dry_run'])
        print('Dry runs de teste concluidos; nao validam ainda referencias oficiais inexistentes.')
        return
    if modo == 'publicar':
        # Usa INFORMATION_SCHEMA para evitar confundir falha de permissao com tabela ausente.
        out = executar(['query', '--use_legacy_sql=false',
                        '--maximum_bytes_billed=1073741824', '--format=json', '--max_rows=10000'],
                       'SELECT table_name FROM `datropa.valorant.INFORMATION_SCHEMA.TABLES`')
        existentes = {r['table_name'] for r in json.loads(out)}
        conflito = existentes.intersection(ORDEM)
        if conflito:
            raise RuntimeError('Destinos ja existentes: ' + ', '.join(sorted(conflito)) +
                               '. Nada substituido. Conferir antes de continuar.')
        for nome in ORDEM:
            path = RAIZ / f'{nome}.sql'
            print('DRY RUN OFICIAL:', nome)
            consulta(path, ['--dry_run'])
            print('CRIANDO:', nome)
            # WRITE_EMPTY: nao sobrescrever nem acrescentar a uma tabela existente.
            consulta(path, ['--destination_table=datropa:valorant.' + nome,
                            '--replace=false', '--append_table=false'])
    validar()


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, OSError) as e:
        raise SystemExit(str(e) + '\nSe houve criacao parcial, preserve as tabelas e envie o log; nao apague nem reexecute a publicacao inteira.')
