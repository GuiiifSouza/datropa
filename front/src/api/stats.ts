/**
 * Fachada única de dados das telas. Cada função segue uma rota de docs/api.md:
 * tenta /api/stats e, no modo auto, cai no snapshot quando a rota ainda não está no ar.
 * As funções marcadas "só snapshot" ainda não têm rota no contrato (pedidos em front/docs/pedidos.md).
 */
import { comFallback, ErroApi, MODO } from './cliente';
import * as S from './snapshot';
import type { Catalogos, Filtros, JogadorDetalhe, Lista, Meta, Objeto, OrdemRanking, PartidaDetalhe, PartidaItem, RankingItem, TimeDetalhe } from './tipos';

const enc = encodeURIComponent;
type Pag = { page?: number; page_size?: number };

/** Converte "não encontrado" do snapshot no mesmo erro que a API devolveria. */
async function local<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof S.NaoEncontrado) throw new ErroApi(404, 'NOT_FOUND', e.message);
    throw e;
  }
}

const ORDENS_API: OrdemRanking[] = ['kills_desc', 'kd_desc', 'adr_desc'];

// ---- extras: a API manda os campos do contrato; o que ela ainda não tem (ACS, KAST, multikills,
// partidas recentes, compras e placar por round) vem do snapshot, que usa os mesmos IDs da gold.
// Só preenche campo ausente: valor que veio da API nunca é trocado.

/** Copia de `extra` só as chaves que `base` não tem (undefined). */
function completar<T extends object>(base: T, extra: object | undefined): T {
  if (!extra) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(extra)) if (out[k] === undefined) out[k] = v;
  return out as T;
}

/** Roda o enriquecimento sem deixar erro do snapshot derrubar a resposta da API. */
async function comExtras<T extends { meta: Meta }>(r: T, fn: (r: T) => Promise<T>): Promise<T> {
  if (r.meta.fonte !== 'api' || MODO === 'api') return r;
  try {
    return await fn(r);
  } catch {
    return r;
  }
}

type FiltroRanking = Filtros & { agente_id?: string; time_id?: string };
const rankingLocal = (f: FiltroRanking) => S.ranking({ ...f, page: 1, page_size: 1000 });

async function extrasRanking(r: Lista<RankingItem>, f: FiltroRanking): Promise<Lista<RankingItem>> {
  const loc = new Map((await rankingLocal(f)).data.map((x) => [x.jogador_id, x]));
  return { ...r, data: r.data.map((x) => completar(x, loc.get(x.jogador_id))) };
}

async function extrasJogador(r: Objeto<JogadorDetalhe>, id: string, f: Filtros & { agente_id?: string }): Promise<Objeto<JogadorDetalhe>> {
  const loc = (await S.jogador(id, f)).data;
  const ag = new Map(loc.agentes.map((a) => [a.agente_id, a]));
  const mp = new Map(loc.mapas.map((m) => [m.mapa_id, m]));
  const d = r.data;
  return {
    ...r,
    data: {
      ...completar(d, { tag: loc.tag, partidas_recentes: loc.partidas_recentes }),
      resumo: completar(d.resumo, loc.resumo),
      agentes: d.agentes.map((a) => completar(a, ag.get(a.agente_id))),
      mapas: d.mapas.map((m) => completar(m, mp.get(m.mapa_id))),
    },
  };
}

async function extrasPartida(r: Objeto<PartidaDetalhe>, id: string): Promise<Objeto<PartidaDetalhe>> {
  const loc = (await S.partida(id)).data;
  const jg = new Map(loc.jogadores.map((j) => [j.jogador_id, j]));
  const rd = new Map(loc.rounds.map((x) => [x.round, x]));
  const d = r.data;
  return {
    ...r,
    data: {
      ...completar(d, { versao: loc.versao, duracao_ms: loc.duracao_ms }),
      jogadores: d.jogadores.map((j) => completar(j, jg.get(j.jogador_id))),
      rounds: d.rounds.map((x) => completar(x, rd.get(x.round))),
    },
  };
}

