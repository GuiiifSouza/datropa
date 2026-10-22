/**
 * Round real da prancheta: busca partidas e eventos pela API (src/api/stats.ts) e entrega no formato
 * compacto que a lógica do protótipo usa (o mesmo dos arquivos que o canvas carregava).
 *
 * Partida: { id, a, b, pa, pb, torneio, data, jog: [[nick, agente, 'A'|'B']], rounds }
 * Round:   { n, venc, atk, res, cer, eA, eB, ev }  (ev = null até os eventos chegarem)
 * Evento:  [tipo k|p|d, tempo_ms, ator, vítima, x, y, [[jogador, x, y, mira]], site]
 *
 * As posições vêm em coordenada do jogo. A conversão para o desenho do mapa usa a transformação
 * oficial do minimapa (u, v) e a calibração do SVG da prancheta (conferida pelos plants nos sites).
 */
import { dados } from '../api/stats';
import type { EventoRound, PartidaDetalhe, PartidaItem } from '../api/tipos';

type Ev = [string, number, number, number, number, number, [number, number, number, null][], string?];
type Round = { n: number; venc: 'A' | 'B'; atk: 'A' | 'B'; res: string; cer: string; eA: number | null; eB: number | null; ev: Ev[] | null };
type Partida = { id: string; a: string; b: string; pa: number; pb: number; torneio: string; data: string; jog: [string, string, 'A' | 'B'][]; rounds: Round[] };
export type DadosMapa = { mapa: string; partidas: Partida[] };

// chave da prancheta -> id do mapa na base (codinome interno)
export const MAPA_ID: Record<string, string> = { lotus: 'jam', haven: 'triad', ascent: 'ascent', breeze: 'foxtrot', fracture: 'canyon' };
export const CHAVE_DO_MAPA: Record<string, string> = Object.fromEntries(Object.entries(MAPA_ID).map(([k, v]) => [v, k]));

// coef = [multiplicador de u, de v, deslocamento de u, de v] (transformação do minimapa)
// mat = de (u, v) para o SVG da prancheta
const CALIBRACAO: Record<string, { coef: number[]; mat: number[] }> = {
  lotus: { coef: [7.2e-05, -7.2e-05, 0.454789, 0.917752], mat: [1023.8919, 0.0, -55.9189, 0.0, 1023.8919, -124.5182] },
  haven: { coef: [7.5e-05, -7.5e-05, 1.09345, 0.642728], mat: [1014.2845, 0.0, -30.5286, 0.0, 1014.2845, -82.33] },
  ascent: { coef: [7e-05, -7e-05, 0.813895, 0.573242], mat: [0.0, -1014.1818, 1018.1706, 1014.1818, 0.0, 4.8999] },
  breeze: { coef: [7e-05, -7e-05, 0.465123, 0.833078], mat: [1019.4485, 0.0, -33.2472, 0.0, 1019.4485, -28.1038] },
  fracture: { coef: [7.8e-05, -7.8e-05, 0.556952, 1.155886], mat: [1027.4275, 0.0, -2.7208, 0.0, 1027.4275, -4.495] },
};

export function paraMapa(chave: string, x: number, y: number): [number, number] | null {
  const c = CALIBRACAO[chave];
  if (!c || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const [xm, ym, xa, ya] = c.coef, [A, B, C, D, E, F] = c.mat;
  const u = y * xm + xa, v = x * ym + ya;
  // fora do minimapa: o evento fica na timeline, mas não é desenhado (docs/api.md)
  if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) return null;
  return [Math.round(A * u + B * v + C), Math.round(D * u + E * v + F)];
}

const RESULTADO: Record<string, string> = { eliminacao: 'Eliminated', detonacao: 'Bomb detonated', desarme: 'Bomb defused', tempo: 'Round timer expired', outro: '' };
const slug = (nome: string) => nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dataCurta = (iso: string | null) => (iso ? iso.slice(8, 10) + '-' + iso.slice(5, 7) + '-' + iso.slice(2, 4) : '');

type Opcoes = {
  nomeAgente: (id: string | null | undefined) => string;
  nomeTime: (nome: string) => string;
  /** partida que veio no link: entra primeiro na lista do mapa */
  partidaInicial?: string | null;
  /** chamado a cada pedaço novo que chega (lista, detalhe ou eventos) */
  aoMudar?: () => void;
};

