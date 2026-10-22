/**
 * Mapa de calor da prancheta: baixa todos os pontos do mapa pela rota /mapas/{id}/calor (sem filtro)
 * e entrega para a lógica do protótipo, que filtra na hora (time, lado, momento e compra). Assim trocar
 * de filtro é instantâneo e o resultado bate com o que a API calcularia com os mesmos parâmetros.
 *
 * A rota devolve no máximo 100 pontos por página: as páginas vêm em paralelo (poucas por vez) e a
 * tela mostra "carregando X de Y" até fechar o recorte, como pede o docs/api.md.
 */
import { ErroApi } from '../api/cliente';
import { dados } from '../api/stats';
import type { PontoCalor, TipoCalor } from '../api/tipos';
import { MAPA_ID, paraMapa } from './reais';

export type PontoPrancheta = Omit<PontoCalor, 'x' | 'y'> & { x: number; y: number };

type Estado = { pontos: PontoPrancheta[]; total: number | null; lidos: number; pronto: boolean; erro: boolean };

const TIPO: Record<string, TipoCalor> = { abates: 'abate', mortes: 'morte', plants: 'plant' };
const POR_PAGINA = 100;
const SIMULTANEAS = 4;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function criarCalor() {
  const estados: Record<string, Estado> = {};

  async function pagina(chave: string, tipo: TipoCalor, page: number, tentativa = 0): Promise<PontoCalor[]> {
    try {
      const r = await dados.calorMapa(MAPA_ID[chave], tipo, page, POR_PAGINA);
      const e = estados[`${chave}|${tipo}`];
      if (e.total == null) e.total = r.pagination?.total ?? r.data.length;
      return r.data;
    } catch (err) {
      // muitas consultas seguidas: espera o tempo que a API pedir e tenta de novo
      if (err instanceof ErroApi && err.status === 429 && tentativa < 4) {
        await espera((err.retryAfter ?? 2) * 1000);
        return pagina(chave, tipo, page, tentativa + 1);
      }
      throw err;
    }
  }

  async function baixar(chave: string, tipo: TipoCalor, aoMudar: () => void) {
    const e = estados[`${chave}|${tipo}`];
    const guardar = (lista: PontoCalor[]) => {
      lista.forEach((q) => {
        const v = paraMapa(chave, q.x, q.y);
        if (v) e.pontos.push({ ...q, x: v[0], y: v[1] });
      });
      e.lidos += lista.length;
      aoMudar();
    };
    try {
      guardar(await pagina(chave, tipo, 1));
      const paginas = Math.ceil((e.total ?? 0) / POR_PAGINA);
      let proxima = 2;
      const trabalhador = async () => {
        while (proxima <= paginas) { const p = proxima++; guardar(await pagina(chave, tipo, p)); }
      };
      await Promise.all(Array.from({ length: SIMULTANEAS }, trabalhador));
      e.pronto = true;
    } catch {
      e.erro = true;
    }
    aoMudar();
  }

  return {
    /** Começa a baixar os pontos do mapa e do tipo, se ainda não começou. */
    garantir(chave: string, tipoCalor: string, aoMudar: () => void) {
      const tipo = TIPO[tipoCalor];
      if (!tipo || !MAPA_ID[chave]) return;
      const k = `${chave}|${tipo}`;
      if (estados[k] && !estados[k].erro) return;
      estados[k] = { pontos: [], total: null, lidos: 0, pronto: false, erro: false };
      baixar(chave, tipo, aoMudar);
    },
    pontos(chave: string, tipoCalor: string): PontoPrancheta[] {
      return estados[`${chave}|${TIPO[tipoCalor]}`]?.pontos ?? [];
    },
    /** Texto de situação enquanto o recorte não está completo ('' quando está). */
    nota(chave: string, tipoCalor: string): string {
      const e = estados[`${chave}|${TIPO[tipoCalor]}`];
      if (!MAPA_ID[chave]) return 'Este mapa ainda não tem desenho na prancheta.';
      if (!e) return 'Carregando os eventos do mapa…';
      if (e.erro) return 'Não deu para carregar todos os eventos do mapa. Troque de aba e volte para tentar de novo.';
      if (!e.pronto) return e.total ? `Carregando ${e.lidos.toLocaleString('pt-BR')} de ${e.total.toLocaleString('pt-BR')} eventos… o mapa ainda não está completo.` : 'Carregando os eventos do mapa…';
      return '';
    },
  };
}
