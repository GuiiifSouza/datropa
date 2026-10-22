/**
 * Motor local: lê public/snapshot (gerado por scripts/gerar_snapshot.py) e calcula as mesmas respostas
 * do contrato de /api/stats. As regras seguem a gold: filtro antes de agregar, razões recalculadas pelos
 * totais, null quando não há denominador, economia equipamento_time_10000_20000_pistol_v2.
 */
import type {
  AgenteMeta, Catalogos, Comparacao, CompraTipo, Composicao, Economia, Filtros, JogadorDetalhe, JogadorPartida, Lista,
  MapaMeta, MetaCena, Objeto, OrdemRanking, Panorama, PartidaDetalhe, PartidaItem, PosPlant, RankingItem, ResultadoRound,
  RoundDetalhe, Serie, TimeDetalhe, TimeItem,
} from './tipos';
import { diaBrasilia, razao, taxa } from '../util/formato';

const BASE = `${import.meta.env.BASE_URL}snapshot/`;

type PartidaRaw = {
  id: string; torneio_id: string; mapa_id: string; inicio: string | null; data: string; duracao_ms: number | null; versao: string | null;
  time_a_id: string; time_b_id: string; placar_a: number; placar_b: number; vencedor_id: string | null; rounds: number;
};
type Manifesto = { versao: string; gerado_em: string; partidas: number };
type Base = {
  manifesto: Manifesto;
  cat: Catalogos;
  partidas: PartidaRaw[];
  partidaPorId: Map<string, PartidaRaw>;
  times: Map<string, { id: string; nome: string }>;
  jogadores: { id: string; nome: string; tag: string | null }[];
  jogadorPorId: Map<string, { id: string; nome: string; tag: string | null }>;
};
type JP = {
  p: PartidaRaw; jogador_id: string; time_id: string; agente_id: string; venceu: boolean; rounds: number; score: number;
  kills: number; deaths: number; assists: number; dano: number; hs: number; bs: number; ls: number; fb: number; fd: number;
  kast: number; k3: number; k4: number; k5: number;
};
type RR = {
  p: PartidaRaw; round: number; vencedor_id: string | null; atacante_id: string | null; defensor_id: string | null;
  lado_vencedor: 'ataque' | 'defesa' | null; resultado: ResultadoRound | null; plant_site: string | null;
  eq: Record<string, number>; compra: Record<string, CompraTipo>; fb_time_id: string | null; placar: Record<string, number>;
};
type Fatos = { jp: JP[]; rr: RR[]; jpPorPartida: Map<string, JP[]>; rrPorPartida: Map<string, RR[]> };

async function json<T>(nome: string): Promise<T> {
  const r = await fetch(BASE + nome);
  if (!r.ok) throw new Error(`Snapshot ${nome} indisponível (${r.status}).`);
  return r.json() as Promise<T>;
}

let basePromise: Promise<Base> | null = null;
export function base(): Promise<Base> {
  basePromise ??= (async () => {
    const [manifesto, cat, partidas, times, jogadores] = await Promise.all([
      json<Manifesto>('manifesto.json'), json<Catalogos>('catalogos.json'), json<PartidaRaw[]>('partidas.json'),
      json<{ id: string; nome: string }[]>('times.json'), json<{ id: string; nome: string; tag: string | null }[]>('jogadores.json'),
    ]);
    return {
      manifesto, cat, partidas,
      partidaPorId: new Map(partidas.map((p) => [p.id, p])),
      times: new Map(times.map((t) => [t.id, t])),
      jogadores,
      jogadorPorId: new Map(jogadores.map((j) => [j.id, j])),
    };
  })();
  basePromise.catch(() => { basePromise = null; });
  return basePromise;
}

type Colunar = { colunas: string[]; linhas: unknown[][] };
function decodificar(c: Colunar): Record<string, unknown>[] {
  return c.linhas.map((l) => Object.fromEntries(c.colunas.map((k, i) => [k, l[i]])));
}

