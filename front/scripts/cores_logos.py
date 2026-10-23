"""Extrai as cores de cada logo em public/logos-times e gera src/util/coresTimes.ts.

Uso: python scripts/cores_logos.py   (precisa de Pillow)
Escolhe a cor mais "de marca": frequente, saturada e visível no fundo escuro.
"""
import colorsys
import json
import os
from collections import Counter

from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.join(AQUI, '..', 'public', 'logos-times')
SAIDA = os.path.join(AQUI, '..', 'src', 'util', 'coresTimes.ts')


def hexa(c):
    return '#%02X%02X%02X' % c


def cores(caminho):
    im = Image.open(caminho).convert('RGBA').resize((96, 96))
    cont = Counter()
    for r, g, b, a in list(im.getdata()):
        if a < 160:
            continue
        cont[(r // 24 * 24 + 12, g // 24 * 24 + 12, b // 24 * 24 + 12)] += 1
    total = sum(cont.values()) or 1
    notas = []
    for c, n in cont.items():
        h, s, v = colorsys.rgb_to_hsv(*(x / 255 for x in c))
        if v < .22:
            continue
        if s < .3:
            continue  # branco, cinza e preto não identificam o time
        nota = (n / total) * (0.25 + s) * (0.4 + v)
        notas.append((nota, h, s, v, c, n / total))
    # Agrupa tons vizinhos para a cor dominante não se dividir em vários baldes.
    notas.sort(reverse=True)
    if not notas or sum(x[5] for x in notas if min(abs(x[1] - notas[0][1]), 1 - abs(x[1] - notas[0][1])) < .05) < .03:
        return None  # logo monocromática: o front usa o tom neutro
    principal = notas[0]
    segunda = next((x for x in notas[1:] if min(abs(x[1] - principal[1]), 1 - abs(x[1] - principal[1])) > .08 and x[2] > .18), None)
    def ajusta(x):
        h, s, v = x[1], x[2], x[3]
        # Garante leitura no fundo #0F1923 sem virar neon.
        r, g, b = colorsys.hsv_to_rgb(h, min(max(s, .45), .85), min(max(v, .86), 1))
        return hexa((round(r * 255), round(g * 255), round(b * 255)))
    return [ajusta(principal)] + ([ajusta(segunda)] if segunda else [])


saida = {}
for f in sorted(os.listdir(PASTA)):
    if f.endswith('.png'):
        c = cores(os.path.join(PASTA, f))
        if c:
            saida[f[:-4]] = c

with open(SAIDA, 'w', encoding='utf-8') as fp:
    fp.write('/** Gerado por scripts/cores_logos.py a partir das logos em public/logos-times. Não editar à mão. */\n')
    fp.write('export const CORES_LOGO: Record<string, string[]> = ' + json.dumps(saida, indent=2) + ';\n')
print(len(saida), 'logos com cor;', json.dumps(saida)[:400])
