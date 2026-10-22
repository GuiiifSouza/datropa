"""Gera a prancheta do site a partir do protótipo do Claude Design (Main.dc.html).

O protótipo é a fonte de verdade da prancheta: o Rhuan itera lá e exporta para cá.
Este script separa o arquivo em três partes que o motor (src/prancheta/Motor.tsx) entende:

  src/prancheta/gerado/molde.html   marcação da tela (template com {{buracos}}, sc-for e sc-if)
  src/prancheta/gerado/prancheta.css estilos com escopo em .prancheta-dc (não vaza para o site)
  src/prancheta/gerado/logica.js     a lógica (classe Component) embrulhada num módulo

Arte da Riot (mapas, splash, ícones de agente e habilidade) não entra no git (front/AGENTS.md).
Ela é servida de /arte/prancheta/ e fica em public/arte/, que está no .gitignore.

Uso: python3 scripts/exportar_prancheta.py [caminho/do/Main.dc.html]
"""
import json
import re
import sys
from pathlib import Path

FRONT = Path(__file__).resolve().parent.parent
FONTE = Path(sys.argv[1]) if len(sys.argv) > 1 else FRONT / 'src/prancheta/fonte/Main.dc.html'
SAIDA = FRONT / 'src/prancheta/gerado'
ESCOPO = '.prancheta-dc'

# Arquivos enviados ao canvas (id do blob -> caminho servido pelo site, em /arte/prancheta).
ARTE = json.loads((FRONT / 'src/prancheta/fonte/arte.json').read_text(encoding='utf-8'))


def trocar(texto, antigo, novo, vezes=1):
    achados = texto.count(antigo)
    if achados != vezes:
        raise SystemExit(f'esperava {vezes}x e achei {achados}x: {antigo[:80]!r}')
    return texto.replace(antigo, novo)


def trocar_blobs(texto):
    def um(m):
        bid = m.group(1)
        if bid not in ARTE:
            raise SystemExit(f'blob sem destino em arte.json: {bid}')
        return ARTE[bid] or 'about:blank'
    return re.sub(r'/_blob/([0-9a-f]{32})', um, texto)


# ---------------- CSS com escopo ----------------

def dividir_seletores(sel):
    partes, prof, atual = [], 0, ''
    for c in sel:
        if c in '([':
            prof += 1
        elif c in ')]':
            prof -= 1
        if c == ',' and prof == 0:
            partes.append(atual)
            atual = ''
        else:
            atual += c
    partes.append(atual)
    return [p.strip() for p in partes if p.strip()]


def escopar_seletor(s):
    m = re.match(r'^(html|body|:root)\b(.*)$', s)
    if m:
        return ESCOPO + m.group(2)
    return ESCOPO + ' ' + s


def escopar_css(css, quadros):
    out, i, n = [], 0, len(css)
    while i < n:
        if css[i].isspace():
            out.append(css[i])
            i += 1
            continue
        if css.startswith('/*', i):
            j = css.index('*/', i) + 2
            i = j
            continue
        abre = css.index('{', i)
        cab = css[i:abre].strip()
        # acha o fechamento do bloco
        prof, j = 0, abre
        while True:
            if css[j] == '{':
                prof += 1
            elif css[j] == '}':
                prof -= 1
                if prof == 0:
                    break
            j += 1
        corpo = css[abre + 1:j]
        if cab.startswith('@keyframes') or cab.startswith('@-webkit-keyframes'):
            nome = cab.split()[1]
            out.append(f'@keyframes dcp-{nome}{{{corpo}}}')
        elif cab.startswith('@media') or cab.startswith('@supports'):
            out.append(cab + '{' + escopar_css(corpo, quadros) + '}')
        elif cab.startswith('@'):
            out.append(cab + '{' + corpo + '}')
        else:
            sels = ','.join(escopar_seletor(s) for s in dividir_seletores(cab))
            out.append(sels + '{' + renomear_animacoes(corpo, quadros) + '}')
        i = j + 1
    return ''.join(out)