let fatosPromise: Promise<Fatos> | null = null;
export function fatos(): Promise<Fatos> {
  fatosPromise ??= (async () => {
    const [b, jpC, rrC] = await Promise.all([base(), json<Colunar>('jogador_partida.json'), json<Colunar>('rounds.json')]);
    const lado = (p: PartidaRaw, x: unknown) => (x === 'a' ? p.time_a_id : x === 'b' ? p.time_b_id : null);
    const jp: JP[] = decodificar(jpC).map((l) => {
      const p = b.partidas[l.partida_id as number];
      return {
        p, jogador_id: b.jogadores[l.jogador_id as number].id, time_id: lado(p, l.time_id)!, agente_id: l.agente_id as string,
        venceu: l.venceu === 1, rounds: l.rounds as number, score: l.score as number, kills: l.kills as number, deaths: l.deaths as number,
        assists: l.assists as number, dano: l.dano as number, hs: l.hs as number, bs: l.bs as number, ls: l.ls as number,
        fb: l.fb as number, fd: l.fd as number, kast: l.kast as number, k3: l.k3 as number, k4: l.k4 as number, k5: l.k5 as number,
      };
    });
    const rr: RR[] = decodificar(rrC).map((l) => {
      const p = b.partidas[l.partida_id as number];
      const atk = lado(p, l.atacante_id);
      return {
        p, round: l.round as number, vencedor_id: lado(p, l.vencedor_id), atacante_id: atk,
        defensor_id: atk ? (atk === p.time_a_id ? p.time_b_id : p.time_a_id) : null,
        lado_vencedor: l.lado_vencedor as RR['lado_vencedor'], resultado: l.resultado as ResultadoRound | null,
        plant_site: (l.plant_site as string | null) ?? null,
        eq: { [p.time_a_id]: l.eq_a as number, [p.time_b_id]: l.eq_b as number },
        compra: { [p.time_a_id]: l.compra_a as CompraTipo, [p.time_b_id]: l.compra_b as CompraTipo },
        fb_time_id: lado(p, l.fb_time_id),
        placar: { [p.time_a_id]: l.placar_a as number, [p.time_b_id]: l.placar_b as number },
      };
    });
    const agrupar = <T extends { p: PartidaRaw }>(xs: T[]) => {
      const m = new Map<string, T[]>();
      for (const x of xs) (m.get(x.p.id) ?? m.set(x.p.id, []).get(x.p.id)!).push(x);
      return m;
    };
    return { jp, rr, jpPorPartida: agrupar(jp), rrPorPartida: agrupar(rr) };
  })();
  fatosPromise.catch(() => { fatosPromise = null; });
  return fatosPromise;
}

// ---------------- utilidades ----------------
const meta = (b: Base) => ({ atualizado_em: b.manifesto.gerado_em });
const diaUtc = (p: PartidaRaw) => (p.inicio ? p.inicio.slice(0, 10) : null);
function passa(p: PartidaRaw, f: Filtros = {}) {
  if (f.torneio_id && p.torneio_id !== f.torneio_id) return false;
  if (f.mapa_id && p.mapa_id !== f.mapa_id) return false;
  if (f.data_inicio || f.data_fim) {
    const d = diaUtc(p);
    if (!d) return false;
    if (f.data_inicio && d < f.data_inicio) return false;
    if (f.data_fim && d > f.data_fim) return false;
  }
  return true;
}
function paginar<T>(xs: T[], page = 1, page_size = 20) {
  const ps = Math.min(Math.max(1, page_size), 1000);
  return { data: xs.slice((page - 1) * ps, page * ps), pagination: { page, page_size: ps, total: xs.length } };
}
const r1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);
const r2 = (x: number | null) => (x === null ? null : Math.round(x * 100) / 100);
export class NaoEncontrado extends Error {}
const nomeTime = (b: Base, id: string | null) => (id ? b.times.get(id)?.nome ?? id : '');
const outro = (p: PartidaRaw, t: string) => (t === p.time_a_id ? p.time_b_id : p.time_a_id);
const ordemInicioDesc = (a: PartidaRaw, b: PartidaRaw) => (b.inicio ?? '').localeCompare(a.inicio ?? '') || a.id.localeCompare(b.id);

