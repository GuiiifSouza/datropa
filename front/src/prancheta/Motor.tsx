/**
 * Motor da prancheta: roda no React a tela exportada do protótipo (scripts/exportar_prancheta.py).
 *
 * O protótipo usa um formato simples: marcação HTML com {{buracos}} (só caminho, nunca expressão),
 * <sc-for list as> para repetir, <sc-if value> para condicionar e eventos em camelCase
 * (onClick="{{acao}}"). A lógica é uma classe com renderVals(), que devolve os valores dos buracos.
 * Aqui o molde vira uma árvore uma vez só e cada render monta os elementos React a partir dela.
 */
import { Component, createElement, type ReactNode } from 'react';

type No =
  | { k: 'txt'; v: string }
  | { k: 'el'; tag: string; attrs: [string, string][]; filhos: No[] }
  | { k: 'for'; lista: string; como: string; filhos: No[] }
  | { k: 'if'; valor: string; filhos: No[] };

type Escopo = Record<string, unknown>;

const EVENTOS: Record<string, string> = Object.fromEntries(
  ['Click', 'DoubleClick', 'PointerDown', 'PointerMove', 'PointerUp', 'PointerLeave', 'PointerEnter', 'PointerCancel', 'Change', 'Input',
    'Focus', 'Blur', 'KeyDown', 'KeyUp', 'Wheel', 'DragStart', 'DragOver', 'DragEnd', 'DragLeave', 'Drop', 'ContextMenu', 'Scroll', 'Submit', 'Toggle']
    .map((n) => ['on' + n.toLowerCase(), 'on' + n]),
);
EVENTOS.ondblclick = 'onDoubleClick';

const NOMES: Record<string, string> = {
  class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly', maxlength: 'maxLength', minlength: 'minLength',
  autocomplete: 'autoComplete', autofocus: 'autoFocus', spellcheck: 'spellCheck', contenteditable: 'contentEditable',
  colspan: 'colSpan', rowspan: 'rowSpan', inputmode: 'inputMode', enterkeyhint: 'enterKeyHint', crossorigin: 'crossOrigin',
  srcset: 'srcSet', 'xlink:href': 'xlinkHref', 'xml:space': 'xmlSpace', 'accept-charset': 'acceptCharset', 'http-equiv': 'httpEquiv',
};
const BOOLEANOS = new Set(['readOnly', 'disabled', 'checked', 'autoFocus', 'multiple', 'required', 'hidden', 'open', 'selected']);
const SEM_TEXTO = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'select', 'colgroup']);

const camelo = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function converter(n: Node): No | null {
  if (n.nodeType === 3) return { k: 'txt', v: n.textContent ?? '' };
  if (n.nodeType !== 1) return null;
  const el = n as Element;
  const tag = el.tagName.toLowerCase();
  const filhos = Array.from(el.childNodes).map(converter).filter((x): x is No => !!x);
  if (tag === 'sc-for') return { k: 'for', lista: limpar(el.getAttribute('list')), como: el.getAttribute('as') ?? 'item', filhos };
  if (tag === 'sc-if') return { k: 'if', valor: limpar(el.getAttribute('value')), filhos };
  const svg = el.namespaceURI === 'http://www.w3.org/2000/svg';
  return {
    k: 'el', tag: svg ? el.tagName : tag,
    attrs: Array.from(el.attributes).map((a) => [a.name, a.value] as [string, string]),
    filhos: SEM_TEXTO.has(tag) ? filhos.filter((f) => f.k !== 'txt' || f.v.trim()) : filhos,
  };
}

function limpar(v: string | null) { return (v ?? '').replace(/^\s*\{\{\s*|\s*\}\}\s*$/g, ''); }

export function compilar(html: string): No[] {
  const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, 'text/html');
  return Array.from(doc.body.childNodes).map(converter).filter((x): x is No => !!x);
}

function olhar(escopos: Escopo[], caminho: string): unknown {
  const c = caminho.trim();
  if (c === 'true') return true;
  if (c === 'false') return false;
  if (c === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(c)) return Number(c);
  if (/^'.*'$|^".*"$/.test(c)) return c.slice(1, -1);
  const partes = c.split('.');
  for (let i = escopos.length - 1; i >= 0; i--) {
    const e = escopos[i];
    if (e && partes[0] in e) {
      let v: unknown = e;
      for (const p of partes) { if (v == null) return undefined; v = (v as Record<string, unknown>)[p]; }
      return v;
    }
  }
  return undefined;
}

