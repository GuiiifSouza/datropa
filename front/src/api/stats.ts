/**
 * Fachada única de dados das telas. Cada função segue uma rota de docs/api.md:
 * tenta /api/stats e, no modo auto, cai no snapshot quando a rota ainda não está no ar.
 * As funções marcadas "só snapshot" ainda não têm rota no contrato (pedidos em front/docs/pedidos-api.md).
 */
import { comFallback, ErroApi, MODO } from './cliente';
import * as S from './snapshot';
import type { Filtros, Lista, OrdemRanking, RankingItem } from './tipos';

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

export const dados = {
  catalogos: () => comFallback('/catalogos', undefined, () => local(S.catalogos)),

  ranking: (f: Filtros & Pag & { agente_id?: string; time_id?: string; ordem?: OrdemRanking } = {}) =>
    // Ordens extras (ACS, KAST...) ainda não existem na API: vão direto ao snapshot.
    f.ordem && !ORDENS_API.includes(f.ordem) && MODO !== 'api'
      ? local(() => S.ranking(f)).then((r) => ({ ...r, meta: { ...r.meta, fonte: 'snapshot' as const } }))
      : comFallback('/ranking', f, () => local(() => S.ranking(f))),

  /** Todas as páginas do ranking (para tabelas com filtro e ordenação no próprio front). */
  async rankingCompleto(f: Filtros & { agente_id?: string; time_id?: string } = {}): Promise<Lista<RankingItem>> {
    const primeira = await dados.ranking({ ...f, page: 1, page_size: 100 });
    const itens = [...primeira.data];
    const paginas = Math.ceil(primeira.pagination.total / 100);
    for (let p = 2; p <= paginas && primeira.meta.fonte === 'api'; p++) itens.push(...(await dados.ranking({ ...f, page: p, page_size: 100 })).data);
    if (primeira.meta.fonte === 'snapshot' && itens.length < primeira.pagination.total) {
      return { ...(await local(() => S.ranking({ ...f, page: 1, page_size: 1000 }))), meta: primeira.meta };
    }
    return { data: itens, pagination: { page: 1, page_size: itens.length, total: itens.length }, meta: primeira.meta };
  },

  jogador: (id: string, f: Filtros & { agente_id?: string } = {}) => comFallback(`/jogadores/${enc(id)}`, f, () => local(() => S.jogador(id, f))),
  times: (f: Filtros & Pag = {}) => comFallback('/times', f, () => local(() => S.times(f))),
  time: (id: string, f: Filtros = {}) => comFallback(`/times/${enc(id)}`, f, () => local(() => S.time(id, f))),
  economiaTime: (id: string, f: Filtros = {}) => comFallback(`/times/${enc(id)}/economia`, f, () => local(() => S.economiaTime(id, f))),
  posPlant: (id: string, f: Filtros = {}) => comFallback(`/times/${enc(id)}/pos-plant-retake`, f, () => local(() => S.posPlant(id, f))),
  composicoes: (f: Filtros & Pag & { time_id?: string } = {}) => comFallback('/composicoes', f, () => local(() => S.composicoes(f))),
  comparar: (a: string, b: string, f: Filtros = {}) =>
    comFallback('/comparacoes/times', { ...f, time_a_id: a, time_b_id: b }, () => local(() => S.comparar(a, b, f))),
  partidas: (f: Filtros & Pag & { time_id?: string; jogador_id?: string } = {}) => comFallback('/partidas', f, () => local(() => S.partidas(f))),
  partida: (id: string) => comFallback(`/partidas/${enc(id)}`, undefined, () => local(() => S.partida(id))),
  busca: (q: string, tipo?: 'time' | 'jogador' | 'mapa') => comFallback('/busca', { q, tipo }, () => local(() => S.busca(q, tipo))),

  // ---- só snapshot por enquanto ----
  series: (f: Filtros & { time_id?: string } = {}) => S.series(f),
  serieDaPartida: (id: string) => S.serieDaPartida(id),
  panorama: () => S.panorama(),
  metaCena: (f: Filtros = {}) => S.metaCena(f),
  manifesto: () => S.manifesto(),
};