function somar(rows: JP[]) {
  const s = { partidas: 0, vitorias: 0, rounds: 0, score: 0, kills: 0, deaths: 0, assists: 0, dano: 0, hs: 0, bs: 0, ls: 0, fb: 0, fd: 0, kast: 0, k3: 0, k4: 0, k5: 0 };
  for (const r of rows) {
    s.partidas++; s.vitorias += r.venceu ? 1 : 0; s.rounds += r.rounds; s.score += r.score; s.kills += r.kills; s.deaths += r.deaths;
    s.assists += r.assists; s.dano += r.dano; s.hs += r.hs; s.bs += r.bs; s.ls += r.ls; s.fb += r.fb; s.fd += r.fd; s.kast += r.kast;
    s.k3 += r.k3; s.k4 += r.k4; s.k5 += r.k5;
  }
  return s;
}
function resumo(rows: JP[]) {
  const s = somar(rows);
  const tiros = s.hs + s.bs + s.ls;
  return {
    partidas: s.partidas, rounds: s.rounds, kills: s.kills, deaths: s.deaths, assists: s.assists,
    kd: r2(razao(s.kills, s.deaths)), adr: r1(razao(s.dano, s.rounds)), hs_pct: r1(tiros ? (100 * s.hs) / tiros : null),
    first_bloods: s.fb, acs: r1(razao(s.score, s.rounds)), kast_pct: r1(s.rounds ? (100 * s.kast) / s.rounds : null),
    first_deaths: s.fd, vitorias: s.vitorias, taxa_vitoria_pct: r1(taxa(s.vitorias, s.partidas)),
    multikills: { k3: s.k3, k4: s.k4, k5: s.k5 },
  };
}
function contar<T>(xs: T[], chave: (x: T) => string) {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = chave(x);
    (m.get(k) ?? m.set(k, []).get(k)!).push(x);
  }
  return m;
}

// ---------------- rotas do contrato ----------------
export async function catalogos(): Promise<Objeto<Catalogos>> {
  const b = await base();
  return { data: b.cat, meta: meta(b) };
}

const ORDENS: Record<OrdemRanking, (r: RankingItem) => number | null> = {
  kills_desc: (r) => r.kills, kd_desc: (r) => r.kd, adr_desc: (r) => r.adr, acs_desc: (r) => r.acs ?? null,
  kast_desc: (r) => r.kast_pct ?? null, fb_desc: (r) => r.first_bloods, hs_desc: (r) => r.hs_pct,
};

export async function ranking(f: Filtros & { agente_id?: string; time_id?: string; ordem?: OrdemRanking; page?: number; page_size?: number } = {}): Promise<Lista<RankingItem>> {
  const [b, { jp }] = await Promise.all([base(), fatos()]);
  const rows = jp.filter((r) => passa(r.p, f) && (!f.agente_id || r.agente_id === f.agente_id) && (!f.time_id || r.time_id === f.time_id));
  const itens: RankingItem[] = [];
  for (const [id, rs] of contar(rows, (r) => r.jogador_id)) {
    const times = new Set(rs.map((r) => r.time_id));
    const ag = [...contar(rs, (r) => r.agente_id)].sort((a, c) => c[1].length - a[1].length).slice(0, 3).map(([a]) => a);
    itens.push({ jogador_id: id, nome: b.jogadorPorId.get(id)?.nome ?? 'Jogador', time_id: times.size === 1 ? [...times][0] : null, ...resumo(rs), agentes_top: ag });
  }
  const chave = ORDENS[f.ordem ?? 'kills_desc'];
  itens.sort((a, c) => {
    const va = chave(a), vc = chave(c);
    if (va === null && vc === null) return a.jogador_id.localeCompare(c.jogador_id);
    if (va === null) return 1;
    if (vc === null) return -1;
    return vc - va || a.jogador_id.localeCompare(c.jogador_id);
  });
  return { ...paginar(itens, f.page, f.page_size), meta: meta(b) };
}

