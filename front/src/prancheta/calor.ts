/**
 * Mapa de calor da prancheta: baixa todos os pontos do mapa pela rota /mapas/{id}/calor (sem filtro)
 * e entrega para a lógica do protótipo, que filtra na hora (time, lado, momento e compra). Assim trocar
 * de filtro é instantâneo e o resultado bate com o que a API calcularia com os mesmos parâmetros.
 *
 * A rota devolve no máximo 1.000 pontos por página: as páginas vêm em paralelo (poucas por vez) e a
 * tela mostra "carregando X de Y" até fechar o recorte, como pede o docs/api.md. Página que falha
 * (429, 5xx, rede) é tentada de novo sozinha; se mesmo assim não vier, o que já chegou fica.
 */
import { ErroApi } from '../api/cliente';
import { dados } from '../api/stats';
import type { Lista, PontoCalor, TipoCalor } from '../api/tipos';
import { MAPA_ID, paraMapa } from './reais';

export type PontoPrancheta = Omit<PontoCalor, 'x' | 'y'> & { x: number; y: number };

// feitas: páginas já guardadas. Depois de um erro, a próxima tentativa só busca as que faltam.
type Estado = {
  pontos: PontoPrancheta[]; total: number | null; lidos: number; feitas: Set<number>;
  porPagina: number; rodando: boolean; pronto: boolean; erro: boolean; erroEm: number;
};

const TIPO: Record<string, TipoCalor> = { abates: 'abate', mortes: 'morte', plants: 'plant' };
const POR_PAGINA = 1000;
const PAGINA_COMPATIVEL = 100;
const SIMULTANEAS = 4;
const TENTATIVAS = 4;
// depois de desistir, só tenta de novo quando a tela mudar e já tiver passado esse tempo
// (o garantir roda a cada render: sem a pausa, uma API fora do ar viraria um laço de consultas)
const PAUSA_APOS_ERRO_MS = 10_000;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
// 429 (muitas consultas), 5xx e rede caída (status 0) costumam passar sozinhos
const passageiro = (err: unknown) => err instanceof ErroApi && (err.status === 0 || err.status === 429 || err.status >= 500);

export function criarCalor() {
  const estados: Record<string, Estado> = {};

  async function pagina(chave: string, tipo: TipoCalor, page: number, porPagina = POR_PAGINA, tentativa = 0): Promise<Lista<PontoCalor>> {
    try {
      return await dados.calorMapa(MAPA_ID[chave], tipo, page, porPagina);
    } catch (err) {
      // espera o que a API pedir (ou 1 s, 2 s, 4 s...) e tenta de novo só esta página
      if (passageiro(err) && tentativa < TENTATIVAS) {
        await espera(((err as ErroApi).retryAfter ?? 2 ** tentativa) * 1000);
        return pagina(chave, tipo, page, porPagina, tentativa + 1);
      }
      throw err;
    }
  }

  async function baixar(chave: string, tipo: TipoCalor, aoMudar: () => void) {
    const e = estados[`${chave}|${tipo}`];
    const guardar = (page: number, r: Lista<PontoCalor>) => {
      if (e.feitas.has(page)) return;
      e.feitas.add(page);
      if (e.total == null) e.total = r.pagination?.total ?? r.data.length;
      r.data.forEach((q) => {
        const v = paraMapa(chave, q.x, q.y);
        if (v) e.pontos.push({ ...q, x: v[0], y: v[1] });
      });
      e.lidos += r.data.length;
      aoMudar();
    };
    e.rodando = true;
    e.erro = false;
    try {
      // API antiga aceita só 100: manter compatibilidade durante a publicação.
      if (!e.feitas.has(1)) {
        let primeira: Lista<PontoCalor>;
        try { primeira = await pagina(chave, tipo, 1); }
        catch (err) {
          if (!(err instanceof ErroApi) || err.status !== 400) throw err;
          primeira = await pagina(chave, tipo, 1, PAGINA_COMPATIVEL);
        }
        e.porPagina = primeira.pagination.page_size;
        guardar(1, primeira);
      }
      const paginas = Math.max(1, Math.ceil((e.total ?? 0) / e.porPagina));
      const fila: number[] = [];
      for (let p = 2; p <= paginas; p++) if (!e.feitas.has(p)) fila.push(p);
      let falhou = false;
      const trabalhador = async () => {
        while (!falhou && fila.length) {
          const p = fila.shift()!;
          try { guardar(p, await pagina(chave, tipo, p, e.porPagina)); } catch { falhou = true; }
        }
      };
      await Promise.all(Array.from({ length: SIMULTANEAS }, trabalhador));
      e.pronto = e.feitas.size >= paginas;
    } catch {
      // a página 1 falhou mesmo depois das tentativas
    }
    e.rodando = false;
    if (!e.pronto) { e.erro = true; e.erroEm = Date.now(); }
    aoMudar();
  }

  return {
    /** Começa (ou retoma, depois de um erro) o download dos pontos do mapa e do tipo. */
    garantir(chave: string, tipoCalor: string, aoMudar: () => void) {
      const tipo = TIPO[tipoCalor];
      if (!tipo || !MAPA_ID[chave]) return;
      const k = `${chave}|${tipo}`;
      const e = (estados[k] ??= {
        pontos: [], total: null, lidos: 0, feitas: new Set(), porPagina: POR_PAGINA, rodando: false, pronto: false, erro: false, erroEm: 0,
      });
      if (e.rodando || e.pronto) return;
      if (e.erro && Date.now() - e.erroEm < PAUSA_APOS_ERRO_MS) return;
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
      if (e.erro) return `Não deu para carregar todos os eventos do mapa${e.total ? ` (${e.lidos.toLocaleString('pt-BR')} de ${e.total.toLocaleString('pt-BR')})` : ''}: o mapa está incompleto. Mexa em um filtro daqui a pouco para tentar de novo.`;
      if (!e.pronto) return e.total ? `Carregando ${e.lidos.toLocaleString('pt-BR')} de ${e.total.toLocaleString('pt-BR')} eventos… o mapa ainda não está completo.` : 'Carregando os eventos do mapa…';
      return '';
    },
  };
}