export function criarReais(op: Opcoes) {
  const porMapa: Record<string, DadosMapa> = {};
  const avisos: Record<string, (d: DadosMapa) => void> = {};
  const pedidos = new Set<string>();

  const publicar = (chave: string) => {
    const d = porMapa[chave];
    porMapa[chave] = { mapa: d.mapa, partidas: d.partidas.slice() };
    avisos[chave]?.(porMapa[chave]);
    op.aoMudar?.();
  };

  async function listar(chave: string, cb: (d: DadosMapa) => void) {
    avisos[chave] = cb;
    if (porMapa[chave]) { cb(porMapa[chave]); return; }
    const mapaId = MAPA_ID[chave];
    if (!mapaId) return;
    const itens: PartidaItem[] = [];
    try {
      for (let page = 1; page <= 10; page++) {
        const r = await dados.partidas({ mapa_id: mapaId, page, page_size: 100 });
        itens.push(...r.data);
        if (!r.pagination || page * r.pagination.page_size >= r.pagination.total) break;
      }
    } catch { /* sem lista: a prancheta mostra o round vazio */ }
    if (op.partidaInicial) {
      const i = itens.findIndex((p) => p.id === op.partidaInicial);
      if (i > 0) itens.unshift(...itens.splice(i, 1));
    }
    porMapa[chave] = {
      mapa: chave,
      partidas: itens.map((p) => ({
        id: p.id, a: op.nomeTime(p.times[0].nome), b: op.nomeTime(p.times[1].nome), pa: p.times[0].rounds_ganhos, pb: p.times[1].rounds_ganhos,
        torneio: p.torneio_id, data: dataCurta(p.inicio), jog: [], rounds: [],
      })),
    };
    publicar(chave);
  }

  const detalhes: Record<string, PartidaDetalhe> = {};

  async function carregarDetalhe(chave: string, idx: number) {
    const p = porMapa[chave]?.partidas[idx];
    if (!p || detalhes[p.id]) return;
    const d = (await dados.partida(p.id)).data;
    detalhes[p.id] = d;
    const ladoDe = (timeId: string | null | undefined): 'A' | 'B' => (timeId === d.times[1].id ? 'B' : 'A');
    const jog = d.jogadores.map((j) => [j.nome, slug(op.nomeAgente(j.agente_id)), ladoDe(j.time_id)] as [string, string, 'A' | 'B']);
    const rounds: Round[] = d.rounds.map((r) => {
      const venc = ladoDe(r.vencedor_id);
      const atk: 'A' | 'B' = r.atacante_id ? ladoDe(r.atacante_id) : (r.lado_vencedor === 'defesa' ? (venc === 'A' ? 'B' : 'A') : venc);
      const eq = r.equipamento ?? {};
      return { n: r.round, venc, atk, res: RESULTADO[r.resultado ?? 'outro'] ?? '', cer: '', eA: eq[d.times[0].id] ?? null, eB: eq[d.times[1].id] ?? null, ev: null };
    });
    porMapa[chave].partidas[idx] = { ...p, jog, rounds };
    publicar(chave);
  }

  function converterEventos(chave: string, d: PartidaDetalhe, eventos: EventoRound[]): Ev[] {
    const idx = (id: string | null | undefined) => d.jogadores.findIndex((j) => j.jogador_id === id);
    const tipo = { abate: 'k', plant: 'p', defuse: 'd' } as const;
    return eventos.filter((e) => tipo[e.tipo]).map((e) => {
      const pos = e.posicao ? paraMapa(chave, e.posicao.x, e.posicao.y) : null;
      const snaps = e.jogadores.flatMap((j) => {
        const q = j.posicao ? paraMapa(chave, j.posicao.x, j.posicao.y) : null;
        const i = idx(j.jogador_id);
        return q && i >= 0 ? [[i, q[0], q[1], null] as [number, number, number, null]] : [];
      });
      const vitima = e.tipo === 'abate' ? idx(e.vitima_id) : -1;
      // abate: a vítima fica onde morreu (evento.posicao), mesmo quando o snapshot não traz ela.
      // A lógica já desenha quem é a vítima como eliminada e a linha do tiro termina nesse ponto.
      // Sem posição válida não se inventa nada: a vítima fica como veio no snapshot (ou sem ícone).
      if (vitima >= 0 && pos) {
        const s = snaps.find((p) => p[0] === vitima);
        if (s) { s[1] = pos[0]; s[2] = pos[1]; } else snaps.push([vitima, pos[0], pos[1], null]);
      }
      return [tipo[e.tipo], e.tempo_ms ?? 0, idx(e.ator_id), vitima,
        pos ? pos[0] : NaN, pos ? pos[1] : NaN, snaps, e.site ?? undefined] as Ev;
    });
  }

  async function carregarRound(chave: string, idx: number, n: number) {
    const p = porMapa[chave]?.partidas[idx];
    const d = p && detalhes[p.id];
    const r = p?.rounds.find((x) => x.n === n);
    if (!p || !d || !r || r.ev) return;
    let ev: Ev[] = [];
    try { ev = converterEventos(chave, d, (await dados.eventosRound(p.id, n)).data.eventos); } catch { ev = []; }
    const atual = porMapa[chave].partidas[idx];
    porMapa[chave].partidas[idx] = { ...atual, rounds: atual.rounds.map((x) => (x.n === n ? { ...x, ev } : x)) };
    publicar(chave);
  }

  /** Garante detalhe e eventos do round aberto (e do próximo, para a troca ser imediata). */
  function detalhar(chave: string, idxBruto: number, round: number) {
    const lista = porMapa[chave]?.partidas;
    if (!lista || !lista.length) return;
    const idx = Math.min(Math.max(idxBruto, 0), lista.length - 1);
    const k = `${chave}|${idx}|${round}`;
    if (pedidos.has(k)) return;
    pedidos.add(k);
    (async () => {
      try {
        await carregarDetalhe(chave, idx);
        const total = porMapa[chave].partidas[idx].rounds.length;
        const n = Math.min(Math.max(round, 1), total || 1);
        await carregarRound(chave, idx, n);
        if (n + 1 <= total) await carregarRound(chave, idx, n + 1);
      } catch {
        pedidos.delete(k);
      }
    })();
  }

  return { listar, detalhar };
}
