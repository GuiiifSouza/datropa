"""Gera o snapshot de dados do front a partir dos JSONs oficiais da base.

O snapshot deixa o site inteiro funcionando enquanto as rotas de /api/stats não
estão no ar. Os IDs seguem as mesmas regras da gold (services/stats/sql/gold/oficial),
então o front troca do snapshot para a API sem mudar nada nas telas:

- partida_id = matchInfo.matchId
- mapa_id    = último trecho de matchInfo.mapId em minúsculas (Jam -> "jam")
- torneio_id = prefixo do nome do arquivo (UNIVAVA_G, RUSH2, ...)
- time_id    = "time_" + sha256(slug do time no nome do arquivo, minúsculo, NFC)
- jogador_id = puuid
- agente_id  = characterId em minúsculas

Saída em front/public/snapshot/. Nada aqui é o JSON bruto: só agregados por
jogador e partida, por round e catálogos.

Uso, na raiz do repo, com a base em data/raw (fora do git):

    python3 front/scripts/gerar_snapshot.py --dados data/raw

Só usa a biblioteca padrão do Python 3.10+.
"""
from __future__ import annotations

import argparse
import collections
import glob
import hashlib
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

# Nome de exibição dos mapas (mapa_id da gold -> nome). Mesmo catálogo de services/stats/sql/gold/oficial/mapas.sql.
MAPAS = {
    'ascent': 'Ascent', 'bonsai': 'Split', 'canyon': 'Fracture', 'foxtrot': 'Breeze', 'infinity': 'Abyss',
    'jam': 'Lotus', 'juliett': 'Sunset', 'pitt': 'Pearl', 'triad': 'Haven', 'plummet': 'Summit',
    'port': 'Icebox', 'duality': 'Bind', 'hurm_bowl': 'Kasbah', 'rook': 'Corrode',
}
# Transformação pública (u depende de y, v depende de x). Copiada de mapas.sql para a prancheta.
TRANSFORMACAO = {
    'ascent': (0.00007, -0.00007, 0.813895, 0.573242), 'bonsai': (0.000078, -0.000078, 0.842188, 0.697578),
    'canyon': (0.000078, -0.000078, 0.556952, 1.155886), 'foxtrot': (0.00007, -0.00007, 0.465123, 0.833078),
    'infinity': (0.000081, -0.000081, 0.5, 0.5), 'jam': (0.000072, -0.000072, 0.454789, 0.917752),
    'juliett': (0.000078, -0.000078, 0.5, 0.515625), 'pitt': (0.000078, -0.000078, 0.480469, 0.916016),
    'triad': (0.000075, -0.000075, 1.09345, 0.642728), 'plummet': (0.000075, -0.000075, 0.047401, 0.978891),
}
TORNEIOS = {
    'UNIVAVA_C1': 'Univavá · Classificatória 1', 'UNIVAVA_C2': 'Univavá · Classificatória 2',
    'UNIVAVA_C3': 'Univavá · Classificatória 3', 'UNIVAVA_C4': 'Univavá · Classificatória 4',
    'UNIVAVA_G': 'Univavá · Fase de grupos', 'RUSHE': 'Rush Series · Esquenta',
    'RUSH2': 'Rush Series · Esquenta 2', 'RUSH_INCLUSIVO': 'Rush Series · Inclusivo',
}
RESULTADO = {'Eliminated': 'eliminacao', 'Bomb detonated': 'detonacao', 'Bomb defused': 'desarme',
             'Round timer expired': 'tempo'}
# Mesmo padrão de partidas.sql.
ARQUIVO = re.compile(r'^(.+?)_([0-9]+[a-z]?)_([0-9]{2}-[0-9]{2}-[0-9]{2})_(.+)_([0-9]+)_x_([0-9]+)_(.+)_([^_]+)\.json$')
JANELA_TROCA_MS = 5000  # KAST: morte trocada em até 5 s conta


def id_time(slug: str) -> str:
    return 'time_' + hashlib.sha256(unicodedata.normalize('NFC', slug).lower().encode()).hexdigest()


def nome_initcap(slug: str) -> str:
    # INITCAP(REPLACE(slug, '_', ' ')) do BigQuery.
    return ' '.join(w[:1].upper() + w[1:].lower() for w in slug.replace('_', ' ').split(' '))