export async function jogador(id: string, f: Filtros & { agente_id?: string } = {}): Promise<Objeto<JogadorDetalhe>> {
  const [b, { jp }] = await Promise.all([base(), fatos()]);
  const info = b.jogadorPorId.get(id);
  if (!info) throw new NaoEncontrado('Jogador não encontrado.');
  const rows = jp.filter((r) => r.jogador_id === id && passa(r.p, f) && (!f.agente_id || r.agente_id === f.agente_id));
  const porAg = [...contar(rows, (r) => r.agente_id)].map(([agente_id, rs]) => {
    const s = resumo(rs);
    return { agente_id, partidas: rs.length, vitorias: s.vitorias, taxa_vitoria_pct: s.taxa_vitoria_pct, kd: s.kd, acs: s.acs };
  }).sort((a, c) => c.partidas - a.partidas || a.agente_id.localeCompare(c.agente_id));
  const porMapa = [...contar(rows, (r) => r.p.mapa_id)].map(([mapa_id, rs]) => {
    const s = resumo(rs);
    return { mapa_id, partidas: rs.length, vitorias: s.vitorias, taxa_vitoria_pct: s.taxa_vitoria_pct, acs: s.acs };
  }).sort((a, c) => c.partidas - a.partidas || a.mapa_id.localeCompare(c.mapa_id));
  const { multikills, ...res } = resumo(rows);
  return {
    data: {
      id, nome: info.nome, tag: info.tag,
      times: [...new Set(rows.map((r) => r.time_id))].map((t) => ({ id: t, nome: nomeTime(b, t) })),
      resumo: { ...res, multikills }, agentes: porAg, mapas: porMapa,
      partidas_recentes: [...rows].sort((a, c) => ordemInicioDesc(a.p, c.p)).map((r) => ({
        partida_id: r.p.id, mapa_id: r.p.mapa_id, inicio: r.p.inicio, time_id: r.time_id, adversario_id: outro(r.p, r.time_id),
        agente_id: r.agente_id, kills: r.kills, deaths: r.deaths, assists: r.assists, acs: r1(razao(r.score, r.rounds)), venceu: r.venceu,
        placar: (r.time_id === r.p.time_a_id ? [r.p.placar_a, r.p.placar_b] : [r.p.placar_b, r.p.placar_a]) as [number, number],
      })),
    },
    meta: meta(b),
  };
}

function linhasTime(b: Base, f: Filtros) {
  const m = new Map<string, { p: PartidaRaw; t: string }[]>();
  for (const p of b.partidas) {
    if (!passa(p, f)) continue;
    for (const t of [p.time_a_id, p.time_b_id]) (m.get(t) ?? m.set(t, []).get(t)!).push({ p, t });
  }
  return m;
}
function itemTime(b: Base, id: string, ps: { p: PartidaRaw; t: string }[]): TimeItem {
  const v = ps.filter((x) => x.p.vencedor_id === x.t).length;
  const e = ps.filter((x) => x.p.vencedor_id === null).length;
  return { id, nome: nomeTime(b, id), partidas: ps.length, vitorias: v, derrotas: ps.length - v - e, empates: e, taxa_vitoria_pct: r1(taxa(v, ps.length)) };
}

export async function times(f: Filtros & { page?: number; page_size?: number } = {}): Promise<Lista<TimeItem>> {
  const b = await base();
  const itens = [...linhasTime(b, f)].map(([id, ps]) => itemTime(b, id, ps)).sort((a, c) => a.nome.localeCompare(c.nome) || a.id.localeCompare(c.id));
  return { ...paginar(itens, f.page, f.page_size ?? 20), meta: meta(b) };
}

export async function time(id: string, f: Filtros = {}): Promise<Objeto<TimeDetalhe>> {
  const [b, { rr }] = await Promise.all([base(), fatos()]);
  if (!b.times.has(id)) throw new NaoEncontrado('Time não encontrado.');
  const ps = linhasTime(b, f).get(id) ?? [];
  const it = itemTime(b, id, ps);
  const rs = rr.filter((r) => (r.p.time_a_id === id || r.p.time_b_id === id) && passa(r.p, f));
  const lado = (l: 'ataque' | 'defesa') => {
    const xs = rs.filter((r) => (l === 'ataque' ? r.atacante_id === id : r.defensor_id === id));
    const g = xs.filter((r) => r.vencedor_id === id).length;
    return { lado: l, rounds_jogados: xs.length, rounds_ganhos: g, taxa_vitoria_pct: r1(taxa(g, xs.length)) };
  };
  const mapas = [...contar(ps, (x) => x.p.mapa_id)].map(([mapa_id, xs]) => {
    const v = xs.filter((x) => x.p.vencedor_id === id).length;
    return { mapa_id, partidas: xs.length, vitorias: v, taxa_vitoria_pct: r1(taxa(v, xs.length)) };
  }).sort((a, c) => c.partidas - a.partidas || a.mapa_id.localeCompare(c.mapa_id));
  return {
    data: {
      id, nome: it.nome,
      resumo: { partidas: it.partidas, vitorias: it.vitorias, derrotas: it.derrotas, empates: it.empates, taxa_vitoria_pct: it.taxa_vitoria_pct,
        rounds_jogados: rs.length, rounds_ganhos: rs.filter((r) => r.vencedor_id === id).length },
      lados: [lado('ataque'), lado('defesa')], mapas,
    },
    meta: meta(b),
  };
}