async function extrasPartidas(r: Lista<PartidaItem>): Promise<Lista<PartidaItem>> {
  const loc = new Map((await S.partidas({ page_size: 1000 })).data.map((p) => [p.id, p]));
  return { ...r, data: r.data.map((p) => completar(p, loc.get(p.id))) };
}

// ---- nomes e ordem: o front não depende do formato exato da API ----

/** Nome ausente ou igual ao próprio ID (ex.: torneio "UNIVAVA_G") não serve para exibição. */
function nomeCru(nome: string | null | undefined, id: string): boolean {
  const n = (nome ?? '').trim();
  return !n || n.toLowerCase() === id.trim().toLowerCase();
}

/** Completa cada item de um catálogo da API com o do snapshot (mesmo ID): campo ausente e nome cru. */
function juntarCatalogo<T extends { id: string; nome?: string | null }>(api: T[] | undefined, snap: T[] | undefined): T[] {
  if (!api) return snap ?? [];
  const loc = new Map((snap ?? []).map((x) => [x.id, x]));
  return api.map((x) => {
    const s = loc.get(x.id);
    if (!s) return x;
    const out = completar(x, s);
    return nomeCru(x.nome, x.id) && !nomeCru(s.nome, s.id) ? { ...out, nome: s.nome } : out;
  });
}

async function extrasCatalogos(r: Objeto<Catalogos>): Promise<Objeto<Catalogos>> {
  let snap: Catalogos | undefined;
  try {
    snap = (await S.catalogos()).data;
  } catch {
    snap = undefined;
  }
  const d = r.data;
  const data: Catalogos = {
    ...d,
    torneios: juntarCatalogo(d.torneios, snap?.torneios),
    mapas: juntarCatalogo(d.mapas, snap?.mapas),
    agentes: juntarCatalogo(d.agentes, snap?.agentes),
    armas: juntarCatalogo(d.armas, snap?.armas),
  };
  // Mapas em ordem alfabética do nome, venha de onde vier (a API ordena por nome e o snapshot por ID).
  data.mapas = [...data.mapas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.id.localeCompare(b.id));
  return { ...r, data };
}

/** Mais partidas primeiro; empate por vitórias e depois pelo ID, para a ordem não depender da API. */
function porPartidas<T extends { partidas: number; vitorias: number }>(xs: T[], id: (x: T) => string): T[] {
  return [...xs].sort((a, b) => b.partidas - a.partidas || b.vitorias - a.vitorias || id(a).localeCompare(id(b)));
}

function ordenarJogador(r: Objeto<JogadorDetalhe>): Objeto<JogadorDetalhe> {
  const d = r.data;
  return { ...r, data: { ...d, agentes: porPartidas(d.agentes, (a) => a.agente_id), mapas: porPartidas(d.mapas, (m) => m.mapa_id) } };
}

function ordenarTime(r: Objeto<TimeDetalhe>): Objeto<TimeDetalhe> {
  return { ...r, data: { ...r.data, mapas: porPartidas(r.data.mapas, (m) => m.mapa_id) } };
}

/** Placar da partida: maior ACS primeiro (sem ACS, mais abates), como no snapshot. */
function ordenarPartida(r: Objeto<PartidaDetalhe>): Objeto<PartidaDetalhe> {
  const jogadores = [...r.data.jogadores].sort((a, b) => (b.acs ?? -1) - (a.acs ?? -1) || b.kills - a.kills || a.jogador_id.localeCompare(b.jogador_id));
  const rounds = [...r.data.rounds].sort((a, b) => a.round - b.round);
  return { ...r, data: { ...r.data, jogadores, rounds } };
}