def renomear_animacoes(decl, quadros):
    def um(m):
        valor = m.group(2)
        for q in quadros:
            valor = re.sub(r'(?<![\w-])' + re.escape(q) + r'(?![\w-])', 'dcp-' + q, valor)
        return m.group(1) + valor
    return re.sub(r'(animation(?:-name)?\s*:)([^;}]*)', um, decl)


# ---------------- leitura do protótipo ----------------

src = FONTE.read_text(encoding='utf-8')
xdc = src[src.index('<x-dc>') + len('<x-dc>'):src.rindex('</x-dc>')]
helmet = xdc[xdc.index('<helmet>'):xdc.index('</helmet>')]
molde = xdc[xdc.index('</helmet>') + len('</helmet>'):]
script = src[src.index('<script type="text/x-dc"'):]
script = script[script.index('>') + 1:script.index('</script>')]

css = ''.join(re.findall(r'<style>(.*?)</style>', helmet, re.S))
quadros = re.findall(r'@keyframes\s+([\w-]+)', css)
css = escopar_css(trocar_blobs(css), quadros)
# o base.css do site muda padrões do navegador (border-box, line-height, fonte dos botões...);
# dentro da prancheta eles voltam ao padrão, que é como o protótipo foi desenhado. :where() zera a
# especificidade do escopo, então qualquer regra do protótipo continua valendo por cima.
RESET = (f'{ESCOPO}{{font-size:16px;line-height:normal}}\n'
         ':where(.prancheta-dc) *,:where(.prancheta-dc) *::before,:where(.prancheta-dc) *::after{box-sizing:revert}\n'
         ':where(.prancheta-dc) button{font:revert;color:revert;cursor:revert}\n'
         ':where(.prancheta-dc) img{max-width:revert;display:revert}\n'
         ':where(.prancheta-dc) a{color:revert;text-decoration:revert}\n'
         ':where(.prancheta-dc) :where(h1,h2,h3,h4,p){margin:revert}\n'
         ':where(.prancheta-dc) table{border-collapse:revert}\n')
css = RESET + css
# o site já tem o próprio topo: no lugar do header do protótipo fica só a barra da prancheta
# o protótipo foi desenhado em 1440: abaixo de 1280 a barra de cima quebra em linhas em vez de se sobrepor
css += f'\n@media (max-width:1279px){{{ESCOPO} .barra-pr{{grid-template-columns:minmax(0,1fr) !important;justify-items:center}}}}'
css += f'\n{ESCOPO}{{position:relative}}\n{ESCOPO}.prancheta-dc--apres>div{{position:fixed;inset:0;z-index:200;height:100vh !important;min-height:0 !important}}\n'

# ---------------- marcação ----------------

ini = molde.index('<header class="topo">')
fim = molde.index('</header>', ini) + len('</header>')
molde = molde[:ini] + molde[fim:]
molde = trocar(molde, 'style="height: 100vh; min-height: 760px;', 'style="height: calc(100vh - var(--altura-topo-site, 64px)); min-height: 640px;')
molde = trocar_blobs(molde)
for q in quadros:
    molde = re.sub(r'(animation(?:-name)?\s*:\s*)' + re.escape(q) + r'\b', r'\1dcp-' + q, molde)

# ---------------- lógica ----------------

