import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const fonte = readFileSync(new URL('../../src/util/logosTimes.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
const { logoTime } = exports;
for (const [nome, arquivo] of [
  ['CEUB Octopus', 'ceub_octopus'], ['Ceub Octopus Vulgaris', 'ceub_octopus'],
  ['Azure Bears Golden', 'azure_bears'], ['Azure Bears White', 'azure_bears'],
  ['USP Stars GC', 'usp_stars'], ['UFG GC Eagles', 'ufg_eagles'],
  ['Green Owls Noctua', 'green_owls'], ['Mauá Blue', 'maua_blue'],
  ['PUCGO Sistemática Academy', 'pucgo_sistematica'],
  ['Inatel Legacy', 'inatel_legacy'], ['Inatel Gray', 'inatel'],
  ['Macklogic White', 'macklogic_white'], ['Macklogic Red', 'macklogic_red'],
]) assert.equal(logoTime(nome), `/logos-times/${arquivo}.png`);
for (const nome of [null, '', 'Time inexistente', 'Caap Auroras', 'Axis Aura']) assert.equal(logoTime(nome), null);
const times = JSON.parse(readFileSync(new URL('../../public/snapshot/times.json', import.meta.url), 'utf8'));
let cobertos = 0;
for (const time of times) {
  const logo = logoTime(time.nome);
  if (logo) { cobertos++; assert.ok(existsSync(new URL('../../public' + logo, import.meta.url)), logo); }
}
assert.equal(cobertos, 48);
console.log(`OK: ${cobertos}/${times.length} times com logo disponível; aliases e imagens conferidos; fallback para ausentes.`);
