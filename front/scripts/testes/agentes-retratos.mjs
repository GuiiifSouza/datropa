// Confere os retratos contra a ordem usada na prancheta e o componente compartilhado.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
const require = createRequire(import.meta.url);
const ler = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const compilar = (fonte, mocks = {}) => {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: (p) => p in mocks ? mocks[p] : require(p) });
  return exports;
};
const arte = compilar(ler('../../src/util/arteAgentes.ts'));
const logica = ler('../../src/prancheta/gerado/logica.js');
const trecho = logica.slice(logica.indexOf('var AGENTES = ['), logica.indexOf('var IDX ='));
const agentes = [...trecho.matchAll(/\['([^']+)', '([^']+)', '(?:Controlador|Iniciador|Sentinela|Duelista)'/g)];
assert.equal(agentes.length, 29);
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
let nome = '';
const { Agente } = compilar(ler('../../src/componentes/Visuais.tsx').replace("import.meta.env.VITE_ARTE_RIOT", "'1'"), {
  '../api/cliente': {}, '../rotas': {}, '../util/logosTimes': {},
  '../util/formato': { slugAgente: slug }, '../util/arteAgentes': arte,
  './Catalogo': { useCatalogo: () => ({ agente: () => nome, classe: () => 'Controlador' }) },
});
agentes.forEach((a, i) => {
  nome = a[2];
  const rosto = arte.rostoAgente(slug(nome));
  assert.equal(rosto.backgroundPosition, `${i % 6 / 5 * 100}% ${Math.floor(i / 6) / 4 * 100}%`);
  for (const tamanho of ['p', 'm', 'g']) {
    const html = renderToStaticMarkup(createElement(Agente, { id: a[1], tamanho }));
    assert.ok(html.includes(`agente--${tamanho}`));
    assert.ok(html.includes('/arte/prancheta/agentes.png'));
    assert.ok(!html.includes('/arte/agentes/rosto/'));
    assert.ok(html.endsWith('></span>')); // Nenhuma inicial cobre o retrato.
  }
});
assert.equal(arte.rostoAgente('desconhecido'), null);
console.log('OK: 29 agentes na ordem da prancheta, inclusive KAY/O; três tamanhos preservados.');