js = trocar_blobs(script)
# partidas reais: vêm da API (src/prancheta/reais.ts), não dos JSONs do canvas
js = re.sub(r"var PARTIDAS_URL = \{.*?\};\n", '', js, count=1, flags=re.S)
ini = js.index('  carregarReais(chave) {')
fim = js.index('\n  }\n', ini) + len('\n  }\n')
js = js[:ini] + '''  carregarReais(chave) {
    // partidas reais: listadas pela API do site (AMB.reais), que vai completando os rounds aos poucos
    if (!AMB.reais || (this.state.reais && this.state.reais[chave])) return;
    AMB.reais.listar(chave, (d) => { const novo = Object.assign({}, this.state.reais); novo[chave] = d; this.setState({ reais: novo }); });
  }
''' + js[fim:]
js = trocar(js, '  componentDidUpdate() {\n', '''  componentDidUpdate() {
    if (AMB.reais && this.state.modo === 'round') AMB.reais.detalhar(this.state.mapa, this.state.partida, this.state.round);
''')
js = trocar(js, 'const EVR = rd ? rd.ev.map(', 'const EVR = rd ? (rd.ev || []).map(')
js = trocar(js, '      rd.ev.forEach((e, i) => {', '      (rd.ev || []).forEach((e, i) => {')
js = trocar(js, 'p.rounds.forEach((r, ri) => r.ev.forEach(', 'p.rounds.forEach((r, ri) => (r.ev || []).forEach(')
js = js.replace('document.querySelector(', '(this.raizEl || document).querySelector(')
js = trocar(js, "var BASE_LINK = 'https://datropa.web.app/prancheta';", "var BASE_LINK = AMB.baseLink || 'https://datropa.web.app/prancheta';")
# o site abre a jogada que vier no link (?j=...&modo=ver) com o mesmo leitor do protótipo
# (assíncrono: o código DT2 vem comprimido e é aberto com DecompressionStream)
js = trocar(js, 'function deCodigo(txt) {', 'AMB.decodificar = function (t) { var l = lerLinkOuCodigo(t); return lerCodigo(l.codigo).then(function (j) { return { jogada: j, soVer: l.soVer }; }); };\nfunction deCodigo(txt) {')
# mapa de calor: a aba fica igual ao protótipo, mas vazia até a API ter os eventos do mapa inteiro
# (somar só os rounds já abertos no Round real daria um calor enganoso)
js = trocar(js, 'partidasR.forEach((p, pi) => p.rounds.forEach((r, ri) => (r.ev || []).forEach(', '(AMB.calorVazio ? [] : partidasR).forEach((p, pi) => p.rounds.forEach((r, ri) => (r.ev || []).forEach(')
js = trocar(js, "pontosNota: calorN > 2500 ?", "pontosNota: AMB.calorVazio ? 'Os eventos do mapa de calor entram assim que a base estiver no ar.' : calorN > 2500 ?")
# entrada pelo link: ?j= (jogada compartilhada) ou ?partida_id=&round= (round real)
js = trocar(js, '    if (ini && (ini.modo === \'round\' || ini.modo === \'planejar\')) this.setState({ modo: ini.modo });\n',
            '    if (ini && (ini.modo === \'round\' || ini.modo === \'planejar\')) this.setState({ modo: ini.modo });\n    if (AMB.inicio) AMB.inicio(this);\n')

modulo = ('// GERADO por scripts/exportar_prancheta.py a partir do protótipo (src/prancheta/fonte/Main.dc.html).\n'
          '// Não edite aqui: mude o protótipo e rode o script de novo.\n'
          '/* eslint-disable */\n'
          'export function criarPrancheta(DCLogic, AMB) {\n' + js + '\nreturn Component;\n}\n')

SAIDA.mkdir(parents=True, exist_ok=True)
(SAIDA / 'molde.html').write_text(molde.strip() + '\n', encoding='utf-8')
(SAIDA / 'prancheta.css').write_text('/* GERADO por scripts/exportar_prancheta.py. Não edite aqui. */\n' + css, encoding='utf-8')
(SAIDA / 'logica.js').write_text(modulo, encoding='utf-8')
print('ok:', len(molde), 'bytes de marcação,', len(css), 'de css,', len(js), 'de lógica')
(SAIDA / 'logica.d.ts').write_text(
    '// GERADO por scripts/exportar_prancheta.py.\n'
    'import type { ComponentClass } from \'react\';\n'
    'export function criarPrancheta(DCLogic: unknown, AMB: Record<string, unknown>): ComponentClass<Record<string, unknown>>;\n',
    encoding='utf-8')