const TIPOS: CompraTipo[] = ['pistol', 'eco', 'force', 'full'];
function economiaDe(rs: RR[], quem: (r: RR) => string[]) {
  const c = Object.fromEntries(TIPOS.map((t) => [t, { rounds: 0, vitorias: 0 }])) as Record<CompraTipo, { rounds: number; vitorias: number }>;
  for (const r of rs) for (const t of quem(r)) {
    const k = r.compra[t];
    if (!k) continue;
    c[k].rounds++;
    if (r.vencedor_id === t) c[k].vitorias++;
  }
  return TIPOS.map((tipo) => ({ tipo, ...c[tipo], taxa_vitoria_pct: r1(taxa(c[tipo].vitorias, c[tipo].rounds)) }));
}

export async function economiaTime(id: string, f: Filtros = {}): Promise<Objeto<Economia>> {
  const [b, { rr }] = await Promise.all([base(), fatos()]);
  if (!b.times.has(id)) throw new NaoEncontrado('Time não encontrado.');
  const rs = rr.filter((r) => (r.p.time_a_id === id || r.p.time_b_id === id) && passa(r.p, f));
  return { data: { time_id: id, categorias: economiaDe(rs, () => [id]), classificacao_versao: 'equipamento_time_10000_20000_pistol_v2', rounds_sem_classificacao: 0 }, meta: meta(b) };
}

export async function posPlant(id: string, f: Filtros = {}): Promise<Objeto<PosPlant>> {
  const [b, { rr }] = await Promise.all([base(), fatos()]);
  if (!b.times.has(id)) throw new NaoEncontrado('Time não encontrado.');
  const rs = rr.filter((r) => r.plant_site && passa(r.p, f));
  const pp = rs.filter((r) => r.atacante_id === id), rt = rs.filter((r) => r.defensor_id === id);
  const bloco = (xs: RR[]) => {
    const v = xs.filter((r) => r.vencedor_id === id).length;
    return { oportunidades: xs.length, vitorias: v, taxa_sucesso_pct: r1(taxa(v, xs.length)) };
  };
  return { data: { time_id: id, pos_plant: bloco(pp), retake: bloco(rt) }, meta: meta(b) };
}

export async function composicoes(f: Filtros & { time_id?: string; page?: number; page_size?: number; min_aparicoes?: number } = {}): Promise<Lista<Composicao>> {
  const [b, { jpPorPartida }] = await Promise.all([base(), fatos()]);
  const acc = new Map<string, Composicao>();
  for (const p of b.partidas) {
    if (!passa(p, f)) continue;
    const rows = jpPorPartida.get(p.id) ?? [];
    for (const t of [p.time_a_id, p.time_b_id]) {
      if (f.time_id && t !== f.time_id) continue;
      const ags = rows.filter((r) => r.time_id === t).map((r) => r.agente_id).sort();
      if (ags.length !== 5) continue;
      const k = `${p.mapa_id}|${ags.join('|')}`;
      const c = acc.get(k) ?? { composicao_id: k, mapa_id: p.mapa_id, agente_ids: ags, aparicoes: 0, vitorias: 0, taxa_vitoria_pct: null };
      c.aparicoes++;
      if (p.vencedor_id === t) c.vitorias++;
      acc.set(k, c);
    }
  }
  const itens = [...acc.values()].filter((c) => c.aparicoes >= (f.min_aparicoes ?? 1))
    .map((c) => ({ ...c, taxa_vitoria_pct: r1(taxa(c.vitorias, c.aparicoes)) }))
    .sort((a, c) => c.aparicoes - a.aparicoes || a.composicao_id.localeCompare(c.composicao_id));
  return { ...paginar(itens, f.page, f.page_size), meta: meta(b) };
}

