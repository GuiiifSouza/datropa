// Testes de infra/firestore.rules no emulador do Firestore.
// Rode com `npm test` nesta pasta (precisa de Java 21+ para o emulador).
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const REGRAS = new URL('../firestore.rules', import.meta.url);

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-datropa',
    firestore: { rules: readFileSync(REGRAS, 'utf8') },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const ana = () => env.authenticatedContext('ana').firestore();
const beto = () => env.authenticatedContext('beto').firestore();
const anonimo = () => env.unauthenticatedContext().firestore();

const estrategia = (extra = {}) => ({
  dono: 'ana',
  titulo: 'Retake B',
  mapa: 'Ascent',
  lado: 'defesa',
  dados: JSON.stringify({ etapas: [{ pecas: [], desenhos: [] }] }),
  criado_em: serverTimestamp(),
  atualizado_em: serverTimestamp(),
  ...extra,
});

// Grava um documento sem passar pelas regras (estado inicial do teste).
async function semRegras(caminho, dados) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), caminho), dados);
  });
}

describe('usuarios', () => {
  test('dono cria, lê, edita e apaga o próprio perfil', async () => {
    const db = ana();
    await assertSucceeds(setDoc(doc(db, 'usuarios/ana'), { nome: 'Ana', criado_em: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(db, 'usuarios/ana')));
    await assertSucceeds(updateDoc(doc(db, 'usuarios/ana'), { time_favorito: 'time-x', preferencias: { tema: 'escuro' } }));
    await assertSucceeds(deleteDoc(doc(db, 'usuarios/ana')));
  });

  test('ninguém lê nem escreve o perfil de outro', async () => {
    await semRegras('usuarios/beto', { nome: 'Beto' });
    const db = ana();
    await assertFails(getDoc(doc(db, 'usuarios/beto')));
    await assertFails(setDoc(doc(db, 'usuarios/beto'), { nome: 'Invasor' }));
    await assertFails(deleteDoc(doc(db, 'usuarios/beto')));
  });

  test('sem login não acessa perfil', async () => {
    await semRegras('usuarios/ana', { nome: 'Ana' });
    await assertFails(getDoc(doc(anonimo(), 'usuarios/ana')));
  });

  test('não lista a coleção de usuários', async () => {
    await assertFails(getDocs(collection(ana(), 'usuarios')));
  });

  test('rejeita campo fora do modelo e texto grande', async () => {
    const db = ana();
    await assertFails(setDoc(doc(db, 'usuarios/ana'), { nome: 'Ana', admin: true }));
    await assertFails(setDoc(doc(db, 'usuarios/ana'), { nome: 'x'.repeat(81) }));
  });
});

describe('estrategias', () => {
  test('dono cria com código válido', async () => {
    await assertSucceeds(setDoc(doc(ana(), 'estrategias/abc123'), estrategia()));
  });

  test('não cria em nome de outro', async () => {
    await assertFails(setDoc(doc(ana(), 'estrategias/abc123'), estrategia({ dono: 'beto' })));
  });

  test('sem login não cria', async () => {
    await assertFails(setDoc(doc(anonimo(), 'estrategias/abc123'), estrategia()));
  });

  test('código curto fora do padrão é rejeitado', async () => {
    await assertFails(setDoc(doc(ana(), 'estrategias/abc'), estrategia()));
    await assertFails(setDoc(doc(ana(), 'estrategias/abc 123!'), estrategia()));
  });

  test('campos obrigatórios, campo extra e tipos', async () => {
    const db = ana();
    const { dados, ...semDados } = estrategia();
    await assertFails(setDoc(doc(db, 'estrategias/abc123'), semDados));
    await assertFails(setDoc(doc(db, 'estrategias/abc123'), estrategia({ publico: true })));
    await assertFails(setDoc(doc(db, 'estrategias/abc123'), estrategia({ lado: 'meio' })));
    await assertFails(setDoc(doc(db, 'estrategias/abc123'), estrategia({ round: 0 })));
    await assertFails(setDoc(doc(db, 'estrategias/abc123'), estrategia({ dados: { etapas: [] } })));
    await assertSucceeds(setDoc(doc(db, 'estrategias/abc123'), estrategia({ partida_id: 'p1', round: 7 })));
  });

  test('documento grande demais é rejeitado', async () => {
    const db = ana();
    await assertFails(setDoc(doc(db, 'estrategias/abc123'), estrategia({ dados: 'x'.repeat(300001) })));
    await assertSucceeds(setDoc(doc(db, 'estrategias/abc123'), estrategia({ dados: 'x'.repeat(300000) })));
  });

  test('qualquer usuário logado abre pelo código; sem login não abre', async () => {
    await semRegras('estrategias/abc123', { dono: 'ana', mapa: 'Ascent', dados: '{}' });
    await assertSucceeds(getDoc(doc(beto(), 'estrategias/abc123')));
    await assertFails(getDoc(doc(anonimo(), 'estrategias/abc123')));
  });

  test('lista só as próprias', async () => {
    await semRegras('estrategias/abc123', { dono: 'ana', mapa: 'Ascent', dados: '{}' });
    await semRegras('estrategias/def456', { dono: 'beto', mapa: 'Bind', dados: '{}' });
    const db = ana();
    await assertSucceeds(getDocs(query(collection(db, 'estrategias'), where('dono', '==', 'ana'))));
    await assertFails(getDocs(collection(db, 'estrategias')));
    await assertFails(getDocs(query(collection(db, 'estrategias'), where('dono', '==', 'beto'))));
  });

  test('só o dono edita e apaga', async () => {
    await semRegras('estrategias/abc123', { dono: 'ana', mapa: 'Ascent', dados: '{}' });
    await assertFails(updateDoc(doc(beto(), 'estrategias/abc123'), { titulo: 'roubada' }));
    await assertFails(deleteDoc(doc(beto(), 'estrategias/abc123')));
    await assertSucceeds(updateDoc(doc(ana(), 'estrategias/abc123'), { titulo: 'Exec A', atualizado_em: serverTimestamp() }));
    await assertSucceeds(deleteDoc(doc(ana(), 'estrategias/abc123')));
  });

  test('dono não transfere a estratégia nem troca criado_em', async () => {
    await semRegras('estrategias/abc123', { dono: 'ana', mapa: 'Ascent', dados: '{}', criado_em: new Date(0) });
    await assertFails(updateDoc(doc(ana(), 'estrategias/abc123'), { dono: 'beto' }));
    await assertFails(updateDoc(doc(ana(), 'estrategias/abc123'), { criado_em: serverTimestamp() }));
  });
});

describe('cache e resto', () => {
  test('cliente não lê nem escreve o cache do stats', async () => {
    await semRegras('cache/ranking', { data: [] });
    await assertFails(getDoc(doc(ana(), 'cache/ranking')));
    await assertFails(setDoc(doc(ana(), 'cache/ranking'), { data: [] }));
  });

  test('coleção desconhecida é negada', async () => {
    await assertFails(setDoc(doc(ana(), 'qualquer/coisa'), { a: 1 }));
    await assertFails(getDoc(doc(ana(), 'qualquer/coisa')));
  });
});
