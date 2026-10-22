import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const codigo = readFileSync(new URL('../../src/prancheta/gerado/logica.js', import.meta.url), 'utf8');
const { criarPrancheta } = await import('data:text/javascript;base64,' + Buffer.from(codigo).toString('base64'));
class Base { setState(p) { Object.assign(this.state, p); } }
const C = criarPrancheta(Base, { reais: { detalhar() {} } });
function instancia(ev = null) {
  const c = new C({}); c.state.mapa = 'ascent';
  c.state.reais = { ascent: { partidas: [{ rounds: [{ n: 1, ev }] }] } }; return c;
}
const evento = (id, ms) => ['k', ms, 0, 1, 100, 100, [], undefined, id];
const eventos = [evento('primeiro', 21000), evento('outro-no-mesmo-segundo', 32100), evento('alvo', 32900)];
for (const carregado of [false, true]) {
  const c = instancia(carregado ? eventos : null);
  c.abrirEventoCalor({ pi: 0, ri: 0, ei: 0, alvo: 'alvo' });
  if (!carregado) { c.componentDidUpdate(); assert.ok(c.alvoCalor); c.state.reais.ascent.partidas[0].rounds[0].ev = eventos; }
  c.componentDidUpdate(); assert.equal(c.state.evento, 2); assert.equal(c.alvoCalor, null);
  c.state.evento = 1; c.componentDidUpdate(); assert.equal(c.state.evento, 1);
}
const c = instancia(); c.abrirEventoCalor({ pi: 0, ri: 0, ei: 0, alvo: 'alvo' });
c.state.round = 2; c.componentDidUpdate(); assert.equal(c.alvoCalor, null);
console.log('OK: evento exato por ID; cache e carga tardia; navegação manual preservada.');