export const dados = {
  catalogos: () =>
    comFallback('/catalogos', undefined, () => local(S.catalogos)).then((r) => (r.meta.fonte === 'api' ? extrasCatalogos(r) : r)),

  ranking: (f: FiltroRanking & Pag & { ordem?: OrdemRanking } = {}) =>
    // Ordens extras (ACS, KAST...) ainda não existem na API: vão direto ao snapshot.
    f.ordem && !ORDENS_API.includes(f.ordem) && MODO !== 'api'
      ? local(() => S.ranking(f)).then((r) => ({ ...r, meta: { ...r.meta, fonte: 'snapshot' as const } }))
      : comFallback('/ranking', f, () => local(() => S.ranking(f))).then((r) => comExtras(r, (x) => extrasRanking(x, f))),

  /** Todas as páginas do ranking (para tabelas com filtro e ordenação no próprio front). */
  async rankingCompleto(f: FiltroRanking = {}): Promise<Lista<RankingItem>> {
    const primeira = await comFallback('/ranking', { ...f, page: 1, page_size: 100 }, () => local(() => rankingLocal(f)));
    if (primeira.meta.fonte === 'snapshot') {
      return { ...(await local(() => rankingLocal(f))), meta: primeira.meta };
    }
    // A API limita page_size a 100: as páginas seguintes vão em paralelo.
    const paginas = Math.ceil(primeira.pagination.total / 100);
    let resto: Lista<RankingItem>[];
    try {
      resto = await Promise.all(
        Array.from({ length: Math.max(0, paginas - 1) }, (_, i) => comFallback('/ranking', { ...f, page: i + 2, page_size: 100 }, () => local(() => rankingLocal(f)))),
      );
    } catch (e) {
      // Uma página falhou: lista pela metade engana mais que o snapshot inteiro.
      if (MODO !== 'auto') throw e;
      const snap = await local(() => rankingLocal(f));
      return { ...snap, meta: { ...snap.meta, fonte: 'snapshot' as const } };
    }
    if (resto.some((r) => r.meta.fonte !== 'api')) {
      const snap = await local(() => rankingLocal(f));
      return { ...snap, meta: { ...snap.meta, fonte: 'snapshot' as const } };
    }
    const itens = [...primeira.data, ...resto.flatMap((r) => r.data)];
    const lista = { data: itens, pagination: { page: 1, page_size: itens.length, total: itens.length }, meta: primeira.meta };
    return comExtras(lista, (x) => extrasRanking(x, f));
  },

  jogador: (id: string, f: Filtros & { agente_id?: string } = {}) =>
    comFallback(`/jogadores/${enc(id)}`, f, () => local(() => S.jogador(id, f)))
      .then((r) => comExtras(r, (x) => extrasJogador(x, id, f)))
      .then(ordenarJogador),
  times: (f: Filtros & Pag = {}) => comFallback('/times', f, () => local(() => S.times(f))),
  time: (id: string, f: Filtros = {}) => comFallback(`/times/${enc(id)}`, f, () => local(() => S.time(id, f))).then(ordenarTime),
  economiaTime: (id: string, f: Filtros = {}) => comFallback(`/times/${enc(id)}/economia`, f, () => local(() => S.economiaTime(id, f))),
  posPlant: (id: string, f: Filtros = {}) => comFallback(`/times/${enc(id)}/pos-plant-retake`, f, () => local(() => S.posPlant(id, f))),
  composicoes: (f: Filtros & Pag & { time_id?: string } = {}) => comFallback('/composicoes', f, () => local(() => S.composicoes(f))),
  comparar: (a: string, b: string, f: Filtros = {}) =>
    comFallback('/comparacoes/times', { ...f, time_a_id: a, time_b_id: b }, () => local(() => S.comparar(a, b, f))),
  partidas: (f: Filtros & Pag & { time_id?: string; jogador_id?: string } = {}) =>
    comFallback('/partidas', f, () => local(() => S.partidas(f))).then((r) => comExtras(r, extrasPartidas)),
  partida: (id: string) =>
    comFallback(`/partidas/${enc(id)}`, undefined, () => local(() => S.partida(id)))
      .then((r) => comExtras(r, (x) => extrasPartida(x, id)))
      .then(ordenarPartida),
  busca: (q: string, tipo?: 'time' | 'jogador' | 'mapa') => comFallback('/busca', { q, tipo }, () => local(() => S.busca(q, tipo))),

  // ---- só snapshot por enquanto ----
  series: (f: Filtros & { time_id?: string } = {}) => S.series(f),
  serieDaPartida: (id: string) => S.serieDaPartida(id),
  panorama: () => S.panorama(),
  metaCena: (f: Filtros = {}) => S.metaCena(f),
  manifesto: () => S.manifesto(),
};