def compra(rodada: int, equipamento: int) -> str:
    # Regra equipamento_time_10000_20000_pistol_v2 (services/stats/sql/gold/ECONOMIA.md).
    if rodada in (1, 13):
        return 'pistol'
    return 'eco' if equipamento < 10000 else 'force' if equipamento < 20000 else 'full'


def colunar(linhas: list[dict]) -> dict:
    colunas = list(linhas[0].keys()) if linhas else []
    return {'colunas': colunas, 'linhas': [[l[c] for c in colunas] for l in linhas]}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--dados', default=os.path.join(RAIZ, 'data', 'raw'))
    ap.add_argument('--agentes', default=os.path.join(RAIZ, 'services', 'coach', 'coach', 'catalogos', 'agentes.json'))
    ap.add_argument('--armas', default=os.path.join(RAIZ, 'front', 'scripts', 'catalogos', 'armas.json'))
    ap.add_argument('--saida', default=os.path.join(RAIZ, 'front', 'public', 'snapshot'))
    args = ap.parse_args()

    agentes = {a['uuid'].lower(): a for a in json.load(open(args.agentes, encoding='utf-8'))}
    armas = {a['uuid'].lower(): a['nome'] for a in json.load(open(args.armas, encoding='utf-8'))}
    arquivos = sorted(glob.glob(os.path.join(args.dados, '**', '*.json'), recursive=True))
    if not arquivos:
        sys.exit(f'Nenhum JSON em {args.dados}')

    partidas, jp, rounds_out = [], [], []
    times, jogadores = {}, {}
    armas_kills = collections.Counter()
    agentes_vistos = set()
    ignorados = []

    for caminho in arquivos:
        nome_arq = os.path.basename(caminho)
        m = ARQUIVO.match(nome_arq)
        if not m:
            ignorados.append(nome_arq)
            continue
        torneio, _seq, data_txt, slug_a, pa, pb, slug_b, _mapa_arq = m.groups()
        pa, pb = int(pa), int(pb)
        d = json.load(open(caminho, encoding='utf-8'))
        mi = d['matchInfo']
        cores = {t['teamId']: t for t in d['teams']}
        if cores['Red']['roundsWon'] == pa and cores['Blue']['roundsWon'] == pb and pa != pb:
            cor_a = 'Red'
        elif cores['Blue']['roundsWon'] == pa and cores['Red']['roundsWon'] == pb and pa != pb:
            cor_a = 'Blue'
        else:
            ignorados.append(nome_arq)
            continue
        cor_b = 'Blue' if cor_a == 'Red' else 'Red'
        ta, tb = id_time(slug_a), id_time(slug_b)
        times[ta] = {'id': ta, 'nome': nome_initcap(slug_a), 'slug': slug_a}
        times[tb] = {'id': tb, 'nome': nome_initcap(slug_b), 'slug': slug_b}
        id_cor = {cor_a: ta, cor_b: tb}
        venc_cor = next((t['teamId'] for t in d['teams'] if t['won']), None)
        mapa_id = mi['mapId'].rstrip('/').split('/')[-1].lower()
        pid = mi['matchId']
        dd, mm, aa = data_txt.split('-')
        inicio = (datetime.fromtimestamp(mi['gameStartMillis'] / 1000, timezone.utc).isoformat().replace('+00:00', 'Z')
                  if mi.get('gameStartMillis', 0) > 0 else None)
        rr = d['roundResults']
        partidas.append({
            'id': pid, 'torneio_id': torneio, 'mapa_id': mapa_id, 'inicio': inicio, 'data': f'20{aa}-{mm}-{dd}',
            'duracao_ms': mi.get('gameLengthMillis'), 'versao': mi.get('gameVersion'),
            'time_a_id': ta, 'time_b_id': tb, 'placar_a': pa, 'placar_b': pb,
            'vencedor_id': id_cor.get(venc_cor), 'rounds': len(rr),
        })

        validos = [p for p in d['players'] if not p.get('isObserver') and p.get('teamId') in ('Red', 'Blue')]
        cor_de = {p['puuid']: p['teamId'] for p in validos}
        st = {p['puuid']: collections.Counter() for p in validos}
        placar = {'Red': 0, 'Blue': 0}
        for r in rr:
            n = (r.get('roundNum') if r.get('roundNum') is not None else rr.index(r)) + 1
            eq = collections.Counter()
            evs = []
            for ps in r.get('playerStats', []):
                quem = ps.get('puuid')
                if quem not in cor_de:
                    continue
                eq[cor_de[quem]] += (ps.get('economy') or {}).get('loadoutValue', 0) or 0
                for x in ps.get('damage', []) or []:
                    if cor_de.get(x.get('receiver')) and cor_de[x['receiver']] != cor_de[quem]:
                        st[quem]['dano'] += x.get('damage', 0)
                        st[quem]['hs'] += x.get('headshots', 0)
                        st[quem]['bs'] += x.get('bodyshots', 0)
                        st[quem]['ls'] += x.get('legshots', 0)
                evs += ps.get('kills', []) or []
            evs = sorted((e for e in evs if (e.get('timeSinceRoundStartMillis') or 0) >= 0
                          and cor_de.get(e.get('killer')) and cor_de.get(e.get('victim'))
                          and cor_de[e['killer']] != cor_de[e['victim']]),
                         key=lambda e: e['timeSinceRoundStartMillis'])
            abates = collections.Counter(e['killer'] for e in evs)
            for quem, k in abates.items():
                if k >= 3:
                    st[quem][f'k{min(k, 5)}'] += 1
            for e in evs:
                item = ((e.get('finishingDamage') or {}).get('damageItem') or '').lower()
                if item in armas:
                    armas_kills[item] += 1
                else:
                    armas_kills['habilidade_ou_outro'] += 1
            # KAST simplificado: abate, assistência, sobreviveu ou foi trocado em até 5 s.
            morte = {e['victim']: e for e in evs}
            kast = set()
            for e in evs:
                kast.add(e['killer'])
                kast.update(a for a in (e.get('assistants') or []) if a in cor_de)
            for quem in cor_de:
                if quem not in morte:
                    kast.add(quem)
                else:
                    mm_ = morte[quem]
                    if any(e['victim'] == mm_['killer'] and 0 <= e['timeSinceRoundStartMillis'] - mm_['timeSinceRoundStartMillis'] <= JANELA_TROCA_MS for e in evs):
                        kast.add(quem)
            for quem in kast:
                st[quem]['kast'] += 1
            fb = evs[0] if evs else None
            if fb:
                st[fb['killer']]['fb'] += 1
                st[fb['victim']]['fd'] += 1
            w = r.get('winningTeam')
            papel = r.get('winningTeamRole')
            cor_atk = w if papel == 'Attacker' else ({'Red': 'Blue', 'Blue': 'Red'}.get(w) if papel == 'Defender' else None)
            if w in placar:
                placar[w] += 1
            tem_plant = r.get('plantRoundTime') is not None and bool(r.get('plantSite'))
            rounds_out.append({
                'partida_id': pid, 'round': n, 'vencedor_id': id_cor.get(w), 'atacante_id': id_cor.get(cor_atk),
                'lado_vencedor': {'Attacker': 'ataque', 'Defender': 'defesa'}.get(papel),
                'resultado': RESULTADO.get(r.get('roundResult'), 'outro' if r.get('roundResult') else None),
                'plant_site': r.get('plantSite') if tem_plant else None,
                'eq_a': eq[cor_a], 'eq_b': eq[cor_b], 'compra_a': compra(n, eq[cor_a]), 'compra_b': compra(n, eq[cor_b]),
                'fb_time_id': id_cor.get(cor_de[fb['killer']]) if fb else None,
                'placar_a': placar[cor_a], 'placar_b': placar[cor_b],
            })

        for p in validos:
            s = p.get('stats') or {}
            c = st[p['puuid']]
            ag = (p.get('characterId') or '').lower()
            agentes_vistos.add(ag)
            jogadores[p['puuid']] = {'id': p['puuid'], 'nome': p.get('gameName') or 'Jogador', 'tag': p.get('tagLine')}
            casts = s.get('abilityCasts') or {}
            jp.append({
                'partida_id': pid, 'jogador_id': p['puuid'], 'time_id': id_cor[p['teamId']], 'agente_id': ag,
                'venceu': 1 if p['teamId'] == venc_cor else 0, 'rounds': s.get('roundsPlayed') or len(rr),
                'score': s.get('score', 0), 'kills': s.get('kills', 0), 'deaths': s.get('deaths', 0),
                'assists': s.get('assists', 0), 'dano': c['dano'], 'hs': c['hs'], 'bs': c['bs'], 'ls': c['ls'],
                'fb': c['fb'], 'fd': c['fd'], 'kast': c['kast'], 'k3': c['k3'], 'k4': c['k4'], 'k5': c['k5'],
                'habilidades': sum(v for v in casts.values() if isinstance(v, int)),
            })

    os.makedirs(args.saida, exist_ok=True)

    def grava(nome: str, obj) -> None:
        with open(os.path.join(args.saida, nome), 'w', encoding='utf-8') as f:
            json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))

    usados_torneio = sorted({p['torneio_id'] for p in partidas})
    usados_mapa = sorted({p['mapa_id'] for p in partidas})
    grava('catalogos.json', {
        'torneios': [{'id': t, 'nome': TORNEIOS.get(t, t)} for t in usados_torneio],
        'mapas': [{'id': m, 'nome': MAPAS.get(m, m.capitalize()),
                   'transformacao': ({'u_x': 0.0, 'u_y': TRANSFORMACAO[m][0], 'u_offset': TRANSFORMACAO[m][2],
                                      'v_x': TRANSFORMACAO[m][1], 'v_y': 0.0, 'v_offset': TRANSFORMACAO[m][3]}
                                     if m in TRANSFORMACAO else None)} for m in usados_mapa],
        'agentes': [{'id': a, 'uuid': a, 'nome': agentes.get(a, {}).get('nome'), 'classe': agentes.get(a, {}).get('classe')}
                    for a in sorted(agentes_vistos)],
        'armas': [{'id': u, 'uuid': u, 'nome': n} for u, n in sorted(armas.items(), key=lambda x: x[1])],
    })
    grava('partidas.json', sorted(partidas, key=lambda p: (p['inicio'] or '', p['id'])))
    grava('times.json', sorted(times.values(), key=lambda t: (t['nome'], t['id'])))
    grava('jogadores.json', sorted(jogadores.values(), key=lambda j: (j['nome'].lower(), j['id'])))
    # Compacta: partida e jogador viram índice nas listas gravadas; time vira 'a'/'b' (lado do arquivo).
    ordem_p = sorted(partidas, key=lambda p: (p['inicio'] or '', p['id']))
    idx_p = {p['id']: i for i, p in enumerate(ordem_p)}
    lado = {p['id']: {p['time_a_id']: 'a', p['time_b_id']: 'b'} for p in partidas}
    ordem_j = sorted(jogadores.values(), key=lambda j: (j['nome'].lower(), j['id']))
    idx_j = {j['id']: i for i, j in enumerate(ordem_j)}
    for l in jp:
        l['time_id'] = lado[l['partida_id']][l['time_id']]
        l['partida_id'] = idx_p[l['partida_id']]
        l['jogador_id'] = idx_j[l['jogador_id']]
    for l in rounds_out:
        ld = lado[l['partida_id']]
        for c in ('vencedor_id', 'atacante_id', 'fb_time_id'):
            l[c] = ld.get(l[c]) if l[c] else None
        l['partida_id'] = idx_p[l['partida_id']]
    grava('jogador_partida.json', colunar(jp))
    grava('rounds.json', colunar(rounds_out))
    grava('armas_kills.json', [{'arma_id': k, 'nome': armas.get(k, 'Habilidade ou outro'), 'kills': v}
                               for k, v in armas_kills.most_common()])
    grava('manifesto.json', {
        'versao': 'snapshot_336_v1', 'gerado_em': datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'),
        'partidas': len(partidas), 'rounds': len(rounds_out), 'linhas_jogador_partida': len(jp),
        'times': len(times), 'jogadores': len(jogadores), 'arquivos_ignorados': ignorados,
        'codificacao': 'jogador_partida e rounds: partida_id = índice em partidas.json, jogador_id = índice em jogadores.json, '
                       'time = a/b (time_a/time_b da partida)',
        'regras': {'economia': 'equipamento_time_10000_20000_pistol_v2', 'kast': 'simplificado_troca_5s_v1',
                   'ids': 'iguais a gold_336_v1'},
    })
    print(f'{len(partidas)} partidas, {len(rounds_out)} rounds, {len(jp)} linhas jogador×partida, '
          f'{len(times)} times, {len(jogadores)} jogadores. Ignorados: {len(ignorados)}')


if __name__ == '__main__':
    main()