export async function comparar(a: string, c: string, f: Filtros = {}): Promise<Objeto<Comparacao>> {
  const b = await base();
  const l = linhasTime(b, f);
  const it = (id: string) => {
    const x = itemTime(b, id, l.get(id) ?? []);
    return { id, partidas: x.partidas, vitorias: x.vitorias, taxa_vitoria_pct: x.taxa_vitoria_pct };
  };
  const diretos = b.partidas.filter((p) => passa(p, f) && new Set([p.time_a_id, p.time_b_id]).has(a) && new Set([p.time_a_id, p.time_b_id]).has(c));
  return {
    data: {
      time_a: it(a), time_b: it(c),
      confrontos_diretos: { partidas: diretos.length, vitorias_a: diretos.filter((p) => p.vencedor_id === a).length,
        vitorias_b: diretos.filter((p) => p.vencedor_id === c).length, empates: diretos.filter((p) => !p.vencedor_id).length },
    },
    meta: meta(b),
  };
}

function itemPartida(b: Base, p: PartidaRaw): PartidaItem {
  return {
    id: p.id, torneio_id: p.torneio_id, mapa_id: p.mapa_id, inicio: p.inicio,
    times: [{ id: p.time_a_id, nome: nomeTime(b, p.time_a_id), rounds_ganhos: p.placar_a }, { id: p.time_b_id, nome: nomeTime(b, p.time_b_id), rounds_ganhos: p.placar_b }],
    vencedor_id: p.vencedor_id, rounds: p.rounds, duracao_ms: p.duracao_ms,
  };
}

export async function partidas(f: Filtros & { time_id?: string; jogador_id?: string; page?: number; page_size?: number } = {}): Promise<Lista<PartidaItem>> {
  const b = await base();
  let ps = b.partidas.filter((p) => passa(p, f) && (!f.time_id || p.time_a_id === f.time_id || p.time_b_id === f.time_id));
  if (f.jogador_id) {
    const { jp } = await fatos();
    const ids = new Set(jp.filter((r) => r.jogador_id === f.jogador_id).map((r) => r.p.id));
    ps = ps.filter((p) => ids.has(p.id));
  }
  ps = [...ps].sort(ordemInicioDesc);
  return { ...paginar(ps.map((p) => itemPartida(b, p)), f.page, f.page_size), meta: meta(b) };
}

export async function partida(id: string): Promise<Objeto<PartidaDetalhe>> {
  const [b, ft] = await Promise.all([base(), fatos()]);
  const p = b.partidaPorId.get(id);
  if (!p) throw new NaoEncontrado('Partida não encontrada.');
  const rows = ft.jpPorPartida.get(id) ?? [];
  const jogadores: JogadorPartida[] = rows.map((r) => {
    const s = resumo([r]);
    return {
      jogador_id: r.jogador_id, nome: b.jogadorPorId.get(r.jogador_id)?.nome ?? 'Jogador', time_id: r.time_id, agente_id: r.agente_id,
      kills: r.kills, deaths: r.deaths, assists: r.assists, adr: s.adr, hs_pct: s.hs_pct, first_bloods: r.fb,
      acs: s.acs, kast_pct: s.kast_pct, first_deaths: r.fd, multikills: s.multikills,
    };
  }).sort((a, c) => (c.acs ?? 0) - (a.acs ?? 0));
  const rounds: RoundDetalhe[] = (ft.rrPorPartida.get(id) ?? []).sort((a, c) => a.round - c.round).map((r) => ({
    round: r.round, vencedor_id: r.vencedor_id, lado_vencedor: r.lado_vencedor, resultado: r.resultado, atacante_id: r.atacante_id,
    plant_site: r.plant_site, compras: r.compra, equipamento: r.eq, placar: r.placar, first_blood_time_id: r.fb_time_id,
  }));
  const { rounds: _n, ...item } = itemPartida(b, p);
  return { data: { ...item, jogadores, rounds, mvp_jogador_id: null, rounds_decisivos: [], versao: p.versao }, meta: meta(b) };
}