const SO_BURACO = /^\s*\{\{([^}]+)\}\}\s*$/;
function valor(txt: string, escopos: Escopo[]): unknown {
  const m = SO_BURACO.exec(txt);
  if (m) return olhar(escopos, m[1]);
  if (txt.indexOf('{{') < 0) return txt;
  return txt.replace(/\{\{([^}]+)\}\}/g, (_, c: string) => { const v = olhar(escopos, c); return v == null || typeof v === 'function' ? '' : String(v); });
}

function estilo(txt: string): Record<string, string> {
  const out: Record<string, string> = {};
  let prof = 0, atual = '';
  const decls: string[] = [];
  for (const ch of txt) {
    if (ch === '(') prof++; else if (ch === ')') prof--;
    if (ch === ';' && prof === 0) { decls.push(atual); atual = ''; } else atual += ch;
  }
  decls.push(atual);
  for (const d of decls) {
    const i = d.indexOf(':');
    if (i < 0) continue;
    const prop = d.slice(0, i).trim(), v = d.slice(i + 1).trim();
    if (!prop || !v) continue;
    const nome = prop.startsWith('--') ? prop : prop.startsWith('-ms-') ? camelo(prop.slice(1)) : camelo(prop);
    out[nome] = v;
  }
  return out;
}

function props(no: Extract<No, { k: 'el' }>, escopos: Escopo[]) {
  const p: Record<string, unknown> = {};
  const svg = no.tag !== no.tag.toLowerCase() || /^(svg|path|circle|rect|line|polyline|polygon|g|use|defs|symbol|ellipse|text|tspan|lineargradient|radialgradient|stop|clippath|mask|pattern|filter)$/.test(no.tag);
  for (const [nome, cru] of no.attrs) {
    if (nome.startsWith('hint-')) continue;
    const v = valor(cru, escopos);
    if (EVENTOS[nome]) { if (typeof v === 'function') p[EVENTOS[nome]] = v; continue; }
    if (nome === 'style') { p.style = estilo(String(v ?? '')); continue; }
    let n = NOMES[nome] ?? nome;
    if (svg && !n.startsWith('aria-') && !n.startsWith('data-') && n.includes('-')) n = camelo(n);
    if (BOOLEANOS.has(n)) { p[n] = !(v === false || v === 'false' || v == null); continue; }
    p[n] = v;
  }
  // campo com valor e sem onChange vira só leitura (como no protótipo)
  if ((no.tag === 'input' || no.tag === 'textarea') && 'value' in p && !p.onChange) p.readOnly = true;
  return p;
}

function montar(nos: No[], escopos: Escopo[]): ReactNode[] {
  const out: ReactNode[] = [];
  nos.forEach((no) => {
    if (no.k === 'txt') { const v = valor(no.v, escopos); if (v != null && v !== '') out.push(typeof v === 'object' ? '' : String(v)); return; }
    if (no.k === 'if') { if (olhar(escopos, no.valor)) out.push(...montar(no.filhos, escopos)); return; }
    if (no.k === 'for') {
      const lista = olhar(escopos, no.lista);
      if (!Array.isArray(lista)) return;
      // filhos posicionais (sem key), como no protótipo: a ordem do molde decide quem é quem
      lista.forEach((item, j) => { out.push(...montar(no.filhos, escopos.concat([{ [no.como]: item, $index: j }]))); });
      return;
    }
    out.push(createElement(no.tag, props(no, escopos), ...montar(no.filhos, escopos)));
  });
  return out;
}

export type Ambiente = Record<string, unknown>;

/** Base da classe do protótipo: um componente React cujo render monta o molde com o renderVals(). */
export function criarBase(molde: No[]) {
  return class DCLogic extends Component<Record<string, unknown>, Record<string, unknown>> {
    raizEl: HTMLDivElement | null = null;
    private rodaNativa?: (e: WheelEvent) => void;
    renderVals(): Escopo { return {}; }
    private guardarRaiz = (el: HTMLDivElement | null) => {
      // o zoom pela roda do mouse precisa de preventDefault, que o React não permite (ouvinte passivo)
      if (this.raizEl && this.rodaNativa) this.raizEl.removeEventListener('wheel', this.rodaNativa);
      this.raizEl = el;
      if (el) {
        this.rodaNativa = (e) => { if ((e.target as Element | null)?.closest?.('.vista')) e.preventDefault(); };
        el.addEventListener('wheel', this.rodaNativa, { passive: false });
      }
    };
    render() {
      const vals = this.renderVals();
      const apres = !!(this.state && (this.state as { apres?: boolean }).apres);
      return createElement('div', { className: 'prancheta-dc' + (apres ? ' prancheta-dc--apres' : ''), ref: this.guardarRaiz }, ...montar(molde, [vals]));
    }
  };
}
