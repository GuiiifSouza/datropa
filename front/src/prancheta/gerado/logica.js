// GERADO por scripts/exportar_prancheta.py a partir do protótipo (src/prancheta/fonte/Main.dc.html).
// Não edite aqui: mude o protótipo e rode o script de novo.
/* eslint-disable */
export function criarPrancheta(DCLogic, AMB) {

// mapas com vetor: tamanho do SVG, imagem estilizada, posição das letras dos sites e escala da gold (mapas.sql)
// raio da área clicada no mapa de calor (fração da largura do mapa)
var RAIO_AREA = 0.035;
var CHAVE_JOGADAS = 'dt-prancheta-jogadas';
// código da jogada: o JSON do plano em base64 (sem servidor; quem recebe cola e abre)
// DT1: JSON em base64. DT2: JSON comprimido (deflate-raw) em base64url, bem mais curto no link.
function paraCodigo(obj) { return 'DT1.' + btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); }
function bytesB64url(b) { var t = ''; for (var i = 0; i < b.length; i += 0x8000) t += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(t).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64urlBytes(t) { var x = atob(t.replace(/-/g, '+').replace(/_/g, '/')), b = new Uint8Array(x.length); for (var i = 0; i < x.length; i++) b[i] = x.charCodeAt(i); return b; }
function passarPor(fluxo, bytes) { return new Response(new Blob([bytes]).stream().pipeThrough(fluxo)).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
// versão comprimida do código; sem CompressionStream (ou se não ficar menor) fica o DT1
function paraCodigoCurto(obj) {
  var dt1 = paraCodigo(obj);
  if (typeof CompressionStream === 'undefined') return Promise.resolve(dt1);
  return Promise.resolve().then(function () { return passarPor(new CompressionStream('deflate-raw'), new TextEncoder().encode(JSON.stringify(obj))); })
    .then(function (b) { var c = 'DT2.' + bytesB64url(b); return encodeURIComponent(c).length < encodeURIComponent(dt1).length ? c : dt1; })
    .catch(function () { return dt1; });
}
// lê DT1 ou DT2; devolve uma Promise com a jogada (ou null se o código não abrir)
function lerCodigo(txt) {
  var s = String(txt || '').trim();
  if (s.indexOf('DT2.') !== 0) return Promise.resolve(deCodigo(s));
  if (typeof DecompressionStream === 'undefined') return Promise.resolve(null);
  return Promise.resolve().then(function () { return passarPor(new DecompressionStream('deflate-raw'), b64urlBytes(s.slice(4))); })
    .then(function (b) { return JSON.parse(new TextDecoder().decode(b)); })
    .catch(function () { return null; });
}
// link acima disso o Firebase Hosting recusa (414, perto de 8.150 caracteres)
var LIMITE_LINK = 8000;
// confere a jogada que veio de link, código ou do navegador; devolve uma cópia limpa ou null
function normalizarJogada(j) {
  if (!j || typeof j !== 'object' || !MAPA_INFO[j.mapa] || !Array.isArray(j.etapas)) return null;
  var num = function (v) { return typeof v === 'number' && isFinite(v); };
  var obj = function (o) { return !!o && typeof o === 'object' && !Array.isArray(o); };
  var ponto = function (q) { return Array.isArray(q) && q.length >= 2 && num(q[0]) && num(q[1]); };
  var lista = function (l) { return Array.isArray(l) ? l.filter(obj) : []; };
  var etapas = j.etapas.filter(obj).map(function (e, i) {
    var et = { nome: typeof e.nome === 'string' && e.nome ? e.nome : 'Etapa ' + (i + 1), tempo: typeof e.tempo === 'string' ? e.tempo : '',
      pecas: lista(e.pecas).filter(function (o) { return num(o.x) && num(o.y); }),
      marcas: lista(e.marcas).filter(function (o) { return num(o.x) && num(o.y); }),
      tracos: lista(e.tracos).filter(function (o) { return Array.isArray(o.pts) && o.pts.length && o.pts.every(ponto); }),
      textos: lista(e.textos).filter(function (o) { return num(o.x) && num(o.y) && num(o.w) && num(o.h); }) };
    return Object.assign({}, e, et);
  });
  if (!etapas.length) return null;
  return { nome: typeof j.nome === 'string' ? j.nome : '', mapa: j.mapa, lado: j.lado === 'defesa' ? 'defesa' : 'ataque', etapas: JSON.parse(JSON.stringify(etapas)) };
}
var BASE_LINK = AMB.baseLink || 'https://datropa.web.app/prancheta';
function paraLink(codigo, soVer) { return BASE_LINK + '?j=' + encodeURIComponent(codigo) + (soVer ? '&modo=ver' : ''); }
// aceita link (…?j=DT1…&modo=ver) ou o código puro; devolve { codigo, soVer }
function lerLinkOuCodigo(txt) {
  var s = String(txt || '').trim(), q = s.indexOf('?');
  if (q < 0 || s.indexOf('j=') < 0) return { codigo: s, soVer: false };
  var cod = '', ver = false;
  s.slice(q + 1).split('#')[0].split('&').forEach(function (par) {
    var i = par.indexOf('='), k = i < 0 ? par : par.slice(0, i), v = i < 0 ? '' : par.slice(i + 1);
    try { v = decodeURIComponent(v); } catch (e) {}
    if (k === 'j') cod = v; else if (k === 'modo' && v === 'ver') ver = true;
  });
  return { codigo: cod, soVer: ver };
}
AMB.decodificar = function (t) { var l = lerLinkOuCodigo(t); return lerCodigo(l.codigo).then(function (j) { return { jogada: j, soVer: l.soVer }; }); };
function deCodigo(txt) { var s = String(txt || '').trim(); if (s.indexOf('DT1.') !== 0) return null; try { return JSON.parse(decodeURIComponent(escape(atob(s.slice(4))))); } catch (e) { return null; } }
// cores do lápis (tokens do site: giz, vermelho, âmbar, menta, alerta) + roxo para destacar
var CORES_LAPIS = [['#ECE8E1', 'Branco'], ['#FF4655', 'Vermelho'], ['#F9A23B', 'Âmbar'], ['#32E0C4', 'Menta'], ['#F5E36B', 'Amarelo'], ['#9B8CFF', 'Roxo']];
// arte de capa de cada mapa (janela Nova estratégia)
var ARTE_MAPA = { lotus: '/arte/prancheta/banners/lotus.webp', haven: '/arte/prancheta/banners/haven.webp', ascent: '/arte/prancheta/banners/ascent.webp', breeze: '/arte/prancheta/banners/breeze.webp', fracture: '/arte/prancheta/banners/fracture.webp' };
var MAPA_INFO = {
  lotus: { nome: 'Lotus', cor: '#8A4F6E', w: 897.6, h: 797.19, coef: 0.000072, lados: { ataque: { img: '/arte/prancheta/mapas/lotus-ataque.svg', T: [1, 0, 0, 1, 0, 0], w: 897.6, h: 797.19 }, defesa: { img: '/arte/prancheta/mapas/lotus-defesa.svg', T: [-1, 0, 0, -1, 897.6, 797.19], w: 897.6, h: 797.19 } },
    sitios: [{ t: 'A', x: 838.2, y: 169.4 }, { t: 'B', x: 419.3, y: 284.8 }, { t: 'C', x: 77.6, y: 343.6 }] },
  haven: { nome: 'Haven', cor: '#5E5070', w: 956.58, h: 858.07, coef: 0.000075, lados: { ataque: { img: '/arte/prancheta/mapas/haven-ataque.svg', T: [0, 1, -1, 0, 858.07, 0], w: 858.07, h: 956.58 }, defesa: { img: '/arte/prancheta/mapas/haven-defesa.svg', T: [0, -1, 1, 0, 0, 956.58], w: 858.07, h: 956.58 } },
    sitios: [{ t: 'A', x: 321.5, y: 42.2 }, { t: 'B', x: 335.5, y: 419.6 }, { t: 'C', x: 302.9, y: 826.3 }] },
  ascent: { nome: 'Ascent', cor: '#3E5C7A', w: 1024, h: 1024, coef: 0.00007, lados: { ataque: { img: '/arte/prancheta/mapas/ascent-ataque.svg', T: [1, 0, 0, 1, 0, 0], w: 1024, h: 1024 }, defesa: { img: '/arte/prancheta/mapas/ascent-defesa.svg', T: [-1, 0, 0, -1, 1024, 1024], w: 1024, h: 1024 } },
    sitios: [{ t: 'A', x: 861.9, y: 326.9 }, { t: 'B', x: 174.6, y: 232.3 }] },
  breeze: { nome: 'Breeze', cor: '#2B747A', w: 960.09, h: 941.87, coef: 0.00007, lados: { ataque: { img: '/arte/prancheta/mapas/breeze-ataque.svg', T: [1, 0, 0, 1, 0, 0], w: 960.09, h: 941.87 }, defesa: { img: '/arte/prancheta/mapas/breeze-defesa.svg', T: [-1, 0, 0, -1, 960.09, 941.87], w: 960.09, h: 941.87 } },
    sitios: [{ t: 'A', x: 818.7, y: 415.8 }, { t: 'B', x: 87.9, y: 238.7 }] },
  fracture: { nome: 'Fracture', cor: '#665636', w: 1024, h: 1024, coef: 0.000078, lados: { ataque: { img: '/arte/prancheta/mapas/fracture-ataque.svg', T: [1, 0, 0, 1, 0, 0], w: 1024, h: 1024 }, defesa: { img: '/arte/prancheta/mapas/fracture-defesa.svg', T: [-1, 0, 0, -1, 1024, 1024], w: 1024, h: 1024 } },
    sitios: [{ t: 'A', x: 868.9, y: 469.7 }, { t: 'B', x: 89.8, y: 493.2 }] }
};
var W = MAPA_INFO.lotus.w, H = MAPA_INFO.lotus.h;
// vista (lado escolhido): VT leva do espaço canônico para o desenho do lado; VW/VH são as medidas desse desenho
var VT = [1, 0, 0, 1, 0, 0], VW = W, VH = H;
function paraVista(x, y) { return [VT[0] * x + VT[2] * y + VT[4], VT[1] * x + VT[3] * y + VT[5]]; }
function daVista(x, y) { var a = VT[0], b = VT[1], c = VT[2], d = VT[3], det = a * d - b * c, X = x - VT[4], Y = y - VT[5]; return [(d * X - c * Y) / det, (-b * X + a * Y) / det]; }
function fmtT(ms) { var t = Math.round((ms || 0) / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
// mesma regra do ECONOMIA.md do time: pistol nos rounds 1 e 13; eco < 10.000; força < 20.000; full a partir disso
function tipoCompra(v, n) { return (n === 1 || n === 13) ? 'pistol' : (v < 10000 ? 'eco' : (v < 20000 ? 'forca' : 'full')); }
// tamanho padrão da letra das anotações, em unidades do mapa
var TAM_LETRA_NOTA = 12;
function etapaVazia() { return [{ nome: 'Etapa 1', tempo: '0:00', pecas: [], marcas: [], tracos: [], textos: [] }]; }
var ABERTURA = { largo: 100 * Math.PI / 180, estreito: 36 * Math.PI / 180, linha: 0 };
var ALCANCE = { largo: 520, estreito: 900, linha: 1200 };
var RAIOS = { largo: 72, estreito: 36, linha: 1 };

// obs = { segs: [[x1,y1,x2,y2]...], circ: [[cx,cy,r]...], sig: '...' }  (paredes do mapa + habilidades que bloqueiam visão)
function raio(obs, x, y, a, alc) {
  var dx = Math.cos(a), dy = Math.sin(a), t = alc;
  var segs = obs && obs.segs, circ = obs && obs.circ;
  if (segs) {
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i], ex = s[2] - s[0], ey = s[3] - s[1];
      var den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      var qx = s[0] - x, qy = s[1] - y;
      var t1 = (qx * ey - qy * ex) / den;
      var u = (qx * dy - qy * dx) / den;
      if (t1 > 0.5 && u >= 0 && u <= 1 && t1 < t) t = t1;
    }
  }
  if (circ) {
    for (var j = 0; j < circ.length; j++) {
      var c = circ[j], fx = x - c[0], fy = y - c[1];
      var cc = fx * fx + fy * fy - c[2] * c[2];
      if (cc < 0) continue; // quem está dentro da fumaça não é bloqueado por ela
      var b = fx * dx + fy * dy, disc = b * b - cc;
      if (disc < 0) continue;
      var t2 = -b - Math.sqrt(disc);
      if (t2 > 0.5 && t2 < t) t = t2;
    }
  }
  return [x + dx * t, y + dy * t];
}

function conePath(obs, x, y, ang, ab, alc, n) {
  var d = 'M' + x.toFixed(1) + ' ' + y.toFixed(1);
  for (var i = 0; i <= n; i++) {
    var q = raio(obs, x, y, ang - ab / 2 + ab * i / n, alc);
    d += 'L' + q[0].toFixed(1) + ' ' + q[1].toFixed(1);
  }
  return d + 'Z';
}

function cone(obs, x, y, ang, forma) {
  if (forma === 'linha') {
    var p = raio(obs, x, y, ang, ALCANCE.linha);
    return 'M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
  }
  return conePath(obs, x, y, ang, ABERTURA[forma], ALCANCE[forma], RAIOS[forma]);
}

var CACHE = {}, CACHE_N = 0;
function coneC(segs, x, y, ang, forma) {
  var k = (segs ? segs.sig : '0') + '|' + forma + '|' + x.toFixed(1) + '|' + y.toFixed(1) + '|' + ang.toFixed(3);
  if (CACHE[k]) return CACHE[k];
  if (CACHE_N > 400) { CACHE = {}; CACHE_N = 0; }
  CACHE_N++;
  return (CACHE[k] = cone(segs, x, y, ang, forma));
}

function pct(x, y) { var v = paraVista(x, y); return { x: (v[0] / VW * 100).toFixed(2), y: (v[1] / VH * 100).toFixed(2) }; }

var UP = -Math.PI / 2;
function inimigosBase() {
  return [
    { id: 'i1', tipo: 'agente', time: 'in', ag: 'reyna', x: 870, y: 240, ang: Math.PI },
    { id: 'i2', tipo: 'agente', time: 'in', ag: 'cypher', x: 810, y: 170, ang: 1.9 },
    { id: 'i3', tipo: 'agente', time: 'in', ag: 'viper', x: 470, y: 320, ang: 0.2 },
    { id: 'i4', tipo: 'agente', time: 'in', ag: 'sage', x: 60, y: 360, ang: 0 },
    { id: 'i5', tipo: 'agente', time: 'in', ag: 'fade', x: 560, y: 240, ang: 0.4 }
  ];
}
function aliados(pos, angs) {
  var ags = ['jett', 'sova', 'omen', 'breach', 'killjoy'];
  return pos.map(function (p, i) { return { id: 'a' + (i + 1), tipo: 'agente', time: 'al', ag: ags[i], x: p[0], y: p[1], ang: angs[i] }; });
}
function etapasIniciais() {
  const ets = [
    { nome: 'Posição inicial', tempo: '0:00', pecas: aliados([[440, 740], [480, 760], [520, 740], [460, 710], [530, 705]], [UP, UP, UP, UP, UP]).concat(inimigosBase()), marcas: [], tracos: [], textos: [] },
    { nome: 'Avanço pela direita', tempo: '0:20', pecas: aliados([[700, 530], [730, 540], [760, 520], [690, 500], [800, 530]], [-1.2, -1.4, -1.6, -1.1, -2.0]).concat(inimigosBase()),
      marcas: [{ id: 'm1', tipo: 'marca', icone: 'alerta', x: 745, y: 380, nota: 'Cypher costuma segurar aqui' }, { id: 'm2', tipo: 'hab', tecla: 'E', ag: 'omen', time: 'al', dono: 'a3', x: 800, y: 300 }, { id: 'm6', tipo: 'hab', tecla: 'Q', ag: 'sova', time: 'al', dono: 'a2', x: 830, y: 230 },
               { id: 'm7', tipo: 'hab', tecla: 'C', ag: 'cypher', time: 'in', dono: 'i2', x: 782, y: 262, ang: 0 }],
      tracos: [{ id: 't1', kind: 'seta', pts: [[720, 495], [785, 345]] }], textos: [] },
    { nome: 'Entrada no site A', tempo: '0:35', pecas: aliados([[815, 215], [840, 262], [790, 330], [780, 300], [830, 300]], [-0.6, -1.4, -1.6, -2.2, -1.2]).concat(inimigosBase()),
      marcas: [{ id: 'm3', tipo: 'marca', icone: 'spike', x: 855, y: 230, nota: 'plant padrão' }, { id: 'm4', tipo: 'marca', icone: 'ancora', x: 745, y: 380 }],
      tracos: [], textos: [{ id: 'x1', x: 610, y: 432, w: 170, h: 36, txt: 'segura o retake do meio' }] }
  ];
  ets[1].pecas[2].nota = 'smoke no site antes de subir';
  ets[1].pecas[1].nota = 'flecha pra limpar o fundo';
  ets[2].pecas[0].nota = 'entra depois do flash';
  ets[2].pecas[4].nota = 'segura o flanco';
  return ets;
}

var EVENTOS = [
  { t: '0:21', tipo: 'Abate', desc: 'A2 abateu B3 no meio', x: 'marca', vx: 745, vy: 380,
    j: [['a', 'A1', 700, 530, -1.2], ['a', 'A2', 740, 460, -1.5], ['a', 'A3', 760, 520, -1.6], ['a', 'A4', 690, 500, -1.0], ['a', 'A5', 800, 530, -2.0],
        ['b', 'B1', 870, 240, 3.0], ['b', 'B2', 810, 170, 1.9], ['b', 'B3', 745, 380, 1.9, 1], ['b', 'B4', 470, 320, 0.2], ['b', 'B5', 560, 240, 0.4]] },
  { t: '0:34', tipo: 'Abate', desc: 'B1 abateu A3 na entrada do A', x: 'marca', vx: 790, vy: 330,
    j: [['a', 'A1', 745, 380, -1.3], ['a', 'A2', 740, 460, -1.4], ['a', 'A3', 790, 330, -1.5, 1], ['a', 'A4', 700, 400, -1.0], ['a', 'A5', 760, 520, -1.6],
        ['b', 'B1', 870, 240, 2.3], ['b', 'B2', 810, 170, 1.9], ['b', 'B4', 470, 320, 0.2], ['b', 'B5', 560, 240, 0.4]] },
  { t: '0:52', tipo: 'Plant', desc: 'A4 plantou no site A', x: 'marca plant', vx: 840, vy: 262,
    j: [['a', 'A1', 815, 215, -0.5], ['a', 'A2', 830, 300, 0.0], ['a', 'A4', 840, 262, -1.6], ['a', 'A5', 780, 300, -2.6],
        ['b', 'B4', 700, 300, 0.1], ['b', 'B5', 760, 230, 0.0]] },
  { t: '1:18', tipo: 'Abate', desc: 'A1 abateu B5 no retake', x: 'marca', vx: 760, vy: 230,
    j: [['a', 'A1', 815, 215, 3.0], ['a', 'A2', 830, 300, -2.5], ['a', 'A5', 780, 300, -2.0],
        ['b', 'B4', 700, 300, 0.1], ['b', 'B5', 760, 230, 0.0, 1]] }
];

var MAPAS = [
  ['Abyss', '#252A3D'], ['Ascent', '#3E5C7A'], ['Bind', '#7E6038'], ['Breeze', '#2B747A'], ['Corrode', '#5A4A40'],
  ['Fracture', '#665636'], ['Haven', '#5E5070'], ['Icebox', '#3A6683'], ['Lotus', '#8A4F6E'], ['Pearl', '#2E5A78'],
  ['Split', '#56636E'], ['Summit', '#7E6048'], ['Sunset', '#9A5A28']
];

// ordem = ordem do sprite (alfabética). habilidades na ordem C, Q, E, X (grenade, ability1, ability2, ultimate)
var AGENTES = [
  ['astra', 'Astra', 'Controlador', ['Gravity Well', 'Nova Pulse', 'Nebula', 'Cosmic Divide']], ['breach', 'Breach', 'Iniciador', ['Pós-choque', 'Estopim', 'Falha Tectônica', 'Onda Trovejante']],
  ['brimstone', 'Brimstone', 'Controlador', ['Stim Beacon', 'Incendiary', 'Sky Smoke', 'Orbital Strike']], ['chamber', 'Chamber', 'Sentinela', ['Marca Registrada', 'Caçador de Cabeças', 'Rendezvous', 'Tour de Force']],
  ['clove', 'Clove', 'Controlador', ['Pick-Me-Up', 'Meddle', 'Ruse', 'Not Dead Yet']], ['cypher', 'Cypher', 'Sentinela', ['Fio-armadilha', 'Jaula Cibernética', 'Câmera de Vigilância', 'Assalto Neural']],
  ['deadlock', 'Deadlock', 'Sentinela', ['Barreira de Contenção', 'Sensor Sônico', 'GravNet', 'Aniquilação']], ['fade', 'Fade', 'Iniciador', ['Espreitador', 'Clausura', 'Assombrar', 'Véu da Noite']],
  ['gekko', 'Gekko', 'Iniciador', ['Mosh Pit', 'Wingman', 'Dizzy', 'Thrash']], ['harbor', 'Harbor', 'Controlador', ['Temporal', 'Maré Alta', 'Enseada', 'Acerto de Contas']],
  ['iso', 'Iso', 'Duelista', ['Contingency', 'Undercut', 'Double Tap', 'Kill Contract']], ['jett', 'Jett', 'Duelista', ['Cloudburst', 'Updraft', 'Tailwind', 'Blade Storm']], ['kay-o', 'KAY/O', 'Iniciador', ['FRAG/mento', 'GRANADA/clarão', 'PONTO/zero', 'ANULAR/cmd']],
  ['killjoy', 'Killjoy', 'Sentinela', ['Nanoenxame', 'Robô de Alarme', 'Torreta', 'Confinamento']], ['miks', 'Miks', 'Controlador', ['Pulso M', 'Harmonia', 'Ressonância', 'Melodia Sísmica']],
  ['neon', 'Neon', 'Duelista', ['Fast Lane', 'Relay Bolt', 'High Gear', 'Overdrive']], ['omen', 'Omen', 'Controlador', ['Shrouded Step', 'Paranoia', 'Dark Cover', 'From the Shadows']], ['phoenix', 'Phoenix', 'Duelista', ['Labareda', 'Mãos Quentes', 'Bola Curva', 'Renascimento']],
  ['raze', 'Raze', 'Duelista', ['Bumba', 'Carga de Explosivos', 'Cartuchos de Tinta', 'Estraga-prazeres']], ['reyna', 'Reyna', 'Duelista', ['Leer', 'Devour', 'Dismiss', 'Empress']],
  ['sage', 'Sage', 'Sentinela', ['Barrier Orb', 'Slow Orb', 'Healing Orb', 'Resurrection']], ['skye', 'Skye', 'Iniciador', ['Reflorescer', 'Predador Explosivo', 'Luz Desbravadora', 'Rastreadores']],
  ['sova', 'Sova', 'Iniciador', ['Drone Coruja', 'Flecha de Choque', 'Flecha Rastreadora', 'Fúria do Caçador']], ['tejo', 'Tejo', 'Iniciador', ['Drone Furtivo', 'Rajada Guiada', 'Entrega Especial', 'Armagedom']],
  ['veto', 'Veto', 'Sentinela', ['Travessia', 'Imobilidade', 'Interceptador', 'Evolução']], ['viper', 'Viper', 'Controlador', ['Veneno de Cobra', 'Nuvem Venenosa', 'Cortina Tóxica', 'Poço Peçonhento']],
  ['vyse', 'Vyse', 'Sentinela', ['Espinheiro Cortante', 'Cerca-Viva', 'Rosa Arcana', 'Jardim de Aço']], ['waylay', 'Waylay', 'Duelista', ['Saturate', 'Lightspeed', 'Refract', 'Convergent Paths']], ['yoru', 'Yoru', 'Duelista', ['Fakeout', 'Blindside', 'Gatecrash', 'Dimensional Drift']]
];
var IDX = {};
AGENTES.forEach(function (a, i) { IDX[a[0]] = i; });
var TECLAS = ['C', 'Q', 'E', 'X'];
function bpAg(slug) { var i = IDX[slug] || 0; return (i % 6) / 5 * 100 + '% ' + Math.floor(i / 6) / 4 * 100 + '%'; }
function bpHab(slug, tecla) { var i = IDX[slug] || 0; return TECLAS.indexOf(tecla) / 3 * 100 + '% ' + i / (AGENTES.length - 1) * 100 + '%'; }
function nomeAg(slug) { var a = AGENTES[IDX[slug]]; return a ? a[1] : slug; }
function nomeHab(slug, tecla) { var a = AGENTES[IDX[slug]]; var k = TECLAS.indexOf(tecla); return a && a[3] ? a[3][k] : 'Habilidade ' + tecla; }
// Escala: Lotus na gold (mapas.sql) = 0.000072 da imagem por unidade do jogo; 1 m = 100 unidades.
// Supõe que o SVG cobre a mesma área da imagem validada pelo chico (a conferir com 3 plants).
var M = MAPA_INFO.lotus.coef * 100 * W; // recalculado ao trocar de mapa

// Ficha de cada habilidade (medidas APROXIMADAS, em metros — conferir no jogo/wiki).
// forma: circulo {r} | parede {comp, max, fixo} | faixa {larg, comp} | cone {ab (graus), alc} | linha {max} | icone
// alc = alcance de lançamento em metros a partir do agente (null = sem limite útil); bloq = bloqueia visão; atravessa = ignora paredes
var HAB_FORMAS = {
  omen: { C: { f: 'icone', alc: 12 }, Q: { f: 'faixa', larg: 4, comp: 30 }, E: { f: 'circulo', r: 4.1, alc: 50, bloq: true }, X: { f: 'icone' } },
  brimstone: { C: { f: 'circulo', r: 6, alc: 10 }, Q: { f: 'circulo', r: 4.5, alc: 25 }, E: { f: 'circulo', r: 4.15, alc: 50, bloq: true }, X: { f: 'circulo', r: 9 } },
  viper: { C: { f: 'circulo', r: 4.5, alc: 25 }, Q: { f: 'circulo', r: 4.5, alc: 30, bloq: true }, E: { f: 'parede', comp: 40, max: 60, bloq: true }, X: { f: 'circulo', r: 12, bloq: true } },
  astra: { C: { f: 'circulo', r: 4.75 }, Q: { f: 'circulo', r: 4.75 }, E: { f: 'circulo', r: 4.75, bloq: true }, X: { f: 'parede', comp: 100, max: 140, bloq: true } },
  harbor: { C: { f: 'faixa', larg: 7.5, comp: 30, bloq: true }, Q: { f: 'circulo', r: 4.5, alc: 30, bloq: true }, E: { f: 'parede', comp: 35, max: 50, bloq: true, curva: true }, X: { f: 'faixa', larg: 18, comp: 40 } },
  clove: { C: { f: 'icone' }, Q: { f: 'circulo', r: 6, alc: 20 }, E: { f: 'circulo', r: 4, alc: 50, bloq: true }, X: { f: 'icone' } },
  sova: { C: { f: 'icone' }, Q: { f: 'circulo', r: 4, alc: 30 }, E: { f: 'circulo', r: 30, alc: 40 }, X: { f: 'faixa', larg: 4, comp: 66, atravessa: true } },
  breach: { C: { f: 'faixa', larg: 4, comp: 5, atravessa: true }, Q: { f: 'icone', alc: 20 }, E: { f: 'faixa', larg: 6, comp: 30, atravessa: true }, X: { f: 'cone', ab: 60, alc: 32, atravessa: true } },
  fade: { C: { f: 'icone' }, Q: { f: 'circulo', r: 6.5, alc: 30 }, E: { f: 'circulo', r: 30, alc: 30 }, X: { f: 'faixa', larg: 30, comp: 40, atravessa: true } },
  killjoy: { C: { f: 'circulo', r: 4.5, alc: 15 }, Q: { f: 'circulo', r: 5.5 }, E: { f: 'cone', ab: 100, alc: 30 }, X: { f: 'circulo', r: 32.5 } },
  cypher: { C: { f: 'linha', max: 15 }, Q: { f: 'circulo', r: 3.6, bloq: true }, E: { f: 'cone', ab: 100, alc: 40 }, X: { f: 'icone' } },
  sage: { C: { f: 'parede', comp: 10.4, max: 10.4, fixo: true, bloq: true }, Q: { f: 'circulo', r: 6, alc: 25 }, E: { f: 'icone' }, X: { f: 'icone' } },
  // demais agentes (mesma lógica: medidas aproximadas para planejamento)
  chamber: { C: { f: 'circulo', r: 6.5, alc: 15 }, Q: { f: 'icone' }, E: { f: 'circulo', r: 15, alc: 20 }, X: { f: 'icone' } },
  deadlock: { C: { f: 'parede', comp: 10, max: 10, fixo: true, bloq: true }, Q: { f: 'cone', ab: 100, alc: 12 }, E: { f: 'circulo', r: 6, alc: 30 }, X: { f: 'linha', max: 40 } },
  gekko: { C: { f: 'circulo', r: 6, alc: 25 }, Q: { f: 'icone', alc: 20 }, E: { f: 'cone', ab: 60, alc: 20 }, X: { f: 'icone', alc: 30 } },
  'kay-o': { C: { f: 'circulo', r: 5, alc: 25 }, Q: { f: 'icone', alc: 20 }, E: { f: 'circulo', r: 15, alc: 30, atravessa: true }, X: { f: 'circulo', r: 42 } },
  miks: { C: { f: 'icone', alc: 20 }, Q: { f: 'circulo', r: 5, alc: 25 }, E: { f: 'circulo', r: 4.5, alc: 40, bloq: true }, X: { f: 'faixa', larg: 10, comp: 40 } },
  phoenix: { C: { f: 'parede', comp: 18, max: 18, fixo: true, bloq: true, curva: true }, Q: { f: 'icone', alc: 15 }, E: { f: 'circulo', r: 4.5, alc: 20 }, X: { f: 'icone' } },
  raze: { C: { f: 'faixa', larg: 2, comp: 30 }, Q: { f: 'circulo', r: 4, alc: 20 }, E: { f: 'circulo', r: 7, alc: 20 }, X: { f: 'circulo', r: 7, alc: 40 } },
  skye: { C: { f: 'circulo', r: 18 }, Q: { f: 'icone', alc: 30 }, E: { f: 'icone', alc: 30 }, X: { f: 'icone' } },
  tejo: { C: { f: 'icone', alc: 30 }, Q: { f: 'circulo', r: 4, alc: 40 }, E: { f: 'circulo', r: 5, alc: 30 }, X: { f: 'faixa', larg: 10, comp: 50 } },
  veto: { C: { f: 'icone', alc: 20 }, Q: { f: 'circulo', r: 6, alc: 20 }, E: { f: 'circulo', r: 12, alc: 20 }, X: { f: 'icone' } },
  vyse: { C: { f: 'circulo', r: 6, alc: 15 }, Q: { f: 'parede', comp: 9, max: 9, fixo: true, bloq: true }, E: { f: 'icone', alc: 20 }, X: { f: 'circulo', r: 30 } },
  iso: { C: { f: 'parede', comp: 6, max: 6, fixo: true, bloq: true }, Q: { f: 'faixa', larg: 2, comp: 30, atravessa: true }, E: { f: 'icone' }, X: { f: 'faixa', larg: 6, comp: 40 } },
  jett: { C: { f: 'circulo', r: 3.4, alc: 20, bloq: true }, Q: { f: 'icone' }, E: { f: 'icone' }, X: { f: 'icone' } },
  neon: { C: { f: 'faixa', larg: 6, comp: 40, bloq: true }, Q: { f: 'circulo', r: 5, alc: 25 }, E: { f: 'icone' }, X: { f: 'icone' } },
  reyna: { C: { f: 'icone', alc: 10 }, Q: { f: 'icone' }, E: { f: 'icone' }, X: { f: 'icone' } },
  waylay: { C: { f: 'circulo', r: 5, alc: 20 }, Q: { f: 'linha', max: 15 }, E: { f: 'icone' }, X: { f: 'faixa', larg: 10, comp: 40 } },
  yoru: { C: { f: 'icone', alc: 20 }, Q: { f: 'icone', alc: 20 }, E: { f: 'linha', max: 30 }, X: { f: 'icone' } }
};
// cor de cada agente pra identificar a habilidade no mapa (o aro mostra o time)
var COR_AG = { omen: '#3B2A6B', brimstone: '#8A5A3A', viper: '#3E8F4A', astra: '#5B3FA8', harbor: '#1F7A8C', clove: '#C2577F',
  sova: '#3E6FB0', breach: '#C0612B', fade: '#2F4F5A', killjoy: '#D4B02A', cypher: '#C9CED6', sage: '#3FB8B0',
  chamber: '#B8964A', deadlock: '#7F96A8', gekko: '#7FBF3F', 'kay-o': '#4A67C9', miks: '#B05AD6', phoenix: '#E0702A', raze: '#E89A2E',
  skye: '#5FA35A', tejo: '#C7A06A', veto: '#5A6E8C', vyse: '#8C5AA8', iso: '#6A5ACD', jett: '#8FC7E8', neon: '#2F7FE0', reyna: '#9B3FA8',
  waylay: '#E86AA0', yoru: '#2A4FB8' };
function hexA(h, a) { var n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
var NOME_MK = { spike: 'Spike', pino: 'Pino', alerta: 'Alerta', bandeira: 'Bandeira', ancora: 'Âncora', mira: 'Mira', estrela: 'Estrela' };
var NOME_VISAO = { largo: 'Visão larga', estreito: 'Visão estreita', linha: 'Linha de tiro' };
function nomeMarca(m) { return m.tipo === 'visao' ? (NOME_VISAO[m.forma] || 'Visão') : (NOME_MK[m.icone] || 'Marcador'); }
function ficha(ag, tecla) { return (HAB_FORMAS[ag] && HAB_FORMAS[ag][tecla]) || { f: 'icone' }; }
function circPath(cx, cy, r) { return 'M' + (cx - r).toFixed(1) + ' ' + cy.toFixed(1) + 'a' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 1 0 ' + (2 * r).toFixed(1) + ' 0a' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 1 0 ' + (-2 * r).toFixed(1) + ' 0Z'; }
function retPath(ax, ay, ang, comp, larg) {
  var dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy * larg / 2, ny = dx * larg / 2, bx = ax + dx * comp, by = ay + dy * comp;
  return 'M' + (ax + nx).toFixed(1) + ' ' + (ay + ny).toFixed(1) + 'L' + (bx + nx).toFixed(1) + ' ' + (by + ny).toFixed(1) + 'L' + (bx - nx).toFixed(1) + ' ' + (by - ny).toFixed(1) + 'L' + (ax - nx).toFixed(1) + ' ' + (ay - ny).toFixed(1) + 'Z';
}
// parede que faz curva (Phoenix, Harbor): curv = quanto o meio sai da reta, em unidades do mapa (+ ou - para cada lado)
function curvaParede(h) {
  var pp = pontasParede(h), nx = -Math.sin(h.ang), ny = Math.cos(h.ang), c = h.curv || 0;
  return { a: pp[0], b: pp[1], ctrl: [h.x + nx * 2 * c, h.y + ny * 2 * c], pico: [h.x + nx * c, h.y + ny * c], n: [nx, ny] };
}
function pontosCurva(h, n) {
  var k = curvaParede(h), out = [];
  for (var i = 0; i <= n; i++) { var u = i / n, v = 1 - u; out.push([v * v * k.a[0] + 2 * v * u * k.ctrl[0] + u * u * k.b[0], v * v * k.a[1] + 2 * v * u * k.ctrl[1] + u * u * k.b[1]]); }
  return out;
}
function pontasParede(h) {
  var meio = h.comp * M / 2, dx = Math.cos(h.ang), dy = Math.sin(h.ang);
  return [[h.x - dx * meio, h.y - dy * meio], [h.x + dx * meio, h.y + dy * meio]];
}

var AG_ROUND = { A1: 'jett', A2: 'sova', A3: 'omen', A4: 'breach', A5: 'killjoy', B1: 'reyna', B2: 'cypher', B3: 'viper', B4: 'sage', B5: 'fade' };

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { modo: 'planejar', lado: 'ataque', time: 'al', agSel: 'omen', funcao: 'Todos', etapa: 0, etapas: etapasIniciais(), hist: [], sel: null, ferramenta: 'mover', drag: null,
      round: 7, evento: 0, tipoCalor: 'abates', tocando: false, visao: false, mapa: 'lotus', paredes: null, reais: {}, partida: 0, listaPartidas: false, listaTimes: false, calorTime: '', futuro: [], ajuda: false, sels: [], mini: false, mira: null, fantasma: null, abaEsq: 'agentes', abaDir: 'etapas', apres: false, z: 1, ox: 0, oy: 0, mapaAberto: false, segs: null, seq: 1 };
    this.timer = null;
  }
  setState(patch, cb) {
    // escolher um item sozinho (sel) sempre desfaz a seleção múltipla (sels)
    if (patch && typeof patch === 'object' && Object.prototype.hasOwnProperty.call(patch, 'sel') && !Object.prototype.hasOwnProperty.call(patch, 'sels')) patch = Object.assign({}, patch, { sels: [] });
    return super.setState(patch, cb);
  }
  abrirEventoCalor(a) {
    this.pararPlay();
    this.alvoCalor = a.alvo ? { mapa: this.state.mapa, partida: a.pi, round: a.ri + 1, id: a.alvo } : null;
    this.setState({ modo: 'round', partida: a.pi, round: a.ri + 1, evento: a.ei, tocando: false, fantasma: null, listaPartidas: false, z: 1, ox: 0, oy: 0 });
  }
  componentDidUpdate() {
    if (AMB.calor && this.state.modo === 'calor') AMB.calor.garantir(this.state.mapa, this.state.tipoCalor, () => this.forceUpdate());
    if (AMB.reais && this.state.modo === 'round') AMB.reais.detalhar(this.state.mapa, this.state.partida, this.state.round);
    // O round pode chegar depois do clique: selecionar pelo ID, nunca pelo segundo arredondado.
    const alvo = this.alvoCalor, s = this.state;
    if (alvo) {
      if (s.modo !== 'round' || s.mapa !== alvo.mapa || s.partida !== alvo.partida || s.round !== alvo.round) this.alvoCalor = null;
      else {
        const p = s.reais[s.mapa]?.partidas[s.partida], r = p?.rounds.find((r) => r.n === s.round);
        if (r?.ev) {
          this.alvoCalor = null;
          const i = r.ev.findIndex((e) => e[8] === alvo.id);
          if (i >= 0 && i !== s.evento) { this.setState({ evento: i }); return; }
        }
      }
    }
    if (this.state.modo !== 'round' || this.ultimoEvVisto === this.state.evento + ':' + this.state.round) return;
    this.ultimoEvVisto = this.state.evento + ':' + this.state.round;
    try {
      const lista = (this.raizEl || document).querySelector('.feed-lista'), on = lista && lista.querySelector('.item.on');
      if (on) { const a = lista.getBoundingClientRect(), b = on.getBoundingClientRect();
        if (b.top < a.top) lista.scrollTop -= a.top - b.top + 4; else if (b.bottom > a.bottom) lista.scrollTop += b.bottom - a.bottom + 4; }
    } catch (err) {}
  }

  componentDidMount() {
    fetch('/arte/prancheta/paredes.json').then(function (r) { return r.json(); })
      .then((d) => this.setState({ paredes: d })).catch(function () {});
    // vindo da tela de mapas: abre no mapa (e modo) escolhido
    let ini = null;
    try { ini = JSON.parse(localStorage.getItem('dt-prancheta-abrir') || 'null'); localStorage.removeItem('dt-prancheta-abrir'); } catch (e) {}
    if (ini && ini.mapa && MAPA_INFO[ini.mapa]) { if (ini.modo === 'round') this.trocarMapa(ini.mapa); else this.novaEstrategia(ini.mapa); }
    else this.carregarReais(this.state.mapa);
    if (ini && (ini.modo === 'round' || ini.modo === 'planejar')) this.setState({ modo: ini.modo });
    if (AMB.inicio) AMB.inicio(this);
  }
  componentWillUnmount() { this.pararPlay(); }
  pararPlay() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  togglePlay() {
    if (this.state.tocando) { this.pararPlay(); this.setState({ tocando: false }); return; }
    this.setState({ tocando: true, sel: null });
    this.timer = setInterval(() => {
      const s = this.state;
      if (s.modo === 'planejar') this.setState({ etapa: (s.etapa + 1) % s.etapas.length });
      else if (s.modo === 'round') this.setState({ evento: (s.evento + 1) % (this.nEv || 1) });
    }, 1300);
  }
  copiarTexto(txt, seletor, chave) {
    const feito = () => this.setState({ [chave]: 'Copiado!' }), falhou = () => this.setState({ [chave]: 'Selecione o texto acima e copie com Ctrl+C.' });
    let ok = false;
    try { const el = (this.raizEl || document).querySelector(seletor); if (el) { el.focus(); el.select(); el.setSelectionRange(0, txt.length); ok = document.execCommand('copy'); } } catch (e) { ok = false; }
    if (ok) { feito(); return; }
    try { navigator.clipboard.writeText(txt).then(feito, falhou); } catch (e) { falhou(); }
  }
  novoId(p) { const n = this.state.seq + 1; this.setState({ seq: n }); return p + n; }
  editar(fn, salvarHist) {
    const s = this.state;
    const etapas = s.etapas.slice();
    const et = JSON.parse(JSON.stringify(etapas[s.etapa]));
    fn(et);
    etapas[s.etapa] = et;
    const patch = { etapas: etapas };
    if (salvarHist) { patch.hist = s.hist.concat([JSON.stringify(s.etapas)]).slice(-30); patch.futuro = []; }
    this.setState(patch);
  }
  noMapa(e) {
    const m = e.currentTarget.querySelector ? e.currentTarget.querySelector('.palco') : null;
    const r = (m || e.currentTarget).getBoundingClientRect();
    return daVista((e.clientX - r.left) / r.width * VW, (e.clientY - r.top) / r.height * VH);
  }
  zoomPara(z2, cx, cy, vista) {
    const s = this.state;
    z2 = Math.min(5, Math.max(1, z2));
    if (z2 === s.z) return;
    if (z2 === 1) { this.setState({ z: 1, ox: 0, oy: 0 }); return; }
    const mundo = vista && vista.querySelector('.palco');
    if (!mundo) return;
    const r = mundo.getBoundingClientRect();
    const lx = (cx - r.left) / s.z, ly = (cy - r.top) / s.z;
    this.setState({ z: z2, ox: s.ox + (cx - lx * z2 - r.left), oy: s.oy + (cy - ly * z2 - r.top) });
  }
  carregarReais(chave) {
    // partidas reais: listadas pela API do site (AMB.reais), que vai completando os rounds aos poucos
    if (!AMB.reais || (this.state.reais && this.state.reais[chave])) return;
    AMB.reais.listar(chave, (d) => { const novo = Object.assign({}, this.state.reais); novo[chave] = d; this.setState({ reais: novo }); });
  }
  // ---- Minhas jogadas: guardadas neste navegador (localStorage) ----
  lerJogadas() { let l; try { l = JSON.parse(localStorage.getItem(CHAVE_JOGADAS) || '[]'); } catch (e) { l = this.jogadasMem || []; } return Array.isArray(l) ? l.filter((j) => j && MAPA_INFO[j.mapa] && Array.isArray(j.etapas)) : []; }
  gravarJogadas(lista) { this.jogadasMem = lista; try { localStorage.setItem(CHAVE_JOGADAS, JSON.stringify(lista)); return true; } catch (e) { return false; } }
  abrirJogada(jogada, soVer) {
    const j = normalizarJogada(jogada);
    if (!j) return false;
    this.pararPlay();
    this.salvos = this.salvos || {};
    this.carregarReais(j.mapa);
    this.setState({ mapa: j.mapa, lado: j.lado === 'defesa' ? 'defesa' : 'ataque', etapas: j.etapas, etapa: 0,
      hist: this.state.mapa === j.mapa ? this.state.hist.concat([JSON.stringify(this.state.etapas)]).slice(-30) : [], futuro: [],
      sel: null, sels: [], fantasma: null, mini: false, z: 1, ox: 0, oy: 0, modo: 'planejar', tocando: false, jogadasAberta: false, compAberta: false, mapaAberto: false,
      soVer: !!soVer, apres: !!soVer, apLapis: false, riscos: [], ferramenta: soVer ? 'mao' : this.state.ferramenta, nomeJogada: j.nome });
    return true;
  }
  // link de jogada que não abre: avisa e deixa a prancheta vazia no mapa atual
  jogadaInvalida() {
    this.pararPlay();
    this.setState({ etapas: etapaVazia(), etapa: 0, hist: [], futuro: [], sel: null, sels: [], fantasma: null, modo: 'planejar', tocando: false,
      soVer: false, apres: false, linkInvalido: true });
  }
  // troca o código da janela de compartilhar pela versão comprimida, se ela ainda mostra o mesmo
  encurtarCodigo(obj, cod) {
    paraCodigoCurto(obj).then((c) => { if (c !== cod && this.state.compAberta && this.state.compCodigo === cod) this.setState({ compCodigo: c }); });
  }
  novaEstrategia(chave) {
    // prancheta limpa no mapa escolhido (o plano anterior desse mapa é descartado)
    if (!MAPA_INFO[chave]) return;
    this.pararPlay();
    this.salvos = this.salvos || {};
    delete this.salvos[chave];
    this.carregarReais(chave);
    this.setState({ mapa: chave, etapas: etapaVazia(), etapa: 0, hist: [], futuro: [], sel: null, sels: [], fantasma: null, mini: false,
      z: 1, ox: 0, oy: 0, mapaAberto: false, novaAberta: false, tocando: false, modo: 'planejar', ferramenta: 'mover', lado: 'ataque',
      partida: 0, round: 1, evento: 0, calorTime: '', calorPt: null, listaPartidas: false, listaTimes: false, apres: false, riscos: [], apLapis: false });
  }
  trocarMapa(chave) {
    const s = this.state;
    if (chave === s.mapa || !MAPA_INFO[chave]) { this.setState({ mapaAberto: false }); return; }
    this.salvos = this.salvos || {};
    this.salvos[s.mapa] = { etapas: s.etapas, etapa: s.etapa, hist: s.hist, futuro: s.futuro };
    const v = this.salvos[chave] || { etapas: etapaVazia(), etapa: 0, hist: [], futuro: [] };
    this.pararPlay();
    this.carregarReais(chave);
    this.setState({ mapa: chave, etapas: v.etapas, etapa: v.etapa, hist: v.hist, futuro: v.futuro, sel: null, fantasma: null,
      z: 1, ox: 0, oy: 0, mapaAberto: false, tocando: false, partida: 0, round: 1, evento: 0, calorTime: '', listaPartidas: false, listaTimes: false });
  }
  acharObj(et, id) {
    return et.pecas.find(function (p) { return p.id === id; }) || et.marcas.find(function (p) { return p.id === id; });
  }
  adicionar(obj) {
    const id = this.novoId('n');
    obj.id = id;
    this.editar((et) => { (obj.tipo === 'agente' ? et.pecas : et.marcas).push(obj); }, true);
    this.setState({ sel: id, ferramenta: 'mover' });
  }
  renderVals() {
    const info = MAPA_INFO[this.state.mapa] || MAPA_INFO.lotus;
    W = info.w; H = info.h; M = info.coef * 100 * W;
    const ladoK = this.state.lado === 'defesa' ? 'defesa' : 'ataque', vis = info.lados[ladoK];
    VT = vis.T; VW = vis.w; VH = vis.h;
    const s = Object.assign({}, this.state, { segs: this.state.paredes && this.state.paredes[this.state.mapa] ? this.state.paredes[this.state.mapa].segs : null });
    const atk = s.lado === 'ataque';
    const isPlanejar = s.modo === 'planejar', isRound = s.modo === 'round', isCalor = s.modo === 'calor';
    const corAl = atk ? 'atk' : 'def', corIn = atk ? 'def' : 'atk';
    const dadosMapa = s.reais && s.reais[s.mapa];
    const partidasR = dadosMapa ? dadosMapa.partidas : [];
    const part = partidasR.length ? partidasR[Math.min(s.partida, partidasR.length - 1)] : null;
    const rodadas = part ? part.rounds : [];
    const rd = rodadas.length ? rodadas[Math.min(Math.max(s.round, 1), rodadas.length) - 1] : null;
    const nj = (i) => (part && part.jog[i]) ? part.jog[i] : ['?', '', 'A'];
    const EVR = rd ? (rd.ev || []).map((e) => {
      const ator = nj(e[2]), vit = e[3] >= 0 ? nj(e[3]) : null;
      const desc = e[0] === 'k' ? ator[0] + ' (' + nomeAg(ator[1]) + ') abateu ' + vit[0] + ' (' + nomeAg(vit[1]) + ')'
        : (e[0] === 'p' ? ator[0] + ' plantou' + (e[7] ? ' no ' + e[7] : '') : ator[0] + ' desarmou a spike');
      return { t: fmtT(e[1]), tipo: e[0] === 'k' ? 'Abate' : (e[0] === 'p' ? 'Plant' : 'Defuse'), desc: desc,
        x: e[0] === 'p' ? 'marca plant' : 'marca', vx: e[4], vy: e[5],
        j: e[6].map((p) => { const jj = nj(p[0]); return [jj[2] === 'A' ? 'a' : 'b', jj[0], p[1], p[2], p[3], (e[0] === 'k' && p[0] === e[3]) ? 1 : 0, jj[1], p[0]]; }), raw: e };
    }) : [];
    this.nEv = EVR.length || 1;
    // primeira kill do round = first blood; kill que vinga um colega em até 3s = trade
    const tagsEv = [];
    if (rd) { let jaTeveKill = false;
      (rd.ev || []).forEach((e, i) => {
        let tg = '';
        if (e[0] === 'k') {
          if (!jaTeveKill) { tg = 'fb'; jaTeveKill = true; }
          else for (let j = i - 1; j >= 0; j--) {
            const a = rd.ev[j]; if (e[1] - a[1] > 3000) break;
            if (a[0] === 'k' && a[2] === e[3] && nj(a[3])[2] === nj(e[2])[2]) { tg = 'tr'; break; }
          }
        }
        tagsEv.push(tg);
      }); }
    const et = s.etapas[s.etapa];
    // apagar/colar/desfazer muda a lista de peças na mesma etapa: sem isso as peças que "sobem" na lista deslizariam do lugar da anterior
    const idsEt = [et.pecas, et.marcas, et.tracos, et.textos].map((l) => (l || []).map((o) => o.id).join(',')).join('|');
    const chaveEt = s.mapa + '|' + s.lado + '|' + s.modo + '|' + s.etapa;
    if (this._chaveEt !== chaveEt) { this._chaveEt = chaveEt; this._idsEt = idsEt; this._travaAnima = false; }
    else if (this._idsEt !== idsEt) { this._idsEt = idsEt; this._travaAnima = true; }

    const modos = [['planejar', 'Planejar'], ['round', 'Round real'], ['calor', 'Mapa de calor']].map((m) => ({
      nome: m[1], cls: 'tab' + (s.modo === m[0] ? ' on' : ''),
      pick: () => { this.pararPlay(); this.setState({ modo: m[0], tocando: false, sel: null, mapaAberto: false }); }
    }));

    const mapas = MAPAS.map((m) => { const k = m[0].toLowerCase(), tem = !!MAPA_INFO[k];
      return { nome: m[0] + (tem ? '' : ' · sem vetor'), cor: m[1], off: !tem, cls: 'mcard ban ban-' + k + (tem ? '' : ' off'),
        pick: () => { if (tem) this.trocarMapa(k); } }; });

    const funcoes = ['Todos', 'Duelista', 'Iniciador', 'Controlador', 'Sentinela'].map((n) => ({ nome: n, cls: 'fchip' + (s.funcao === n ? ' on' : ''), pick: () => this.setState({ funcao: n }) }));
    // cria o objeto que vai pro mapa; p = ponto onde foi solto (arrastando) ou null (clique)
    const fazer = (spec, p) => {
      const centro = s.mapa === 'lotus' ? null : [W / 2, H / 2];
      if (!p && centro && spec.tipo !== 'hab') p = centro;
      if (spec.tipo === 'agente') {
        const al = spec.time === 'al';
        return { tipo: 'agente', time: spec.time, ag: spec.ag, x: p ? p[0] : (al ? 470 : 560), y: p ? p[1] : (al ? 700 : 240), ang: al ? UP : 0.4 };
      }
      if (spec.tipo === 'hab') {
        const fi = ficha(spec.ag, spec.tecla);
        const sel = s.sel ? this.acharObj(et, s.sel) : null;
        const dono = (sel && sel.tipo === 'agente' && sel.ag === spec.ag) ? sel
          : (et.pecas.find((q) => q.ag === spec.ag && q.time === spec.time) || et.pecas.find((q) => q.ag === spec.ag));
        const da = dono ? (dono.ang === undefined ? UP : dono.ang) : UP;
        const base = p ? { x: p[0], y: p[1] } : (dono ? { x: dono.x + Math.cos(da) * 60, y: dono.y + Math.sin(da) * 60 } : (centro ? { x: centro[0], y: centro[1] } : { x: 500, y: 735 }));
        const h = { tipo: 'hab', tecla: spec.tecla, ag: spec.ag, time: dono ? dono.time : spec.time, dono: dono ? dono.id : null, x: base.x, y: base.y };
        const rumo = (p && dono && Math.hypot(p[0] - dono.x, p[1] - dono.y) > 5) ? Math.atan2(p[1] - dono.y, p[0] - dono.x) : da;
        if (fi.f === 'parede') { h.comp = fi.comp; h.ang = rumo + Math.PI / 2; }
        if (fi.f === 'faixa' || fi.f === 'cone' || fi.f === 'linha') h.ang = rumo;
        return h;
      }
      if (spec.tipo === 'marca') return { tipo: 'marca', icone: spec.icone, x: p ? p[0] : 480, y: p ? p[1] : 760 };
      return { tipo: 'visao', forma: spec.forma, x: p ? p[0] : 480, y: p ? p[1] : 735, ang: UP };
    };
    const arrastar = (spec) => (e) => {
      this.novo = spec;
      try {
        e.dataTransfer.setData('text/plain', 'prancheta');
        e.dataTransfer.effectAllowed = 'copy';
        const el = e.currentTarget.querySelector('.spr, svg');
        if (el) { const r = el.getBoundingClientRect(); e.dataTransfer.setDragImage(el, r.width / 2, r.height / 2); }
      } catch (x) {}
    };
    const agentes = AGENTES.filter((a) => s.funcao === 'Todos' || a[2] === s.funcao).map((a) => {
      const spec = { tipo: 'agente', ag: a[0], time: s.time };
      return { nome: a[1], funcao: a[2], bp: bpAg(a[0]), cls: 'ag' + (s.agSel === a[0] ? ' on' : ''),
        drag: arrastar(spec), pick: () => { this.setState({ agSel: a[0] }); this.adicionar(fazer(spec, null)); } };
    });
    const habs = TECLAS.map((k) => {
      const spec = { tipo: 'hab', ag: s.agSel, tecla: k, time: s.time };
      return { tecla: k, nome: nomeHab(s.agSel, k), bp: bpHab(s.agSel, k), drag: arrastar(spec), pick: () => this.adicionar(fazer(spec, null)) };
    });
    const mk = {};
    ['spike', 'pino', 'alerta', 'bandeira', 'ancora', 'mira', 'estrela'].forEach((k) => { const sp = { tipo: 'marca', icone: k }; mk[k] = { pick: () => this.adicionar(fazer(sp, null)), drag: arrastar(sp) }; });
    ['largo', 'estreito', 'linha'].forEach((k) => { const sp = { tipo: 'visao', forma: k }; mk[k] = { pick: () => this.adicionar(fazer(sp, null)), drag: arrastar(sp) }; });
    // habilidades dos agentes que estão no mapa, agrupadas por agente (meu time primeiro)
    const habGrupos = [], vistos = {};
    et.pecas.slice().sort((a, b) => (a.time === 'al' ? 0 : 1) - (b.time === 'al' ? 0 : 1)).forEach((p) => {
      const k = p.time + p.ag;
      if (vistos[k] || p.time !== s.time) return;
      vistos[k] = 1;
      habGrupos.push({ nome: nomeAg(p.ag), bp: bpAg(p.ag), timeTxt: p.time === 'al' ? 'Meu time' : 'Inimigo', cls: 'hrow' + (s.agSel === p.ag ? ' on' : ''),
        itens: TECLAS.map((t) => { const spec = { tipo: 'hab', ag: p.ag, tecla: t, time: p.time }; return { tecla: t, nome: nomeHab(p.ag, t), bp: bpHab(p.ag, t), drag: arrastar(spec), pick: () => this.adicionar(fazer(spec, null)) }; }) });
    });
    const sobreMapa = (e) => { if (this.novo) { e.preventDefault(); try { e.dataTransfer.dropEffect = 'copy'; } catch (x) {} } };
    const largarNoMapa = (e) => {
      if (!this.novo) return;
      e.preventDefault();
      const spec = this.novo;
      this.novo = null;
      if (!isPlanejar) return;
      const p = this.noMapa(e);
      if (spec.tipo === 'agente') this.setState({ agSel: spec.ag });
      this.adicionar(fazer(spec, p));
    };

    const f = {};
    ['mover', 'mao', 'lapis', 'seta', 'texto', 'borracha'].forEach((id) => { f[id] = { cls: 'tb' + (s.ferramenta === id ? ' on' : ''), pick: () => this.setState({ ferramenta: id, sel: null }) }; });

    const selIds = s.sels.length ? s.sels : (s.sel ? [s.sel] : []);
    const isSel = (id) => selIds.indexOf(id) >= 0;
    const apagarVarios = (ids) => this.editar((e2) => {
      const fora = (p) => ids.indexOf(p.id) < 0;
      e2.pecas = e2.pecas.filter(fora); e2.marcas = e2.marcas.filter(fora);
      e2.tracos = e2.tracos.filter(fora); e2.textos = e2.textos.filter(fora);
    }, true);
    const apagar = (id) => apagarVarios([id]);
    const moverIds = (ids, dx, dy, hist) => this.editar((e2) => {
      ids.forEach((id) => {
        const o = this.acharObj(e2, id);
        if (o) { o.x += dx; o.y += dy; return; }
        const tx = e2.textos.find((x) => x.id === id);
        if (tx) { tx.x += dx; tx.y += dy; return; }
        const tr = e2.tracos.find((x) => x.id === id);
        if (tr) tr.pts = tr.pts.map((q) => [q[0] + dx, q[1] + dy]);
      });
    }, hist);
    // borracha estilo Paint: o traço do lápis é cortado só onde ela passou e a seta some inteira
    const apagarEm = (pts, hist) => {
      if (!Array.isArray(pts[0])) pts = [pts];
      const R = 12 / s.z;
      const perto = (x, y, r) => pts.some((q) => Math.hypot(q[0] - x, q[1] - y) <= r);
      const distSeg = (q, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], l = vx * vx + vy * vy || 1; let t = ((q[0] - a[0]) * vx + (q[1] - a[1]) * vy) / l; t = Math.max(0, Math.min(1, t)); return Math.hypot(q[0] - a[0] - t * vx, q[1] - a[1] - t * vy); };
      this.editar((e2) => {
        // a borracha só mexe nos desenhos (lápis e setas); agentes, habilidades, marcadores e notas
        // ficam protegidos e são apagados pela seleção + Delete
        const novos = [];
        e2.tracos.forEach((t) => {
          if (t.kind === 'seta') { if (!pts.some((q) => distSeg(q, t.pts[0], t.pts[t.pts.length - 1]) <= R)) novos.push(t); return; }
          let atual = [], cortou = false, n = 0;
          t.pts.forEach((q) => {
            if (perto(q[0], q[1], R)) { cortou = true; if (atual.length > 1) novos.push({ id: t.id + '-' + (n++) + '-' + Date.now(), kind: 'lapis', pts: atual }); atual = []; }
            else atual.push(q);
          });
          if (!cortou) { novos.push(t); return; }
          if (atual.length > 1) novos.push({ id: t.id + '-' + (n++) + '-' + Date.now(), kind: 'lapis', pts: atual });
        });
        e2.tracos = novos;
      }, hist);
    };
    const objDown = (id) => (e) => {
      if (!isPlanejar) return;
      if (s.ferramenta === 'borracha') return; // deixa o fundo cuidar: a borracha apaga por onde passa
      e.stopPropagation();
      const o = this.acharObj(et, id);
      if (e.shiftKey) {
        const set = isSel(id) ? selIds.filter((x) => x !== id) : selIds.concat([id]);
        this.setState({ sel: set.length === 1 ? set[0] : null, sels: set.length > 1 ? set : [] });
        return;
      }
      const grupo = selIds.length > 1 && isSel(id) ? selIds : [id];
      const patch = { drag: { kind: 'grupo', ids: grupo, hist: true, last: null }, mini: false };
      if (grupo.length === 1) patch.sel = id;
      if (o && o.ag) patch.agSel = o.ag;
      this.setState(patch);
    };
    const desfazerFn = () => { if (!s.hist.length) return; const h = s.hist.slice(); const ant = JSON.parse(h.pop()); this.setState({ etapas: ant, hist: h, futuro: s.futuro.concat([JSON.stringify(s.etapas)]).slice(-30), etapa: Math.min(s.etapa, ant.length - 1), sel: null }); };
    const refazerFn = () => { if (!s.futuro.length) return; const fu = s.futuro.slice(); const prox = JSON.parse(fu.pop()); this.setState({ etapas: prox, futuro: fu, hist: s.hist.concat([JSON.stringify(s.etapas)]).slice(-30), etapa: Math.min(s.etapa, prox.length - 1), sel: null }); };

    let pecas = [], marcas = [], tracos = [], textos = [];
    const cg = { atk: '', def: '', atkIn: '', defIn: '', linha: '' };
    let temGiro = false, giroX = 0, giroY = 0, temMini = false, miniX = 0, miniY = 0, miniOps = [], miniTitulo = 'Visão', miniAviso = '';
    const hg = { atk: '', def: '', atkIn: '', defIn: '', fio: '' };
    const formas = [];
    let anel = '', anelCor = 'rgba(236,232,225,.7)', temPontas = false, paX = 0, paY = 0, pbX = 0, pbY = 0, temCurva = false, pcX = 0, pcY = 0;
    let temNota = false, notaVal = '', notaMudar = () => {};
    const notasMapa = [], instrucoes = [], fantasmas = [], desvios = [];
    let fios = '';
    if (isPlanejar) {
      et.pecas.forEach((p) => {
        if (!p.nota) return;
        const q = pct(p.x, p.y);
        notasMapa.push({ x: q.x, y: q.y, txt: p.nota });
        instrucoes.push({ nome: nomeAg(p.ag) + (p.time === 'al' ? '' : ' (inimigo)'), ico: 'spr spr-ag', letra: '', bp: bpAg(p.ag), txt: p.nota, pick: () => this.setState({ sel: p.id, mini: true, agSel: p.ag }) });
      });
      et.marcas.forEach((m) => {
        if (!m.nota) return;
        const q = pct(m.x, m.y);
        notasMapa.push({ x: q.x, y: q.y, txt: m.nota });
        const ehHab = m.tipo === 'hab';
        instrucoes.push({ nome: ehHab ? nomeAg(m.ag) + ' · ' + nomeHab(m.ag, m.tecla) : nomeMarca(m), ico: ehHab ? 'spr spr-hab' : 'icomk', letra: ehHab ? '' : nomeMarca(m).charAt(0),
          bp: ehHab ? bpHab(m.ag, m.tecla) : '0 0', txt: m.nota, pick: () => this.setState({ sel: m.id, mini: true }) });
      });
      if (s.fantasma !== null && EVR[s.fantasma]) {
        EVR[s.fantasma].j.forEach((g) => {
          if (g[5]) return;
          const ag = g[6], time = g[0] === 'a' ? 'al' : 'in', q = pct(g[2], g[3]);
          fantasmas.push({ x: q.x, y: q.y, bp: bpAg(ag), nome: nomeAg(ag) + ' no round real', cls: 'peca fantasma ' + (time === 'al' ? corAl : 'inimigo ' + corIn) });
          const plano = et.pecas.find((p) => p.ag === ag && p.time === time);
          if (!plano) return;
          fios += 'M' + plano.x.toFixed(1) + ' ' + plano.y.toFixed(1) + 'L' + g[2] + ' ' + g[3];
          if (time === 'al') {
            const m = Math.hypot(plano.x - g[2], plano.y - g[3]) / M;
            desvios.push({ nome: nomeAg(ag), bp: bpAg(ag), m: m, txt: m.toFixed(0) + ' m', cor: m > 10 ? '#FF7A7A' : '#8DDB9A' });
          }
        });
        desvios.sort((a, b) => b.m - a.m);
      }
    }
    const fantOps = [{ nome: 'Desligado', i: null }].concat(EVR.map((x, i) => ({ nome: (i + 1) + ' · ' + x.t + ' ' + x.tipo.toLowerCase() + ' · ' + x.desc, i: i })))
      .map((o) => ({ nome: o.nome, cls: 'item' + (s.fantasma === o.i ? ' on' : ''), pick: () => this.setState({ fantasma: o.i }) }));

    // obstáculos da visão: paredes do mapa + habilidades que bloqueiam (fumaças, paredes de fumaça)
    let obs = { segs: s.segs, circ: [], sig: (s.segs ? s.mapa : '0') };
    if (isPlanejar) {
      const extra = [], circ = [];
      et.marcas.forEach((m) => {
        if (m.tipo !== 'hab') return;
        const fi = ficha(m.ag, m.tecla);
        if (!fi.bloq) return;
        if (fi.f === 'circulo') circ.push([m.x, m.y, fi.r * M]);
        else if (fi.f === 'parede' && fi.curva && m.curv) { const pc = pontosCurva(m, 10); for (let i = 0; i < pc.length - 1; i++) extra.push([pc[i][0], pc[i][1], pc[i + 1][0], pc[i + 1][1]]); }
        else if (fi.f === 'parede') { const pp = pontasParede(m); extra.push([pp[0][0], pp[0][1], pp[1][0], pp[1][1]]); }
        else if (fi.f === 'faixa') {
          const dx = Math.cos(m.ang), dy = Math.sin(m.ang), bx = m.x + dx * fi.comp * M, by = m.y + dy * fi.comp * M;
          extra.push([m.x, m.y, bx, by]);
        }
      });
      obs = { segs: s.segs ? s.segs.concat(extra) : extra, circ: circ,
        sig: (s.segs ? s.mapa : '0') + circ.map((c) => c[0].toFixed(0) + ',' + c[1].toFixed(0)).join(';') + '|' + extra.map((e) => e.map((v) => v.toFixed(0)).join(',')).join(';') };
    }

    if (isPlanejar) {
      pecas = et.pecas.map((p) => {
        const q = pct(p.x, p.y);
        return { x: q.x, y: q.y, spr: 'spr spr-ag', bp: bpAg(p.ag), nome: nomeAg(p.ag), down: objDown(p.id),
          cls: 'peca ' + (p.time === 'al' ? corAl : 'inimigo ' + corIn) + (isSel(p.id) ? ' sel' : '') };
      });
      et.marcas.forEach((m) => {
        const q = pct(m.x, m.y);
        if (m.tipo === 'hab') {
          const fi = ficha(m.ag, m.tecla);
          const ladoH = m.time === 'al' ? corAl : corIn, aro = ladoH === 'atk' ? '#F9A23B' : '#32E0C4';
          const cor = COR_AG[m.ag] || '#6B7885', sel = isSel(m.id);
          const forma = { fill: hexA(cor, fi.bloq ? 0.72 : 0.45), stroke: aro, sw: sel ? 4 : 3, dash: m.time === 'al' ? 'none' : '7 5' };
          if (fi.f === 'circulo') forma.d = circPath(m.x, m.y, fi.r * M);
          else if (fi.f === 'parede' && fi.curva && m.curv) {
            // curva: contorno do time por baixo, cor do agente por cima
            const k = curvaParede(m), dq = 'M' + k.a[0].toFixed(1) + ' ' + k.a[1].toFixed(1) + 'Q' + k.ctrl[0].toFixed(1) + ' ' + k.ctrl[1].toFixed(1) + ' ' + k.b[0].toFixed(1) + ' ' + k.b[1].toFixed(1);
            formas.push({ d: dq, fill: 'none', stroke: aro, sw: (1.4 * M + (sel ? 6 : 4)).toFixed(1), dash: 'none' });
            forma.d = dq; forma.fill = 'none'; forma.stroke = hexA(cor, 0.95); forma.sw = (1.4 * M).toFixed(1); forma.dash = m.time === 'al' ? 'none' : '7 5';
          }
          else if (fi.f === 'parede') { const pp = pontasParede(m); forma.d = retPath(pp[0][0], pp[0][1], m.ang, m.comp * M, 1.4 * M); forma.sw = sel ? 2.5 : 1.5; }
          else if (fi.f === 'faixa') forma.d = retPath(m.x, m.y, m.ang, fi.comp * M, fi.larg * M);
          else if (fi.f === 'cone') forma.d = conePath(fi.atravessa ? null : obs, m.x, m.y, m.ang, fi.ab * Math.PI / 180, fi.alc * M, 40);
          else if (fi.f === 'linha') {
            const so = { segs: s.segs, circ: [] };
            const a = raio(so, m.x, m.y, m.ang, fi.max * M), b = raio(so, m.x, m.y, m.ang + Math.PI, fi.max * M);
            forma.d = 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + 'L' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
            forma.fill = 'none'; forma.stroke = cor; forma.sw = 3;
          }
          if (forma.d) formas.push(forma);
          const temForma = fi.f !== 'icone';
          pecas.push({ x: q.x, y: q.y, spr: 'spr spr-hab', bp: bpHab(m.ag, m.tecla), nome: nomeAg(m.ag) + ' · ' + nomeHab(m.ag, m.tecla), down: objDown(m.id),
            cls: temForma ? 'alca ' + (m.time === 'al' ? corAl : corIn) + (isSel(m.id) ? ' sel' : '')
              : 'peca hab ' + (m.time === 'al' ? corAl : 'inimigo ' + corIn) + (isSel(m.id) ? ' sel' : '') });
          return;
        }
        const it = { x: q.x, y: q.y, down: objDown(m.id), nome: m.icone || ('visão ' + m.forma), cls: 'marca' + (m.tipo === 'visao' ? ' visao' : '') + (m.icone === 'spike' ? ' spike' : '') + (isSel(m.id) ? ' sel' : '') };
        ['spike', 'pino', 'alerta', 'bandeira', 'ancora', 'mira', 'estrela'].forEach((k) => { it[k] = m.icone === k; });
        marcas.push(it);
        if (m.tipo === 'visao') {
          cg[m.forma === 'linha' ? 'linha' : corAl] += coneC(obs, m.x, m.y, m.ang, m.forma);
        }
      });
      et.pecas.forEach((p) => {
        if (p.visao) cg[p.time === 'al' ? corAl : corIn + 'In'] += coneC(obs, p.x, p.y, p.ang, p.visao);
      });
      const alvo = s.sel ? this.acharObj(et, s.sel) : null;
      if (alvo && !s.tocando) {
        const fa = alvo.tipo === 'hab' ? ficha(alvo.ag, alvo.tecla) : null;
        if (fa) {
          if (fa.f === 'parede') {
            temPontas = true;
            const pp = pontasParede(alvo), qa = pct(pp[0][0], pp[0][1]), qb = pct(pp[1][0], pp[1][1]);
            paX = qa.x; paY = qa.y; pbX = qb.x; pbY = qb.y;
            if (fa.curva) { temCurva = true; const qc = pct(curvaParede(alvo).pico[0], curvaParede(alvo).pico[1]); pcX = qc.x; pcY = qc.y; }
          }
          const dono = alvo.dono ? this.acharObj(et, alvo.dono) : null;
          let fora = false, dist = 0;
          if (dono && fa.alc) {
            dist = Math.hypot(alvo.x - dono.x, alvo.y - dono.y) / M;
            fora = dist > fa.alc;
            anel = circPath(dono.x, dono.y, fa.alc * M);
            anelCor = fora ? '#FF5A5A' : 'rgba(236,232,225,.7)';
          }
          if (!s.drag && s.mini) {
            temMini = true;
            const q = pct(alvo.x, alvo.y);
            miniX = q.x; miniY = q.y; miniOps = [];
            miniTitulo = nomeAg(alvo.ag) + ' · ' + nomeHab(alvo.ag, alvo.tecla);
            temNota = true; notaVal = alvo.nota || '';
            notaMudar = (e) => { const v = e.target.value; this.editar((e2) => { const x = this.acharObj(e2, alvo.id); if (x) x.nota = v; }, false); };
            if (fa.alc && dono) miniAviso = fora ? 'Fora do alcance: ' + dist.toFixed(0) + ' m de ' + fa.alc + ' m' : dist.toFixed(0) + ' m de ' + fa.alc + ' m';
            else if (fa.alc) miniAviso = 'Coloque o agente no mapa para ver o alcance';
            if (fa.f === 'icone' && !fa.alc) miniAviso = 'Sem área no mapa';
          }
        }
        if ((alvo.tipo === 'marca' || alvo.tipo === 'visao') && !s.drag && s.mini) {
          temMini = true;
          const q = pct(alvo.x, alvo.y);
          miniX = q.x; miniY = q.y; miniOps = [];
          miniTitulo = nomeMarca(alvo);
          temNota = true; notaVal = alvo.nota || '';
          notaMudar = (e) => { const v = e.target.value; this.editar((e2) => { const x = this.acharObj(e2, alvo.id); if (x) x.nota = v; }, false); };
        }
        if (alvo.ang !== undefined && (alvo.tipo === 'visao' || alvo.visao || (fa && (fa.f === 'faixa' || fa.f === 'cone' || fa.f === 'linha')))) {
          temGiro = true;
          const g = pct(alvo.x + Math.cos(alvo.ang) * 34, alvo.y + Math.sin(alvo.ang) * 34);
          giroX = g.x; giroY = g.y;
        }
        if (alvo.tipo === 'agente' && !s.drag && s.mini) {
          temMini = true;
          const q = pct(alvo.x, alvo.y);
          miniX = q.x; miniY = q.y;
          miniOps = [[null, 'Sem'], ['largo', 'Larga'], ['estreito', 'Estreita']].map((o) => ({
            nome: o[1], cls: (alvo.visao || null) === o[0] ? 'on' : '',
            pick: () => this.editar((e2) => { const x = this.acharObj(e2, alvo.id); if (x) { x.visao = o[0]; if (x.ang === undefined) x.ang = UP; } }, true)
          }));
          miniTitulo = nomeAg(alvo.ag) + ' · visão';
          temNota = true; notaVal = alvo.nota || '';
          notaMudar = (e) => { const v = e.target.value; this.editar((e2) => { const x = this.acharObj(e2, alvo.id); if (x) x.nota = v; }, false); };
        }
      }
      tracos = et.tracos.map((t) => {
        const d = t.pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
        const mid = 'ponta-' + t.id;
        return { d: d, mid: mid, dash: t.kind === 'seta' ? '10 7' : 'none', ponta: t.kind === 'seta' ? 'url(#' + mid + ')' : 'none',
          pe: 'none', cor: t.cor || '#ECE8E1', brilho: isSel(t.id) ? 'drop-shadow(0 0 4px rgba(236,232,225,.95))' : 'none',
          down: () => {} };
      });
      textos = et.textos.map((t) => {
        const q = pct(t.x, t.y);
        // letra de tamanho fixo; a largura da caixa (definida pelo coach) é a "parede" onde a linha quebra
        const fs = TAM_LETRA_NOTA;
        const cv = paraVista(t.x + t.w / 2, t.y + t.h / 2);
        return { x: ((cv[0] - t.w / 2) / VW * 100).toFixed(2), y: ((cv[1] - t.h / 2) / VH * 100).toFixed(2), w: (t.w / VW * 100).toFixed(2), h: (t.h / VH * 100).toFixed(2), txt: t.txt, sel: s.sel === t.id,
          fs: (fs / VW * 100).toFixed(3), cls: 'nota' + (isSel(t.id) ? ' sel' : ''),
          mudar: (e) => { const v = e.target.value; this.editar((e2) => { e2.textos.forEach((x) => { if (x.id === t.id) x.txt = v; }); }, false); },
          digitar: (e) => { if (s.ferramenta === 'borracha') return; e.stopPropagation(); if (s.sel !== t.id) this.setState({ sel: t.id }); },
          down: (e) => { if (s.ferramenta === 'borracha') return; e.stopPropagation();
            if (selIds.length > 1 && isSel(t.id)) { this.setState({ drag: { kind: 'grupo', ids: selIds, hist: true, last: null } }); return; }
            this.setState({ sel: t.id, drag: { kind: 'tx', id: t.id, hist: true, ox: null } }); },
          resDown: (e) => { e.stopPropagation(); this.setState({ drag: { kind: 'txr', id: t.id, hist: true } }); } };
      });
    }

    const ev = EVR[Math.min(s.evento, EVR.length - 1)] || null;
    let xCls = '', xX = 0, xY = 0, tracer = '', tracerCor = '#ECE8E1';
    const nomesRound = [];
    if (isRound && ev) {
      pecas = ev.j.map((p) => {
        const q = pct(p[2], p[3]);
        return { x: q.x, y: q.y, spr: 'spr spr-ag', bp: bpAg(p[6]), nome: p[1] + ' · ' + nomeAg(p[6]), down: () => {}, cls: 'peca ' + (p[0] === 'a' ? 'atk' : 'def inimigo') + (p[5] ? ' morto' : '') + (p[7] === ev.raw[2] ? ' destaque' : ''),
          bMorte: !!p[5], bMata: ev.raw[0] === 'k' && p[7] === ev.raw[2], bPlant: ev.raw[0] === 'p' && p[7] === ev.raw[2], bDefuse: ev.raw[0] === 'd' && p[7] === ev.raw[2],
          bFb: p[7] === ev.raw[2] && tagsEv[EVR.indexOf(ev)] === 'fb', bTr: p[7] === ev.raw[2] && tagsEv[EVR.indexOf(ev)] === 'tr' };
      });
      if (s.visao) {
        ev.j.forEach((p) => {
          if (p[5] || p[4] === null || p[4] === undefined) return;
          cg[p[0] === 'a' ? 'atk' : 'def'] += coneC(obs, p[2], p[3], p[4], 'largo');
        });
      }
      const q = pct(ev.vx, ev.vy);
      // plant/defuse: anel em volta do lugar da spike, sem cobrir o jogador; abate não precisa (vítima ganha o selo de X)
      xCls = ev.raw[0] === 'p' ? 'anel-ev plant' : (ev.raw[0] === 'd' ? 'anel-ev defuse' : 'anel-ev oculto'); xX = q.x; xY = q.y;
      // linha do tiro: de quem matou até a vítima
      if (ev.raw[0] === 'k') {
        const k = ev.j.find((p) => p[7] === ev.raw[2]);
        if (k && isFinite(ev.raw[4]) && isFinite(ev.raw[5])) { tracer = 'M' + k[2] + ' ' + k[3] + 'L' + ev.raw[4] + ' ' + ev.raw[5]; tracerCor = k[0] === 'a' ? '#FBBF6E' : '#7EEBD9'; }
      }
      const iEv = EVR.indexOf(ev), porIdx = {};
      ev.j.forEach((p, k) => { porIdx[p[7]] = { peca: pecas[k], p: p }; });
      const vagas = [], nomesV = [];
      for (let ij = 0; ij < (part ? part.jog.length : 0); ij++) {
        if (porIdx[ij]) { vagas.push(porIdx[ij].peca); const q2 = pct(porIdx[ij].p[2], porIdx[ij].p[3]); nomesV.push({ x: q2.x, y: q2.y, txt: porIdx[ij].p[1], cls: 'npeca' }); continue; }
        // jogador fora deste evento (já morreu ou ainda não apareceu): fica invisível no último lugar conhecido
        let ult = null;
        for (let b = iEv; b >= 0 && !ult; b--) ult = EVR[b].j.find((p) => p[7] === ij) || null;
        for (let b = iEv + 1; b < EVR.length && !ult; b++) ult = EVR[b].j.find((p) => p[7] === ij) || null;
        const q3 = ult ? pct(ult[2], ult[3]) : { x: 50, y: 50 }, jj = nj(ij);
        vagas.push({ x: q3.x, y: q3.y, spr: 'spr spr-ag', bp: bpAg(jj[1]), nome: jj[0], down: () => {}, cls: 'peca sumida ' + (jj[2] === 'A' ? 'atk' : 'def inimigo'),
          bMorte: false, bMata: false, bPlant: false, bDefuse: false, bFb: false, bTr: false });
        nomesV.push({ x: q3.x, y: q3.y, txt: jj[0], cls: 'npeca sumida' });
      }
      pecas = vagas;
      if (s.nomes) nomesV.forEach((n) => nomesRound.push(n));
    }

    const fundoDown = (e) => {
      // lápis da apresentação: risco temporário, não entra nas etapas nem no desfazer
      if (s.apres && s.apLapis && e.button !== 1) { e.preventDefault(); this.setState({ riscos: (s.riscos || []).concat([{ c: s.corApres || '#FF4655', p: [this.noMapa(e)] }]), drag: { kind: 'risco' } }); return; }
      const iniciarPan = () => this.setState({ sel: null, mapaAberto: false, drag: { kind: 'pan', cx: e.clientX, cy: e.clientY, ox: s.ox, oy: s.oy } });
      if (isCalor) { this.cliqueCalor = { cx: e.clientX, cy: e.clientY, p: this.noMapa(e) }; this.pend = null; }
      if (!isPlanejar || s.tocando) { iniciarPan(); return; }
      if (e.button === 1 || s.ferramenta === 'mao' || this.espaco) { e.preventDefault(); this.setState({ mapaAberto: false, drag: { kind: 'pan', cx: e.clientX, cy: e.clientY, ox: s.ox, oy: s.oy } }); return; }
      const p = this.noMapa(e);
      if (s.ferramenta === 'borracha') {
        e.preventDefault();
        this.setState({ drag: { kind: 'apagar', last: p }, mira: p });
        apagarEm(p, true);
        return;
      }
      if (s.ferramenta === 'lapis' || s.ferramenta === 'seta') {
        const id = 'tr' + Date.now();
        this.editar((e2) => { e2.tracos.push({ id: id, kind: s.ferramenta, pts: [p, p], cor: s.corLapis || '#ECE8E1' }); }, true);
        this.setState({ drag: { kind: 'traco', id: id } });
      } else if (s.ferramenta === 'texto') {
        const id = 'tx' + Date.now();
        const vpN = paraVista(p[0], p[1]), cNova = daVista(vpN[0] + 80, vpN[1] + 20);
        this.editar((e2) => { e2.textos.push({ id: id, x: cNova[0] - 80, y: cNova[1] - 20, w: 160, h: 40, txt: 'Nota' }); }, true);
        this.setState({ ferramenta: 'mover', sel: id });
      } else if (s.ferramenta === 'mover') {
        const patch = { mapaAberto: false, drag: { kind: 'laco', x1: p[0], y1: p[1], x2: p[0], y2: p[1], base: e.shiftKey ? selIds : [] } };
        if (!e.shiftKey) patch.sel = null;
        this.setState(patch);
      }
    };
    const mover = (e) => {
      if (!this.state.drag && !(isPlanejar && s.ferramenta === 'borracha')) return;
      const dk = this.state.drag && this.state.drag.kind;
      if (dk === 'grupo' || dk === 'tx') {
        const lx = e.currentTarget.querySelector ? e.currentTarget.querySelector('.lixeira') : null;
        if (lx) {
          const r = lx.getBoundingClientRect();
          const sob = e.clientX >= r.left - 12 && e.clientX <= r.right + 12 && e.clientY >= r.top - 12 && e.clientY <= r.bottom + 12;
          if (sob !== !!this.state.sobreLixo) this.setState({ sobreLixo: sob });
        }
      }
      this.pend = { p: this.noMapa(e), cx: e.clientX, cy: e.clientY };
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => { this.raf = null; aplicar(this.pend); });
    };
    const aplicar = (pe) => {
      const d = this.state.drag;
      if (!pe) return;
      if (!d) { if (s.ferramenta === 'borracha') this.setState({ mira: pe.p }); return; }
      if (d.kind === 'pan') { if (this.state.z > 1) this.setState({ ox: d.ox + pe.cx - d.cx, oy: d.oy + pe.cy - d.cy }); return; }
      const p = pe.p;
      if (d.kind === 'risco') { const r = (this.state.riscos || []).slice(); if (!r.length) return; const u = r[r.length - 1]; r[r.length - 1] = { c: u.c, p: u.p.concat([p]) }; this.setState({ riscos: r }); return; }
      if (d.kind === 'apagar') {
        const a = d.last, dist = Math.hypot(p[0] - a[0], p[1] - a[1]), passo = Math.max(2, 6 / s.z), n = Math.max(1, Math.ceil(dist / passo));
        const pts = [];
        for (let i = 1; i <= n; i++) pts.push([a[0] + (p[0] - a[0]) * i / n, a[1] + (p[1] - a[1]) * i / n]);
        apagarEm(pts, false);
        this.setState({ drag: Object.assign({}, d, { last: p }), mira: p });
        return;
      }
      if (d.kind === 'laco') { this.setState({ drag: Object.assign({}, d, { x2: p[0], y2: p[1] }) }); return; }
      if (d.kind === 'grupo') {
        if (!d.last) { this.setState({ drag: Object.assign({}, d, { last: p }) }); return; }
        const dx = p[0] - d.last[0], dy = p[1] - d.last[1];
        this.editar((e2) => {
          d.ids.forEach((id) => {
            const o = this.acharObj(e2, id);
            if (o) { o.x += dx; o.y += dy; return; }
            const t = e2.textos.find((x) => x.id === id);
            if (t) { t.x += dx; t.y += dy; return; }
            const tr = e2.tracos.find((x) => x.id === id);
            if (tr) tr.pts = tr.pts.map((q) => [q[0] + dx, q[1] + dy]);
          });
        }, d.hist);
        this.setState({ drag: Object.assign({}, d, { last: p, hist: false, moveu: true }) });
        return;
      }
      if (d.kind === 'obj') {
        this.editar((e2) => { const o = this.acharObj(e2, d.id); if (o) { o.x = p[0]; o.y = p[1]; } }, d.hist);
        if (d.hist) this.setState({ drag: { kind: 'obj', id: d.id, hist: false } });
      } else if (d.kind === 'pa' || d.kind === 'pb') {
        this.editar((e2) => {
          const o = this.acharObj(e2, d.id);
          if (!o) return;
          const fi = ficha(o.ag, o.tecla), pp = pontasParede(o);
          const fixa = d.kind === 'pa' ? pp[1] : pp[0];
          let vx = p[0] - fixa[0], vy = p[1] - fixa[1];
          let len = Math.hypot(vx, vy) / M;
          if (len < 1) return;
          const ang = Math.atan2(vy, vx);
          len = fi.fixo ? o.comp : Math.min(len, fi.max || len);
          const nx = fixa[0] + Math.cos(ang) * len * M, ny = fixa[1] + Math.sin(ang) * len * M;
          o.x = (fixa[0] + nx) / 2; o.y = (fixa[1] + ny) / 2; o.comp = len;
          o.ang = d.kind === 'pa' ? ang + Math.PI : ang;
        }, d.hist);
        if (d.hist) this.setState({ drag: { kind: d.kind, id: d.id, hist: false } });
      } else if (d.kind === 'pc') {
        // puxar o meio da parede: a distância até a reta vira a curvatura (limitada para não virar um laço)
        this.editar((e2) => {
          const o = this.acharObj(e2, d.id); if (!o) return;
          const nx = -Math.sin(o.ang), ny = Math.cos(o.ang), lim = o.comp * M * 0.6;
          o.curv = Math.max(-lim, Math.min(lim, (p[0] - o.x) * nx + (p[1] - o.y) * ny));
          if (Math.abs(o.curv) < 0.02 * o.comp * M) o.curv = 0;
        }, d.hist);
        if (d.hist) this.setState({ drag: { kind: 'pc', id: d.id, hist: false } });
      } else if (d.kind === 'tx' || d.kind === 'txr') {
        const atual = this.state.etapas[this.state.etapa].textos.find((x) => x.id === d.id);
        if (!atual) return;
        if (d.kind === 'tx' && d.ox === null) { this.setState({ drag: { kind: 'tx', id: d.id, hist: d.hist, ox: p[0] - atual.x, oy: p[1] - atual.y } }); return; }
        this.editar((e2) => {
          const t = e2.textos.find((x) => x.id === d.id);
          if (!t) return;
          if (d.kind === 'tx') { t.x = p[0] - d.ox; t.y = p[1] - d.oy; }
          else { const c0 = paraVista(t.x + t.w / 2, t.y + t.h / 2), L = c0[0] - t.w / 2, T0 = c0[1] - t.h / 2, vp = paraVista(p[0], p[1]);
            const nw = Math.max(80, vp[0] - L), nh = Math.max(24, vp[1] - T0), nc = daVista(L + nw / 2, T0 + nh / 2);
            t.w = nw; t.h = nh; t.x = nc[0] - nw / 2; t.y = nc[1] - nh / 2; }
        }, d.hist);
        if (d.hist) this.setState({ drag: Object.assign({}, this.state.drag, { hist: false }) });
      } else if (d.kind === 'rot') {
        this.editar((e2) => { const o = this.acharObj(e2, d.id); if (o) o.ang = Math.atan2(p[1] - o.y, p[0] - o.x); }, d.hist);
        if (d.hist) this.setState({ drag: { kind: 'rot', id: d.id, hist: false } });
      } else if (d.kind === 'traco') {
        this.editar((e2) => {
          const t = e2.tracos.find((x) => x.id === d.id);
          if (!t) return;
          if (t.kind === 'seta') t.pts = [t.pts[0], p];
          else { const u = t.pts[t.pts.length - 1]; if (Math.hypot(u[0] - p[0], u[1] - p[1]) > 4) t.pts.push(p); }
        }, false);
      }
    };
    const soltar = () => {
      const d = this.state.drag;
      if (!d) return;
      if (isCalor && this.cliqueCalor) {
        const c = this.cliqueCalor, pe = this.pend; this.cliqueCalor = null;
        if (!pe || Math.hypot(pe.cx - c.cx, pe.cy - c.cy) < 5) {
          const p = c.p, dentro = p[0] >= 0 && p[1] >= 0 && p[0] <= W && p[1] <= H;
          this.setState({ drag: null, calorPt: dentro ? p : null });
          return;
        }
      }
      if ((d.kind === 'grupo' || d.kind === 'tx') && this.state.sobreLixo) {
        apagarVarios(d.kind === 'tx' ? [d.id] : d.ids);
        this.setState({ drag: null, sobreLixo: false, sel: null });
        return;
      }
      if (this.state.sobreLixo) this.setState({ sobreLixo: false });
      if (d.kind === 'laco') {
        const x1 = Math.min(d.x1, d.x2), x2 = Math.max(d.x1, d.x2), y1 = Math.min(d.y1, d.y2), y2 = Math.max(d.y1, d.y2);
        const dentro = (x, y) => x >= x1 && x <= x2 && y >= y1 && y <= y2;
        const ids = [];
        if (x2 - x1 > 3 || y2 - y1 > 3) {
          et.pecas.forEach((p) => { if (dentro(p.x, p.y)) ids.push(p.id); });
          et.marcas.forEach((p) => { if (dentro(p.x, p.y)) ids.push(p.id); });
          et.textos.forEach((t) => { if (dentro(t.x + t.w / 2, t.y + t.h / 2)) ids.push(t.id); });
          et.tracos.forEach((t) => { if (t.pts.some((q) => dentro(q[0], q[1]))) ids.push(t.id); });
        }
        const todos = d.base.concat(ids.filter((i) => d.base.indexOf(i) < 0));
        this.setState({ drag: null, sel: todos.length === 1 ? todos[0] : null, sels: todos.length > 1 ? todos : [] });
        return;
      }
      // menu do item só aparece depois de um clique simples, não depois de arrastar
      if (d.kind === 'grupo') { this.setState({ drag: null, mini: !d.moveu && d.ids.length === 1 }); return; }
      this.setState({ drag: null });
    };
    const tecla = (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      const k = (e.key || '').toLowerCase();
      if (s.soVer) {
        // só visualizar: nada de editar; Esc só limpa os rabiscos e fecha janelas
        if (k === 'escape') { this.setState({ jogadasAberta: false, compAberta: false, novaAberta: false, ajuda: false, riscos: [] }); return; }
        if (e.ctrlKey || e.metaKey || k === 'delete' || k === 'backspace' || k === 'arrowup' || k === 'arrowdown' || k === '?') return;
      }
      if (k === 'delete' || k === 'backspace') { if (selIds.length && isPlanejar) { e.preventDefault(); apagarVarios(selIds); this.setState({ sel: null }); } }
      else if (k === 'escape') this.setState({ jogadasAberta: false, compAberta: false, novaAberta: false, sel: null, sels: [], apres: false, ajuda: false, calorPt: null, apLapis: false, riscos: [] });
      else if (s.apres && k === 'p' && !e.ctrlKey && !e.metaKey) this.setState({ apLapis: !s.apLapis });
      else if (k === '?') this.setState({ ajuda: !s.ajuda });
      else if (isPlanejar && selIds.length && (k === 'arrowright' || k === 'arrowleft' || k === 'arrowup' || k === 'arrowdown')) {
        // setas com algo selecionado: empurra a seleção (Shift = passo maior)
        e.preventDefault();
        const passo = (e.shiftKey ? 12 : 2) / s.z;
        const dx = k === 'arrowright' ? passo : (k === 'arrowleft' ? -passo : 0), dy = k === 'arrowdown' ? passo : (k === 'arrowup' ? -passo : 0);
        moverIds(selIds, dx, dy, !e.repeat);
      }
      else if ((e.ctrlKey || e.metaKey) && (k === 'c' || k === 'x') && isPlanejar && selIds.length) {
        // copiar / recortar: guarda uma cópia dos itens selecionados (vale entre etapas e mapas)
        e.preventDefault();
        const etA = s.etapas[s.etapa], pega = (l) => l.filter((o) => selIds.indexOf(o.id) >= 0);
        this.clip = JSON.parse(JSON.stringify({ pecas: pega(etA.pecas), marcas: pega(etA.marcas), tracos: pega(etA.tracos), textos: pega(etA.textos) }));
        this.colagens = 0;
        if (k === 'x') { apagarVarios(selIds); this.setState({ sel: null, sels: [] }); }
      }
      else if ((e.ctrlKey || e.metaKey) && k === 'v' && isPlanejar && this.clip) {
        e.preventDefault();
        this.colagens = (this.colagens || 0) + 1;
        const off = 14 * this.colagens, c = JSON.parse(JSON.stringify(this.clip)), base = 'cp' + Date.now() + '_', novos = [];
        let n = 0;
        const novoIdC = (o) => { o.id = base + (n++); novos.push(o.id); return o; };
        c.pecas.forEach((o) => { novoIdC(o); o.x += off; o.y += off; });
        c.marcas.forEach((o) => { novoIdC(o); o.x += off; o.y += off; });
        c.textos.forEach((o) => { novoIdC(o); o.x += off; o.y += off; });
        c.tracos.forEach((o) => { novoIdC(o); o.pts = o.pts.map((q) => [q[0] + off, q[1] + off]); });
        this.editar((e2) => { e2.pecas = e2.pecas.concat(c.pecas); e2.marcas = e2.marcas.concat(c.marcas); e2.textos = e2.textos.concat(c.textos); e2.tracos = e2.tracos.concat(c.tracos); }, true);
        this.setState({ ferramenta: 'mover', sel: novos.length === 1 ? novos[0] : null, sels: novos.length > 1 ? novos : [], mini: false });
      }
      else if ((k === 'arrowright' || k === 'arrowleft') && !(isPlanejar && selIds.length)) {
        // setas: evento anterior/próximo no Round real, etapa anterior/próxima no Planejar
        e.preventDefault(); this.pararPlay();
        const d = k === 'arrowright' ? 1 : -1;
        if (isRound && EVR.length) this.setState({ evento: (Math.min(s.evento, EVR.length - 1) + d + EVR.length) % EVR.length, tocando: false });
        else if (isPlanejar) this.setState({ etapa: (s.etapa + d + s.etapas.length) % s.etapas.length, tocando: false });
      }
      else if ((k === 'arrowdown' || k === 'arrowup') && isRound && rodadas.length) {
        // setas para cima/baixo: round anterior/próximo
        e.preventDefault(); this.pararPlay();
        const d = k === 'arrowdown' ? 1 : -1;
        const nr = Math.min(Math.max(s.round + d, 1), rodadas.length);
        this.setState({ round: nr, evento: 0, fantasma: null, tocando: false });
      }
      else if (k === ' ') { e.preventDefault(); this.espaco = true; }
      else if ((e.ctrlKey || e.metaKey) && ((k === 'z' && e.shiftKey) || k === 'y')) { e.preventDefault(); refazerFn(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); desfazerFn(); }
      else if (!e.ctrlKey && !e.metaKey && isPlanejar) {
        const ft = { v: 'mover', h: 'mao', p: 'lapis', a: 'seta', t: 'texto', e: 'borracha' }[k];
        if (ft) this.setState({ ferramenta: ft, sel: null });
      }
    };
    let temLaco = false, laco = { x: 0, y: 0, w: 0, h: 0 };
    if (s.drag && s.drag.kind === 'laco') {
      const d = s.drag, p1 = paraVista(d.x1, d.y1), p2 = paraVista(d.x2, d.y2);
      temLaco = true;
      laco = { x: (Math.min(p1[0], p2[0]) / VW * 100).toFixed(2), y: (Math.min(p1[1], p2[1]) / VH * 100).toFixed(2), w: (Math.abs(p2[0] - p1[0]) / VW * 100).toFixed(2), h: (Math.abs(p2[1] - p1[1]) / VH * 100).toFixed(2) };
    }

    const RES = { 'Eliminated': 'Eliminação', 'Bomb defused': 'Spike desarmada', 'Bomb detonated': 'Spike explodiu', 'Round timer expired': 'Tempo esgotado' };
    const CER = { Flawless: 'sem perder ninguém', Clutch: 'clutch', TeamAce: 'ace do time', Ace: 'ace', Thrifty: 'venceu com compra menor', Closer: 'fechou o mapa' };
    const nomeT = (l) => part ? (l === 'A' ? part.a : part.b) : l;
    const rounds = rodadas.map((r, i) => ({ n: r.n, dica: 'vitória de ' + nomeT(r.venc) + ' · ' + (RES[r.res] || r.res || '') + (CER[r.cer] ? ' · ' + CER[r.cer] : ''),
      cls: 'rchip ' + (r.venc === 'A' ? 'vence-a' : 'vence-b') + (s.round === i + 1 ? ' on' : ''), pick: () => this.setState({ round: i + 1, evento: 0, fantasma: null }) }));
    const classeEco = (v, n) => (n === 1 || n === 13) ? 'Pistol' : (v < 10000 ? 'Eco' : (v < 20000 ? 'Force' : 'Full'));
    const fmtNum = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    // vivos de cada lado no evento atual
    const totA = part ? part.jog.filter((j) => j[2] === 'A').length : 5, totB = part ? part.jog.filter((j) => j[2] === 'B').length : 5;
    let mortosA = 0, mortosB = 0;
    EVR.slice(0, Math.min(s.evento, EVR.length - 1) + 1).forEach((x) => { if (x.raw[0] === 'k') { if (nj(x.raw[3])[2] === 'A') mortosA++; else mortosB++; } });
    const durRound = Math.max(100000, (EVR.length ? EVR[EVR.length - 1].raw[1] : 0) + 5000);
    const marcasTempo = EVR.map((x, i) => ({ pos: (x.raw[1] / durRound * 100).toFixed(2), rotulo: x.t + ' · ' + x.desc,
      cls: 'lt-m ' + (x.raw[0] === 'k' ? (nj(x.raw[2])[2] === 'A' ? 'a' : 'b') : 'spike') + (i === Math.min(s.evento, EVR.length - 1) ? ' on' : ''),
      pick: () => { this.pararPlay(); this.setState({ evento: i, tocando: false }); } }));
    const fbI = tagsEv.indexOf('fb');
    const nTrades = { A: 0, B: 0 };
    tagsEv.forEach((tg, i) => { if (tg === 'tr') nTrades[nj(rd.ev[i][2])[2]]++; });
    const feed = EVR.map((x, i) => {
      const e = x.raw, A = nj(e[2]), V = e[3] >= 0 ? nj(e[3]) : null;
      return { ehFb: tagsEv[i] === 'fb', ehTr: tagsEv[i] === 'tr', temTag: !!tagsEv[i], tag: tagsEv[i] === 'fb' ? 'First blood' : 'Trade', tagCls: 'ftag ' + tagsEv[i], t: x.t, ehAbate: e[0] === 'k', ehSpike: e[0] !== 'k', cls: 'item' + (i === Math.min(s.evento, EVR.length - 1) ? ' on' : ''),
        pick: () => { this.pararPlay(); this.setState({ evento: i, tocando: false }); },
        nomeA: A[0], icoA: 'spr spr-ag fico ' + (A[2] === 'A' ? 'a' : 'b'), bpA: bpAg(A[1]),
        nomeV: V ? V[0] : '', icoV: 'spr spr-ag fico ' + (V && V[2] === 'A' ? 'a' : 'b'), bpV: V ? bpAg(V[1]) : '0 0',
        titulo: e[0] === 'p' ? 'Plantou' + (e[7] ? ' no ' + e[7] : '') : 'Desarmou a spike' };
    });
    const listaP = partidasR.map((p, i) => ({ titulo: p.a + ' ' + p.pa + ' x ' + p.pb + ' ' + p.b, sub: p.torneio + ' · ' + p.data,
      cls: 'item' + (i === Math.min(s.partida, partidasR.length - 1) ? ' on' : ''), pick: () => this.setState({ partida: i, round: 1, evento: 0, fantasma: null, listaPartidas: false }) }));
    // mapa de calor real: abates (posição da vítima, filtrando pelo time de quem matou) ou plants (filtrando pelo time que plantou)
    const timesSet = {};
    partidasR.forEach((p) => { timesSet[p.a] = 1; timesSet[p.b] = 1; });
    const timesCalor = [''].concat(Object.keys(timesSet).sort()).map((nm) => ({ nome: nm || 'Todos os times', cls: 'item' + (s.calorTime === nm ? ' on' : ''), pick: () => this.setState({ calorTime: nm, listaTimes: false }) }));
    let calorN = 0, celulas = [], pontosCalor = [], areaRounds = [];
    const visual = s.calorVisual || 'mancha';
    if (isCalor) {
      const G = 88, grade = new Float32Array(G * G), tipo = s.tipoCalor, pts = [];
      const fase = s.calorFase || 'todo', ladoF = s.calorLado || 'todos', ecoF = s.calorEco || 'todas';
      const pt = s.calorPt, R2 = Math.pow(W * RAIO_AREA, 2), vistos = {};
      if (AMB.calor) {
        const idxP = {}; partidasR.forEach((p, i) => { idxP[p.id] = i; });
        const rotulo = tipo === 'plants' ? 'Plant' : (tipo === 'mortes' ? 'Morte' : 'Abate');
        AMB.calor.pontos(s.mapa, tipo).forEach((q) => {
          const pi = idxP[q.partida_id], p = pi == null ? null : partidasR[pi];
          const nomeTime = p ? (q.time_id === p.ta ? p.a : (q.time_id === p.tb ? p.b : '')) : '';
          if (s.calorTime && nomeTime !== s.calorTime) return;
          const atacando = q.lado === 'ataque';
          if (ladoF === 'atk' && q.lado !== 'ataque') return;
          if (ladoF === 'def' && q.lado !== 'defesa') return;
          if (fase !== 'todo') {
            if (q.tempo_ms == null) return;
            const seg = q.tempo_ms / 1000;
            if (fase === 'inicio' && seg >= 30) return;
            if (fase === 'meio' && (seg < 30 || seg >= 60)) return;
            if (fase === 'fim' && seg < 60) return;
          }
          if (ecoF !== 'todas' && (q.compra === 'force' ? 'forca' : q.compra) !== ecoF) return;
          const cx = Math.floor(q.x / W * G), cy = Math.floor(q.y / H * G);
          if (cx >= 0 && cy >= 0 && cx < G && cy < G) grade[cy * G + cx] += q.peso || 1;
          pts.push([q.x, q.y, atacando ? 'a' : 'd']);
          calorN++;
          if (pt && p && Math.pow(q.x - pt[0], 2) + Math.pow(q.y - pt[1], 2) <= R2) {
            const ch = pi + ':' + (q.round - 1);
            if (vistos[ch]) { vistos[ch].n++; return; }
            vistos[ch] = { pi: pi, ri: q.round - 1, ei: 0, alvo: q.evento_id, n: 1, cab: 'R' + q.round + (q.tempo_ms == null ? '' : ' · ' + fmtT(q.tempo_ms)), jogo: p.a + ' x ' + p.b, desc: rotulo + (nomeTime ? ' · ' + nomeTime : '') };
            areaRounds.push(vistos[ch]);
          }
        });
      } else (AMB.calorVazio ? [] : partidasR).forEach((p, pi) => p.rounds.forEach((r, ri) => (r.ev || []).forEach((e, ei) => {
        if (tipo === 'plants' ? e[0] !== 'p' : e[0] !== 'k') return;
        // de quem é o ponto de vista: quem matou (abates), quem morreu (mortes) ou quem plantou (plants)
        const quem = p.jog[tipo === 'mortes' ? e[3] : e[2]]; if (!quem) return;
        const nomeTime = quem[2] === 'A' ? p.a : p.b;
        if (s.calorTime && nomeTime !== s.calorTime) return;
        const atacando = quem[2] === r.atk;
        if (ladoF === 'atk' && !atacando) return;
        if (ladoF === 'def' && atacando) return;
        const seg = e[1] / 1000;
        if (fase === 'inicio' && seg >= 30) return;
        if (fase === 'meio' && (seg < 30 || seg >= 60)) return;
        if (fase === 'fim' && seg < 60) return;
        if (ecoF !== 'todas' && tipoCompra(quem[2] === 'A' ? r.eA : r.eB, r.n) !== ecoF) return;
        const cx = Math.floor(e[4] / W * G), cy = Math.floor(e[5] / H * G);
        if (cx >= 0 && cy >= 0 && cx < G && cy < G) grade[cy * G + cx] += 1;
        // nos pontos: laranja = quem atacava no round, azul = quem defendia
        pts.push([e[4], e[5], atacando ? 'a' : 'd']);
        calorN++;
        // eventos dentro da área clicada: um item por round (o primeiro evento dele ali)
        if (pt && Math.pow(e[4] - pt[0], 2) + Math.pow(e[5] - pt[1], 2) <= R2) {
          const ch = pi + ':' + ri;
          if (vistos[ch]) { vistos[ch].n++; return; }
          const at = p.jog[e[2]] || ['?', ''], vt = e[3] >= 0 ? (p.jog[e[3]] || ['?', '']) : null;
          const desc = e[0] === 'k' ? at[0] + ' (' + nomeAg(at[1]) + ') abateu ' + vt[0] : at[0] + ' (' + nomeAg(at[1]) + ') ' + (e[0] === 'p' ? 'plantou' : 'desarmou');
          vistos[ch] = { pi: pi, ri: ri, ei: ei, n: 1, cab: 'R' + r.n + ' · ' + fmtT(e[1]), jogo: p.a + ' x ' + p.b, desc: desc };
          areaRounds.push(vistos[ch]);
        }
      })));
      if (visual === 'mancha') {
        // suaviza (núcleo 1-4-6-4-1 nas duas direções) para virar mancha contínua, não quadradinhos
        const K = [1, 4, 6, 4, 1], tmp = new Float32Array(G * G), suave = new Float32Array(G * G);
        for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) { let a = 0; for (let k = -2; k <= 2; k++) { const xx = x + k; if (xx >= 0 && xx < G) a += grade[y * G + xx] * K[k + 2]; } tmp[y * G + x] = a / 16; }
        for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) { let a = 0; for (let k = -2; k <= 2; k++) { const yy = y + k; if (yy >= 0 && yy < G) a += tmp[yy * G + x] * K[k + 2]; } suave[y * G + x] = a / 16; }
        // teto no percentil 99,9: ignora só os picos isolados
        const vals = Array.from(suave).filter((v) => v > 0).sort((a, b) => a - b);
        const teto = vals.length ? vals[Math.floor(vals.length * 0.999)] || vals[vals.length - 1] : 1;
        const RAMPA = [[59, 15, 112], [140, 41, 129], [222, 73, 104], [254, 159, 109], [252, 253, 191]];
        const cor = (v) => { const p = v * (RAMPA.length - 1), i0 = Math.min(Math.floor(p), RAMPA.length - 2), f = p - i0;
          const c = RAMPA[i0].map((q, k) => Math.round(q + (RAMPA[i0 + 1][k] - q) * f));
          return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.25 + 0.65 * v).toFixed(2) + ')'; };
        for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
          const v = Math.min(1, suave[y * G + x] / (teto || 1));
          if (v < 0.2) continue;
          const c1 = paraVista(x / G * W, y / G * H), c2 = paraVista((x + 1) / G * W, (y + 1) / G * H);
          celulas.push({ x: (Math.min(c1[0], c2[0]) / VW * 100).toFixed(2), y: (Math.min(c1[1], c2[1]) / VH * 100).toFixed(2), w: (Math.abs(c2[0] - c1[0]) / VW * 100 + 0.05).toFixed(2), h: (Math.abs(c2[1] - c1[1]) / VH * 100 + 0.05).toFixed(2), cor: cor(v) });
        }
      } else {
        const passo = Math.max(1, Math.ceil(pts.length / 2500));
        for (let i = 0; i < pts.length; i += passo) {
          const pv = pct(pts[i][0], pts[i][1]);
          pontosCalor.push({ x: pv.x, y: pv.y, cor: pts[i][2] === 'a' ? '#F9A23B' : '#32E0C4' });
        }
      }
    }


    const eventosLista = EVR.map((x, i) => ({ n: i + 1, t: x.t, tipo: x.tipo, desc: x.desc, cls: 'item' + (s.evento === i ? ' on' : ''), pick: () => this.setState({ evento: i }) }));
    const etapasLista = s.etapas.map((e2, i) => ({ n: i + 1, nome: e2.nome, tempo: e2.tempo || '', cls: 'item' + (s.etapa === i ? ' on' : ''), pick: () => this.setState({ etapa: i, sel: null }),
      ariaRemover: 'Remover a etapa ' + (i + 1) + ', ' + e2.nome,
      remover: () => {
        if (s.etapas.length < 2) return;
        this.pararPlay();
        const etapas = s.etapas.filter((x, k) => k !== i);
        const nova = s.etapa > i ? s.etapa - 1 : Math.min(s.etapa, etapas.length - 1);
        this.setState({ etapas: etapas, etapa: nova, sel: null, sels: [], tocando: false, hist: s.hist.concat([JSON.stringify(s.etapas)]).slice(-30), futuro: [] });
      } }));
    const abates = s.tipoCalor === 'abates';

    const posTitulo = isPlanejar ? 'Etapa ' + (s.etapa + 1) + ' de ' + s.etapas.length : 'Evento ' + (Math.min(s.evento, Math.max(EVR.length - 1, 0)) + 1) + ' de ' + EVR.length;
    const posSub = isPlanejar ? (et.tempo ? et.tempo + ' · ' : '') + et.nome : (ev ? 'Round ' + (rd ? rd.n : s.round) + ' · ' + ev.t + (rd && part ? ' · ' + (rd.atk === 'A' ? part.a : part.b) + ' ataca' : '') : (dadosMapa ? 'Round sem eventos' : 'Carregando partidas…'));
    const rodape = isCalor ? info.nome + ' · vetor do time' : (s.segs ? info.nome + ' · vetor do time · a visão para nas paredes' : info.nome + ' · carregando paredes…');

    return {
      modos, mapas, mapaAberto: s.mapaAberto,
      toggleMapas: () => this.setState({ mapaAberto: !s.mapaAberto }),
      isPlanejar, isRound, isCalor, temPlay: isPlanejar || isRound, temVisao: isRound,
      ladoCls: 'ladobtn ' + corAl, ladoNome: atk ? 'Ataque' : 'Defesa', trocarLado: () => { this.setState({ lado: atk ? 'defesa' : 'ataque', semAnima: true }); setTimeout(() => this.setState({ semAnima: false }), 80); }, sempre: true,
      timeMeuCls: 'seg' + (s.time === 'al' ? ' on' : ''), timeInimCls: 'seg' + (s.time === 'in' ? ' on' : ''),
      pickMeu: () => this.setState({ time: 'al' }), pickInim: () => this.setState({ time: 'in' }),
      funcoes, agentes, habs, agSelNome: nomeAg(s.agSel), mk, f,
      desfazer: desfazerFn, refazer: refazerFn, podeDesfazer: s.hist.length > 0, podeRefazer: s.futuro.length > 0,
      desfCls: 'tb' + (s.hist.length ? '' : ' off'), refCls: 'tb' + (s.futuro.length ? '' : ' off'),
      pecas, marcas, tracos, textos, cg, temGiro, giroX, giroY, temMini, miniX, miniY, miniOps,
      mostrarLixo: isPlanejar && !s.apres,
      ajuda: s.ajuda, ajudaAberta: s.ajuda && !s.apres, ajudaCls: 'tb' + (s.ajuda ? ' on' : ''), toggleAjuda: () => this.setState({ ajuda: !s.ajuda }),
      atalhos: [
        { titulo: 'Ferramentas', itens: [[['V'], 'Selecionar e mover'], [['H'], 'Mão: mover o mapa'], [['P'], 'Lápis'], [['A'], 'Seta'], [['T'], 'Texto'], [['E'], 'Borracha (só desenhos)']] },
        { titulo: 'Seleção', itens: [[['Arrastar no fundo'], 'Selecionar vários (com Mover)'], [['Shift', 'Clique'], 'Somar ou tirar da seleção'], [['Del'], 'Apagar a seleção'], [['Ctrl', 'C'], 'Copiar a seleção'], [['Ctrl', 'V'], 'Colar (vale em outra etapa ou mapa)'], [['Ctrl', 'X'], 'Recortar'], [['Setas'], 'Empurrar a seleção (Shift = mais longe)'], [['←', '→'], 'Etapa anterior / próxima (sem nada selecionado)'], [['Esc'], 'Limpar seleção / sair da apresentação']] },
        { titulo: 'Editar', itens: [[['Ctrl', 'Z'], 'Desfazer'], [['Ctrl', 'Shift', 'Z'], 'Refazer (ou Ctrl + Y)'], [['Arrastar da paleta'], 'Colocar no mapa'], [['Clique no item'], 'Visão, alcance e instrução']] },
        { titulo: 'Round real', itens: [[['←', '→'], 'Evento anterior / próximo'], [['↑', '↓'], 'Round anterior / próximo']] },
        { titulo: 'Apresentação', itens: [[['P'], 'Lápis temporário: o desenho some ao sair'], [['Esc'], 'Sair e apagar os desenhos']] },
        { titulo: 'Mapa', itens: [[['Roda do mouse'], 'Zoom'], [['Espaço', 'Arrastar'], 'Mover o mapa'], [['Botão do meio'], 'Mover o mapa'], [['?'], 'Abrir ou fechar esta lista']] }
      ].map((g) => ({ titulo: g.titulo, itens: g.itens.map((a) => ({ teclas: a[0].map((x) => ({ t: x })), desc: a[1] })) })),
      lixoCls: 'lixeira' + (s.drag && (s.drag.kind === 'grupo' || s.drag.kind === 'tx') ? ' arrastando' : '') + (s.sobreLixo ? ' sobre' : ''),
      lixoTxt: s.sobreLixo ? 'Solte para apagar' : (s.drag && (s.drag.kind === 'grupo' || s.drag.kind === 'tx') ? 'Arraste até aqui para apagar' : (selIds.length ? 'Apagar seleção' : 'Lixeira')),
      mapaNome: info.nome, mapaNomeUp: info.nome.toUpperCase(), mapaCor: info.cor, mapaImg: vis.img,
      aspecto: VW + ' / ' + VH, vb: '0 0 ' + VW + ' ' + VH, tview: 'matrix(' + VT.join(' ') + ')',
      sitios: info.sitios.map((q) => { const v = pct(q.x, q.y); return { t: q.t, x: v.x, y: v.y }; }),
      podeTrocarMapa: !s.apres, cmpIndisp: !EVR.length,
      rounds1: rounds.slice(0, 12), rounds2: rounds.slice(12, 24), roundsOT: rounds.slice(24), temRounds2: rounds.length > 12, temRoundsOT: rounds.length > 24,
      placarA: part ? part.pa : '–', placarB: part ? part.pb : '–',
      rdNum: rd ? rd.n : '–', atkNome: rd ? nomeT(rd.atk) : '–', ladoAtkCls2: 'ladoatk ' + (rd && rd.atk === 'B' ? 'b' : 'a'),
      vencNome: rd ? nomeT(rd.venc) : '–', vencDot: rd && rd.venc === 'B' ? 'tB' : 'tA',
      rdComo: rd ? (RES[rd.res] || rd.res || '') + (CER[rd.cer] ? ' · ' + CER[rd.cer] : '') : '',
      ecoA: rd ? classeEco(rd.eA, rd.n) + ' · ' + fmtNum(rd.eA) : '–', ecoB: rd ? classeEco(rd.eB, rd.n) + ' · ' + fmtNum(rd.eB) : '–',
      mapaBanCls: 'mcard ban ban-' + s.mapa,
      fbTxt: fbI >= 0 ? nj(rd.ev[fbI][2])[0] + ' · ' + EVR[fbI].t : '—', fbDot: fbI >= 0 ? (nj(rd.ev[fbI][2])[2] === 'A' ? 'tA' : 'tB') : '',
      tradesA: nTrades.A, tradesB: nTrades.B,
      ...(() => {
        // etiqueta em cima de quem fez o first blood / trade no evento atual
        const i = Math.min(s.evento, EVR.length - 1), tg = i >= 0 ? tagsEv[i] : '';
        const quem = tg ? EVR[i].j.find((p) => p[7] === EVR[i].raw[2]) : null;
        if (!quem) return { temTagMapa: false, tagMapaFb: false, tagMapaTr: false, tagMapaCls: '', tagMapaX: 0, tagMapaY: 0, tagMapaTxt: '' };
        const q = pct(quem[2], quem[3]);
        return { temTagMapa: true, tagMapaFb: tg === 'fb', tagMapaTr: tg === 'tr', tagMapaCls: 'tagmapa ' + tg, tagMapaX: q.x, tagMapaY: q.y, tagMapaTxt: tg === 'fb' ? 'First blood' : 'Trade' };
      })(),
      feed, nFeed: feed.length, marcasTempo, ltPos: EVR.length ? (EVR[Math.min(s.evento, EVR.length - 1)].raw[1] / durRound * 100).toFixed(2) : 0, ltFim: fmtT(durRound),
      vivosA: totA - mortosA, vivosB: totB - mortosB, temRoundUI: isRound && !!rd, naoRound: !isRound,
      tracer, tracerCor, nomesRound, nomes: !!s.nomes, nomesCls: 'chipv' + (s.nomes ? ' on' : ''), toggleNomes: () => this.setState({ nomes: !s.nomes }),
      listaPartidas: s.listaPartidas, toggleListaPartidas: () => this.setState({ listaPartidas: !s.listaPartidas }),
      partidaTitulo: part ? part.a + ' ' + part.pa + ' x ' + part.pb + ' ' + part.b : (dadosMapa ? 'Sem partidas neste mapa' : 'Carregando partidas…'),
      partidaSub: part ? info.nome + ' · ' + part.torneio + ' · ' + part.data : info.nome,
      nomeA: part ? part.a : 'Time A', nomeB: part ? part.b : 'Time B', nPartidas: partidasR.length, listaP,
      listaTimes: s.listaTimes, toggleListaTimes: () => this.setState({ listaTimes: !s.listaTimes }), timesCalor, calorN,
      calorTimeNome: s.calorTime || 'Todos',
      modoIdx: Math.max(0, ['planejar', 'round', 'calor'].indexOf(s.modo)), timeIdx: s.time === 'al' ? 0 : 1,
      jogadasAberta: !!s.jogadasAberta, compAberta: !!s.compAberta,
      abrirJogadas: () => { this.pararPlay(); this.setState({ jogadasAberta: true, tocando: false, mapaAberto: false, avisoJogada: '', erroImport: '', codigoImport: '', nomeJogada: s.nomeJogada || (info.nome + ' · ' + (atk ? 'Ataque' : 'Defesa') + ' · ' + new Date().toLocaleDateString('pt-BR')) }); },
      fecharJogadas: () => this.setState({ jogadasAberta: false }),
      nomeJogada: s.nomeJogada || '', mudarNomeJogada: (e) => this.setState({ nomeJogada: e.target.value }),
      resumoAtual: info.nome + ' · ' + (atk ? 'ataque' : 'defesa') + ' · ' + s.etapas.length + (s.etapas.length === 1 ? ' etapa' : ' etapas'),
      temAvisoJogada: !!s.avisoJogada, avisoJogada: s.avisoJogada || '',
      salvarJogada: () => {
        const nome = (s.nomeJogada || '').trim() || (info.nome + ' · ' + (atk ? 'Ataque' : 'Defesa'));
        const lista = this.lerJogadas();
        lista.unshift({ id: 'j' + Date.now(), nome: nome, mapa: s.mapa, lado: s.lado, etapas: JSON.parse(JSON.stringify(s.etapas)), criado: new Date().toISOString() });
        const ok = this.gravarJogadas(lista.slice(0, 60));
        this.setState({ avisoJogada: ok ? '“' + nome + '” salva.' : '“' + nome + '” salva só até fechar a página (este navegador bloqueou o armazenamento).', nomeJogada: '' });
      },
      nJogadas: this.lerJogadas().length, semJogadas: !this.lerJogadas().length,
      jogadas: this.lerJogadas().map((j) => ({ nome: j.nome, arte: ARTE_MAPA[j.mapa] || '',
        info: (MAPA_INFO[j.mapa] ? MAPA_INFO[j.mapa].nome : j.mapa) + ' · ' + (j.lado === 'defesa' ? 'defesa' : 'ataque') + ' · ' + j.etapas.length + (j.etapas.length === 1 ? ' etapa' : ' etapas') + ' · ' + new Date(j.criado).toLocaleDateString('pt-BR'),
        ariaComp: 'Código de ' + j.nome, ariaApagar: 'Apagar ' + j.nome,
        abrir: () => this.abrirJogada(j),
        compartilhar: () => { const obj = { nome: j.nome, mapa: j.mapa, lado: j.lado, etapas: j.etapas }, cod = paraCodigo(obj);
          this.setState({ compAberta: true, jogadasAberta: false, compTitulo: j.nome, compCodigo: cod, compAviso: '', compAvisoLink: '' }); this.encurtarCodigo(obj, cod); },
        apagar: () => { this.gravarJogadas(this.lerJogadas().filter((x) => x.id !== j.id)); this.setState({ avisoJogada: '“' + j.nome + '” apagada.' }); } })),
      codigoImport: s.codigoImport || '', mudarCodigoImport: (e) => this.setState({ codigoImport: e.target.value, erroImport: '' }),
      temErroImport: !!s.erroImport, erroImport: s.erroImport || '',
      importarCodigo: () => {
        const lido = lerLinkOuCodigo(s.codigoImport);
        lerCodigo(lido.codigo).then((cru) => {
          const j = normalizarJogada(cru);
          if (!j || !this.abrirJogada(j, lido.soVer)) { this.setState({ erroImport: 'Link ou código inválido. Confira se copiou ele inteiro.' }); return; }
          this.setState({ codigoImport: '' });
          const lista = this.lerJogadas(); lista.unshift({ id: 'j' + Date.now(), nome: j.nome || 'Jogada recebida', mapa: j.mapa, lado: j.lado, etapas: j.etapas, criado: new Date().toISOString() }); this.gravarJogadas(lista.slice(0, 60));
        });
      },
      abrirCompartilhar: () => { this.pararPlay(); const nome = (s.nomeJogada || '').trim() || (info.nome + ' · ' + (atk ? 'Ataque' : 'Defesa'));
        const obj = { nome: nome, mapa: s.mapa, lado: s.lado, etapas: s.etapas }, cod = paraCodigo(obj);
        this.setState({ compAberta: true, tocando: false, mapaAberto: false, compTitulo: nome, compCodigo: cod, compAviso: '', compAvisoLink: '' }); this.encurtarCodigo(obj, cod); },
      fecharComp: () => this.setState({ compAberta: false }), compTitulo: s.compTitulo || '', compCodigo: s.compCodigo || '', compAviso: s.compAviso || '',
      compLink: paraLink(s.compCodigo || '', !!s.compVer), linkLongo: paraLink(s.compCodigo || '', !!s.compVer).length > LIMITE_LINK,
      linkInvalido: !!s.linkInvalido, fecharLinkInvalido: () => this.setState({ linkInvalido: false }),
      modosLink: [[false, 'Editar uma cópia'], [true, 'Só visualizar']].map((o) => ({ nome: o[1], on: !!s.compVer === o[0] ? 'true' : 'false', cls: 'seg' + (!!s.compVer === o[0] ? ' on' : ''), pick: () => this.setState({ compVer: o[0], compAvisoLink: '' }) })),
      modoLinkDica: s.compVer ? 'Abre direto na apresentação, sem poder mexer. Bom para o jogador estudar antes do treino.' : 'Abre a jogada na prancheta da pessoa, pronta para mexer. A sua original não muda.',
      temAvisoLink: !!s.compAvisoLink, compAvisoLink: s.compAvisoLink || '',
      copiarLink: () => this.copiarTexto(paraLink(s.compCodigo || '', !!s.compVer), 'input[aria-label="Link da jogada"]', 'compAvisoLink'),
      soVer: !!s.soVer, naoSoVer: !s.soVer,
      editarCopia: () => this.setState({ soVer: false, apres: false, apLapis: false, riscos: [], ferramenta: 'mover' }),
      selecionarTudo: (e) => { try { e.target.select(); } catch (err) {} },
      copiarCodigo: () => this.copiarTexto(s.compCodigo || '', 'textarea[aria-label="Código da jogada"]', 'compAviso'),
      novaAberta: !!s.novaAberta, abrirNova: () => { this.pararPlay(); this.setState({ novaAberta: true, mapaAberto: false, tocando: false }); }, fecharNova: () => this.setState({ novaAberta: false }),
      novaMapas: Object.keys(MAPA_INFO).map((k) => ({ nome: MAPA_INFO[k].nome, arte: ARTE_MAPA[k], atual: k === s.mapa ? 'mapa atual' : '', aria: 'Nova estratégia em ' + MAPA_INFO[k].nome, pick: () => this.novaEstrategia(k) })),
      naoApres: !s.apres, apresentacao: s.apres, toggleApres: () => this.setState({ apres: !s.apres, sel: null, mapaAberto: false, apLapis: !s.apres, riscos: [] }),
      lapisApCls: 'tb zb' + (s.apLapis ? ' on' : ''), apLapisAtivo: !!s.apLapis, apLapisOn: s.apLapis ? 'true' : 'false', toggleLapisAp: () => this.setState({ apLapis: !s.apLapis }),
      temRiscos: !!(s.riscos && s.riscos.length), limparRiscos: () => this.setState({ riscos: [] }),
      riscosLista: (s.riscos || []).map((r) => ({ cor: r.c, d: 'M' + r.p.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L') + (r.p.length === 1 ? 'l0.1 0' : '') })),
      mostraPaleta: isPlanejar && (s.ferramenta === 'lapis' || s.ferramenta === 'seta'),
      coresLapis: CORES_LAPIS.map((c) => ({ nome: c[1], cor: c[0], on: (s.corLapis || '#ECE8E1') === c[0] ? 'true' : 'false', cls: 'cor-bola' + ((s.corLapis || '#ECE8E1') === c[0] ? ' on' : ''), pick: () => this.setState({ corLapis: c[0] }) })),
      coresApres: CORES_LAPIS.map((c) => ({ nome: c[1], cor: c[0], on: (s.corApres || '#FF4655') === c[0] ? 'true' : 'false', cls: 'cor-bola' + ((s.corApres || '#FF4655') === c[0] ? ' on' : ''), pick: () => this.setState({ corApres: c[0], apLapis: true }) })),
      mostrarFerr: isPlanejar && !s.apres,

      passoAnt: () => { if (isPlanejar) this.setState({ etapa: (s.etapa + s.etapas.length - 1) % s.etapas.length }); else if (isRound && EVR.length) this.setState({ evento: (s.evento + EVR.length - 1) % EVR.length }); },
      passoProx: () => { if (isPlanejar) this.setState({ etapa: (s.etapa + 1) % s.etapas.length }); else if (isRound && EVR.length) this.setState({ evento: (s.evento + 1) % EVR.length }); },
      abasEsq: [['agentes', 'Agentes'], ['habilidades', 'Habilidades'], ['marcadores', 'Marcadores']].map((a) => ({ nome: a[1], on: s.abaEsq === a[0], cls: 'abtn' + (s.abaEsq === a[0] ? ' on' : ''), pick: () => this.setState({ abaEsq: a[0] }) })),
      isAbaAg: s.abaEsq === 'agentes', isAbaHab: s.abaEsq === 'habilidades', isAbaMk: s.abaEsq === 'marcadores',
      abasDir: [['etapas', 'Etapas'], ['instrucoes', 'Instruções'], ['comparar', 'Comparar']].map((a) => ({ nome: a[1], on: s.abaDir === a[0], cls: 'abtn' + (s.abaDir === a[0] ? ' on' : ''), pick: () => this.setState({ abaDir: a[0] }) })),
      isAbaEt: s.abaDir === 'etapas', isAbaIn: s.abaDir === 'instrucoes', isAbaCmp: s.abaDir === 'comparar',
      habGrupos, semHabGrupos: habGrupos.length === 0,
      temNota, notaVal, notaMudar, notasMapa, instrucoes, semInstr: instrucoes.length === 0, fantasmas, fios, desvios, fantOps, temFantasma: desvios.length > 0,
      etNome: et.nome, etTempo: et.tempo || '',
      mudarNome: (e) => { const v = e.target.value; this.editar((e2) => { e2.nome = v; }, false); },
      mudarTempo: (e) => { const v = e.target.value; this.editar((e2) => { e2.tempo = v; }, false); },
      miniTitulo, miniAviso, miniAvisoCor: miniAviso.indexOf('Fora') === 0 ? '#FF7A7A' : '#9AA6B2',
      hg, formas, anel, anelCor, temPontas, paX, paY, pbX, pbY, temCurva, pcX, pcY,
      pcDown: (e) => { e.stopPropagation(); this.setState({ drag: { kind: 'pc', id: s.sel, hist: true } }); },
      paDown: (e) => { e.stopPropagation(); this.setState({ drag: { kind: 'pa', id: s.sel, hist: true } }); },
      pbDown: (e) => { e.stopPropagation(); this.setState({ drag: { kind: 'pb', id: s.sel, hist: true } }); },
      palcoCls: 'palco' + (!s.drag && !s.semAnima && !this._travaAnima ? ' anima' : ''),
      z: s.z.toFixed(3), ox: s.ox.toFixed(1), oy: s.oy.toFixed(1), zoomPct: Math.round(s.z * 100) + '%',
      rolar: (e) => { const r = e.currentTarget.getBoundingClientRect(); this.zoomPara(s.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY, e.currentTarget); },
      zoomMais: (e) => { const v = e.currentTarget.closest('.vista'), r = v.getBoundingClientRect(); this.zoomPara(s.z * 1.3, r.left + r.width / 2, r.top + r.height / 2, v); },
      zoomMenos: (e) => { const v = e.currentTarget.closest('.vista'), r = v.getBoundingClientRect(); this.zoomPara(s.z / 1.3, r.left + r.width / 2, r.top + r.height / 2, v); },
      zoomReset: () => this.setState({ z: 1, ox: 0, oy: 0 }),
      giroDown: (e) => { e.stopPropagation(); this.setState({ drag: { kind: 'rot', id: s.sel, hist: true } }); },
      fundoDown, mover, soltar, sobreMapa, largarNoMapa, tecla, teclaSolta: (e) => { if (e.key === ' ') this.espaco = false; },
      temMira: isPlanejar && s.ferramenta === 'borracha' && !!s.mira,
      miraX: s.mira ? pct(s.mira[0], s.mira[1]).x : 0, miraY: s.mira ? pct(s.mira[0], s.mira[1]).y : 0, miraD: (24 / s.z / VW * 100).toFixed(2),
      sairMapa: () => { soltar(); if (this.state.mira) this.setState({ mira: null }); },
      temLaco, laco, temBarraSel: isPlanejar && selIds.length > 1, nSel: selIds.length,
      excluirSel: () => { apagarVarios(selIds); this.setState({ sel: null }); }, limparSel: () => this.setState({ sel: null }),
      cursor: s.apres && s.apLapis ? 'crosshair' : s.drag && s.drag.kind === 'pan' ? 'grabbing' : (!isPlanejar || s.ferramenta === 'mao' ? 'grab' : (s.ferramenta === 'mover' ? 'default' : (s.ferramenta === 'borracha' ? 'none' : 'crosshair'))),
      visao: s.visao, visaoCls: 'chipv' + (s.visao ? ' on' : ''), toggleVisao: () => this.setState({ visao: !s.visao }), parar: (e) => e.stopPropagation(),
      rounds, roundSel: s.round, eventosLista, xCls, xX, xY,
      etapasLista, podeRemoverEtapa: s.etapas.length > 1,
      novaEtapa: () => { const n = JSON.parse(JSON.stringify(et)); n.nome = 'Nova etapa'; const etapas = s.etapas.concat([n]); this.setState({ etapas: etapas, etapa: etapas.length - 1, hist: s.hist.concat([JSON.stringify(s.etapas)]), futuro: [] }); },
      copiarRound: () => {
        // o round inteiro vira um plano: uma etapa por evento, na ordem em que aconteceu
        if (!EVR.length || !part) return;
        const nJog = part.jog.length, morteEm = {}, ultimo = {};
        EVR.forEach((x, k) => { if (x.raw[0] === 'k' && x.raw[3] >= 0 && morteEm[x.raw[3]] === undefined) morteEm[x.raw[3]] = k; });
        // quem morre mais tarde fica no começo da lista: assim as peças só saem do fim e cada uma "anda" de uma etapa para a outra
        const ordem = []; for (let ij = 0; ij < nJog; ij++) ordem.push(ij);
        ordem.sort((a, b) => (morteEm[b] === undefined ? 1e9 : morteEm[b]) - (morteEm[a] === undefined ? 1e9 : morteEm[a]) || a - b);
        let spike = null;
        const novas = EVR.map((x, k) => {
          x.j.forEach((p) => { ultimo[p[7]] = p; });
          const e = x.raw;
          if (e[0] === 'p') spike = [e[4], e[5]];
          if (e[0] === 'd') spike = null;
          const pecas = [];
          ordem.forEach((ij) => {
            if (morteEm[ij] !== undefined && morteEm[ij] < k) return;
            const p = ultimo[ij]; if (!p) return;
            pecas.push({ id: 'r' + ij, tipo: 'agente', time: p[0] === 'a' ? 'al' : 'in', ag: p[6], x: p[2], y: p[3], ang: p[4], visao: s.visao ? 'largo' : null });
          });
          const tracos = [];
          if (e[0] === 'k') { const kl = x.j.find((p) => p[7] === e[2]); if (kl) tracos.push({ id: 'tr' + k, kind: 'seta', pts: [[kl[2], kl[3]], [e[4], e[5]]] }); }
          const marcas = spike ? [{ id: 'sp', tipo: 'marca', icone: 'spike', x: spike[0], y: spike[1], nota: 'spike plantada' }] : [];
          const A = nj(e[2]), V = e[3] >= 0 ? nj(e[3]) : null;
          const nome = e[0] === 'k' ? A[0] + ' abateu ' + (V ? V[0] : '?') : (e[0] === 'p' ? A[0] + ' plantou' + (e[7] ? ' no ' + e[7] : '') : A[0] + ' desarmou');
          return { nome: nome, tempo: x.t, pecas: pecas, marcas: marcas, tracos: tracos, textos: [] };
        });
        this.pararPlay();
        // substitui o plano atual; Ctrl+Z traz o plano anterior de volta
        this.setState({ etapas: novas, etapa: 0, modo: 'planejar', lado: 'ataque', tocando: false, sel: null, sels: [], hist: s.hist.concat([JSON.stringify(s.etapas)]).slice(-30), futuro: [] });
      },
      tiposCalor: [['abates', 'Abates'], ['mortes', 'Mortes'], ['plants', 'Plants']].map((o) => ({ nome: o[1], cls: 'seg' + (s.tipoCalor === o[0] ? ' on' : ''), pick: () => this.setState({ tipoCalor: o[0] }) })),
      ladosCalor: [['todos', 'Todos'], ['atk', 'Ataque'], ['def', 'Defesa']].map((o) => ({ nome: o[1], cls: 'seg' + ((s.calorLado || 'todos') === o[0] ? ' on' : ''), pick: () => this.setState({ calorLado: o[0] }) })),
      fasesCalor: [['todo', 'Todo'], ['inicio', '0–30s'], ['meio', '30–60s'], ['fim', '60s+']].map((o) => ({ nome: o[1], cls: 'seg' + ((s.calorFase || 'todo') === o[0] ? ' on' : ''), pick: () => this.setState({ calorFase: o[0] }) })),
      mascaraCls: 'mascara mascara-' + s.mapa + '-' + ladoK,
      celulas, pontosCalor, calorMancha: visual === 'mancha', calorPontos: visual === 'pontos',
      visManchaCls: 'seg' + (visual === 'mancha' ? ' on' : ''), visPontosCls: 'seg' + (visual === 'pontos' ? ' on' : ''),
      pickMancha: () => this.setState({ calorVisual: 'mancha' }), pickPontos: () => this.setState({ calorVisual: 'pontos' }),
      legPontoA: s.tipoCalor === 'plants' ? 'Plant' : (s.tipoCalor === 'mortes' ? 'Morreu atacando' : 'Matou atacando'), legPontoB: s.tipoCalor === 'plants' ? '—' : (s.tipoCalor === 'mortes' ? 'Morreu defendendo' : 'Matou defendendo'),
      calorAvisoTxt: AMB.calor ? AMB.calor.nota(s.mapa, s.tipoCalor) : '', calorAviso: !!(AMB.calor && AMB.calor.nota(s.mapa, s.tipoCalor)),
      pontosNota: AMB.calor && AMB.calor.nota(s.mapa, s.tipoCalor) ? AMB.calor.nota(s.mapa, s.tipoCalor) : AMB.calorVazio ? 'Os eventos do mapa de calor entram assim que a base estiver no ar.' : calorN > 2500 ? 'Mostrando uma amostra de 2.500 dos ' + calorN + ' eventos. Filtre por time para ver todos.' : 'Todos os ' + calorN + ' eventos do recorte.',
      ecosCalor: [['todas', 'Todas'], ['pistol', 'Pistol'], ['eco', 'Eco'], ['forca', 'Força'], ['full', 'Full']].map((o) => ({ nome: o[1], cls: 'seg' + ((s.calorEco || 'todas') === o[0] ? ' on' : ''), pick: () => this.setState({ calorEco: o[0] }) })),
      temArea: !!s.calorPt, semArea: !s.calorPt,
      areaX: s.calorPt ? pct(s.calorPt[0], s.calorPt[1]).x : 0, areaY: s.calorPt ? pct(s.calorPt[0], s.calorPt[1]).y : 0, areaW: (RAIO_AREA * W * 2 / VW * 100).toFixed(2),
      areaResumo: areaRounds.length ? areaRounds.length + (areaRounds.length === 1 ? ' round' : ' rounds') + ' com eventos aqui, dentro dos filtros' + (areaRounds.length > 40 ? ' (mostrando os 40 primeiros)' : '') + '.' : 'Nenhum evento do recorte nesta área. Tente outro ponto ou afrouxe os filtros.',
      areaLista: areaRounds.slice(0, 40).map((a) => ({ cab: a.cab, jogo: a.jogo, desc: a.desc, extra: a.n > 1 ? a.n + ' eventos' : '',
        pick: () => this.abrirEventoCalor(a) })),
      limparArea: () => this.setState({ calorPt: null }),
      calorRotulo: s.tipoCalor === 'plants' ? 'plants' : (s.tipoCalor === 'mortes' ? 'mortes' : 'abates'),
      calorAjuda: s.tipoCalor === 'plants' ? 'Onde a spike foi plantada. Com um time escolhido, só os plants dele.'
        : (s.tipoCalor === 'mortes' ? 'Onde os jogadores morreram. Com um time escolhido: onde ESSE time costuma morrer.'
        : 'Onde as vítimas caíram. Com um time escolhido: onde ESSE time costuma conseguir os abates.'),
      posTitulo, posSub, rodape,
      tocando: s.tocando, parado: !s.tocando, playLabel: s.tocando ? 'Pausar' : 'Tocar',
      togglePlay: () => this.togglePlay()
    };
  }
}

return Component;
}
