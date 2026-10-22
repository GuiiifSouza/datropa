// Teste offline do carregador real, sem navegador, API ou BigQuery.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

class ErroApi extends Error {
  constructor(status) { super(String(status)); this.status = status; }
}
const codigo = ts.transpileModule(readFileSync(new URL('../../src/prancheta/calor.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

for (const antigo of [false, true]) {
  const chamadas = [], ids = new Set();
  let ativos = 0, maxAtivos = 0;
  const dados = { async calorMapa(mapa, tipo, page, tamanho) {
    chamadas.push({ page, tamanho });
    assert.equal(mapa, 'ascent');
    assert.equal(tipo, 'abate');
    if (antigo && tamanho > 100) throw new ErroApi(400);
    ativos++; maxAtivos = Math.max(maxAtivos, ativos);
    await new Promise(setImmediate);
    ativos--;
    const inicio = (page - 1) * tamanho;
    const data = Array.from({ length: Math.min(tamanho, 11714 - inicio) }, (_, i) => ({
      evento_id: String(inicio + i), x: inicio + i, y: 0, peso: 1,
    }));
    return { data, pagination: { page, page_size: tamanho, total: 11714 } };
  } };
  const exports = {};
  const require = (nome) => {
    if (nome === '../api/cliente') return { ErroApi };
    if (nome === '../api/stats') return { dados };
    if (nome === './reais') return { MAPA_ID: { ascent: 'ascent' }, paraMapa: (_, x, y) => [x, y] };
    throw new Error(nome);
  };
  vm.runInNewContext(codigo, { exports, require, setTimeout, Date, console });
  const calor = exports.criarCalor();
  await new Promise((resolve, reject) => {
    const limite = setTimeout(() => reject(new Error('download não terminou')), 3000);
    calor.garantir('ascent', 'abates', () => {
      if (calor.nota('ascent', 'abates') === '') { clearTimeout(limite); resolve(); }
    });
  });
  for (const p of calor.pontos('ascent', 'abates')) ids.add(p.evento_id);
  assert.equal(ids.size, 11714);
  assert.equal(calor.pontos('ascent', 'abates').length, 11714);
  assert.equal(chamadas.length, antigo ? 119 : 12);
  assert.ok(maxAtivos <= 4);
  calor.garantir('ascent', 'abates', () => {});
  assert.equal(chamadas.length, antigo ? 119 : 12);
  console.log(`OK: API ${antigo ? 'antiga (compatibilidade)' : 'nova'}, 11714 pontos sem duplicação; ${chamadas.length} requisições.`);
}
