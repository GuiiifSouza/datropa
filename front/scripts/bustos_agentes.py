"""Recorta o busto (cabeça e ombros) de cada retrato de corpo inteiro: fundo transparente, 256 px.
Uso (dentro de front/): python scripts/bustos_agentes.py   (precisa de Pillow)
"""
import os
from PIL import Image
CAB = {  # centro da cabeça no retrato 793x720
 'astra':(375,125),'breach':(397,125),'brimstone':(400,125),'chamber':(363,117),'clove':(375,125),'cypher':(383,140),
 'deadlock':(358,125),'fade':(383,142),'gekko':(342,117),'harbor':(375,125),'iso':(383,125),'jett':(383,133),
 'kayo':(383,117),'killjoy':(383,133),'miks':(350,165),'neon':(375,160),'omen':(383,133),'phoenix':(392,125),
 'raze':(392,142),'reyna':(383,142),'sage':(383,142),'skye':(392,117),'sova':(400,117),'tejo':(383,108),
 'veto':(375,100),'viper':(367,92),'vyse':(383,125),'waylay':(375,158),'yoru':(383,133)}
LADO = 165
OUT = 'public/arte/agentes/busto'
os.makedirs(OUT, exist_ok=True)
sheet = Image.new('RGBA', (8 * 150, 4 * 150), (15, 25, 35, 255))
for i, (slug, (x, y)) in enumerate(sorted(CAB.items())):
    im = Image.open(f'public/arte/agentes/corpo/{slug}.webp').convert('RGBA')
    box = (x - LADO // 2, y - 58, x + LADO // 2, y - 58 + LADO)
    c = im.crop(box).resize((256, 256), Image.LANCZOS)
    # some a base em degradê para o busto não terminar num corte reto
    from PIL import ImageDraw
    m = Image.new('L', (256, 256), 255); d = ImageDraw.Draw(m)
    # bordas suaves: efeitos de habilidade cortados no quadrado não viram uma aresta reta
    for k in range(70): d.line([(0, 186 + k), (256, 186 + k)], fill=int(255 * (1 - k / 70)))
    lat = Image.new('L', (256, 256), 255); dl = ImageDraw.Draw(lat)
    for k in range(22):
        v = int(255 * k / 22); dl.line([(k, 0), (k, 256)], fill=v); dl.line([(255 - k, 0), (255 - k, 256)], fill=v); dl.line([(0, k), (256, k)], fill=v)
    from PIL import ImageChops
    m = ImageChops.multiply(m, lat)
    a = Image.composite(c.getchannel('A'), Image.new('L', (256, 256), 0), m); c.putalpha(a)
    c.save(f'{OUT}/{slug}.webp', quality=90, method=6)
    sheet.alpha_composite(c.resize((140, 140)), (i % 8 * 150 + 5, i // 8 * 150 + 5))
sheet.save('busto_conferencia.png')  # folha para conferir os recortes (não versionar)