export async function busca(q: string, tipo?: 'time' | 'jogador' | 'mapa'): Promise<Lista<{ tipo: 'time' | 'jogador' | 'mapa'; id: string; nome: string; extra?: string }>> {
  const b = await base();
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const alvo = norm(q.trim());
  const res: { tipo: 'time' | 'jogador' | 'mapa'; id: string; nome: string; extra?: string; peso: number }[] = [];
  const peso = (n: string) => (norm(n) === alvo ? 0 : norm(n).startsWith(alvo) ? 1 : 2);
  if (alvo.length >= 2) {
    if (!tipo || tipo === 'time') for (const t of b.times.values()) if (norm(t.nome).includes(alvo)) res.push({ tipo: 'time', id: t.id, nome: t.nome, peso: peso(t.nome) });
    if (!tipo || tipo === 'jogador') for (const j of b.jogadores) if (norm(j.nome).includes(alvo)) res.push({ tipo: 'jogador', id: j.id, nome: j.nome, extra: j.tag ? `#${j.tag}` : undefined, peso: peso(j.nome) });
    if (!tipo || tipo === 'mapa') for (const m of b.cat.mapas) if (norm(m.nome).includes(alvo)) res.push({ tipo: 'mapa', id: m.id, nome: m.nome, peso: peso(m.nome) });
  }
  res.sort((a, c) => a.peso - c.peso || a.nome.localeCompare(c.nome));
  return { ...paginar(res.map(({ peso: _p, ...r }) => r), 1, 30), meta: meta(b) };
}

// ---------------- extras do front ----------------
export async function series(f: Filtros & { time_id?: string } = {}): Promise<Serie[]> {
  const b = await base();
  const grupos = new Map<string, PartidaRaw[]>();
  for (const p of b.partidas) {
    if (!passa(p, f) || (f.time_id && p.time_a_id !== f.time_id && p.time_b_id !== f.time_id)) continue;
    const par = [p.time_a_id, p.time_b_id].sort().join('|');
    const k = `${p.torneio_id}|${diaBrasilia(p.inicio) ?? p.data}|${par}`;
    (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(p);
  }
  const out: Serie[] = [];
  for (const ps of grupos.values()) {
    ps.sort((a, c) => (a.inicio ?? '').localeCompare(c.inicio ?? ''));
    const a = ps[0].time_a_id, c = ps[0].time_b_id;
    out.push({
      id: ps[0].id, torneio_id: ps[0].torneio_id, dia: diaBrasilia(ps[0].inicio) ?? ps[0].data,
      time_a: { id: a, nome: nomeTime(b, a) }, time_b: { id: c, nome: nomeTime(b, c) },
      vitorias_a: ps.filter((p) => p.vencedor_id === a).length, vitorias_b: ps.filter((p) => p.vencedor_id === c).length,
      mapas: ps.map((p) => ({
        partida_id: p.id, mapa_id: p.mapa_id, inicio: p.inicio, prorrogacao: p.rounds > 24,
        placar_a: p.time_a_id === a ? p.placar_a : p.placar_b, placar_b: p.time_a_id === a ? p.placar_b : p.placar_a,
      })),
    });
  }
  return out.sort((x, y) => (y.mapas[0].inicio ?? '').localeCompare(x.mapas[0].inicio ?? ''));
}

export async function serieDaPartida(id: string): Promise<Serie | null> {
  const b = await base();
  const p = b.partidaPorId.get(id);
  if (!p) return null;
  const todas = await series({ time_id: p.time_a_id, torneio_id: p.torneio_id });
  return todas.find((s) => s.mapas.some((m) => m.partida_id === id)) ?? null;
}

export async function panorama(): Promise<Panorama> {
  const [b, { jp, rr }] = await Promise.all([base(), fatos()]);
  const comFb = rr.filter((r) => r.fb_time_id);
  const econ = economiaDe(rr, (r) => [r.p.time_a_id, r.p.time_b_id]);
  const res = contar(rr.filter((r) => r.resultado), (r) => r.resultado!);
  const inicios = b.partidas.map((p) => diaBrasilia(p.inicio)).filter(Boolean).sort() as string[];
  return {
    partidas: b.partidas.length, times: b.times.size, jogadores: b.jogadores.length, rounds: rr.length,
    kills: jp.reduce((s, r) => s + r.kills, 0), torneios: b.cat.torneios.length,
    prorrogacoes: b.partidas.filter((p) => p.rounds > 24).length,
    duracao_media_min: r1(b.partidas.reduce((s, p) => s + (p.duracao_ms ?? 0), 0) / b.partidas.length / 60000),
    ataque_pct: r1(taxa(rr.filter((r) => r.lado_vencedor === 'ataque').length, rr.length)),
    fb_conversao_pct: r1(taxa(comFb.filter((r) => r.fb_time_id === r.vencedor_id).length, comFb.length)),
    plant_pct: r1(taxa(rr.filter((r) => r.plant_site).length, rr.length)),
    periodo: [inicios[0] ?? null, inicios[inicios.length - 1] ?? null],
    economia: econ,
    resultados: [...res].map(([resultado, xs]) => ({ resultado: resultado as ResultadoRound, rounds: xs.length })).sort((a, c) => c.rounds - a.rounds),
    por_torneio: [...contar(b.partidas, (p) => p.torneio_id)].map(([torneio_id, ps]) => {
      const dias = ps.map((p) => diaBrasilia(p.inicio)).filter(Boolean).sort() as string[];
      return { torneio_id, partidas: ps.length, dia_inicio: dias[0] ?? null, dia_fim: dias[dias.length - 1] ?? null };
    }).sort((a, c) => (c.dia_fim ?? '').localeCompare(a.dia_fim ?? '')),
  };
}

export async function metaCena(f: Filtros = {}): Promise<MetaCena> {
  const [b, { jp, rr }] = await Promise.all([base(), fatos()]);
  const rows = jp.filter((r) => passa(r.p, f));
  const ps = b.partidas.filter((p) => passa(p, f));
  const agentes: AgenteMeta[] = [...contar(rows, (r) => r.agente_id)].map(([agente_id, rs]) => {
    const s = resumo(rs);
    return { agente_id, aparicoes: rs.length, vitorias: s.vitorias, taxa_vitoria_pct: s.taxa_vitoria_pct, pick_pct: r1(taxa(rs.length, ps.length * 2)), kd: s.kd, acs: s.acs };
  }).sort((a, c) => c.aparicoes - a.aparicoes);
  const rrF = rr.filter((r) => passa(r.p, f));
  const mapas: MapaMeta[] = [...contar(ps, (p) => p.mapa_id)].map(([mapa_id, xs]) => {
    const rs = rrF.filter((r) => r.p.mapa_id === mapa_id);
    const plants: Record<string, number> = {};
    for (const r of rs) if (r.plant_site) plants[r.plant_site] = (plants[r.plant_site] ?? 0) + 1;
    const ag = [...contar(rows.filter((r) => r.p.mapa_id === mapa_id), (r) => r.agente_id)].map(([agente_id, a]) => ({ agente_id, aparicoes: a.length }))
      .sort((a, c) => c.aparicoes - a.aparicoes).slice(0, 5);
    return { mapa_id, partidas: xs.length, prorrogacoes: xs.filter((p) => p.rounds > 24).length, rounds: rs.length,
      ataque_pct: r1(taxa(rs.filter((r) => r.lado_vencedor === 'ataque').length, rs.length)), plants, agentes_top: ag };
  }).sort((a, c) => c.partidas - a.partidas);
  const armas = await json<{ arma_id: string; nome: string; kills: number }[]>('armas_kills.json');
  const comps = await composicoes({ ...f, page_size: 12, min_aparicoes: 3 });
  return { agentes, mapas, armas, economia: economiaDe(rrF, (r) => [r.p.time_a_id, r.p.time_b_id]), composicoes: comps.data };
}

export async function manifesto() {
  return (await base()).manifesto;
}
