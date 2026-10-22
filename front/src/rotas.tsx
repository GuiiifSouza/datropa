/**
 * Roteador mínimo sobre a History API. O app tem poucas rotas e nenhum loader,
 * então não vale uma dependência. Os rewrites do Hosting já mandam tudo para o index.html.
 */
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

const EVENTO = 'dt:navegou';
// VITE_ROTEAMENTO=hash guarda a rota no hash (#/partidas). Serve para pré-visualizações em hospedagem estática
// sem rewrite para o index.html. No Firebase Hosting o padrão (caminho normal) continua valendo.
const HASH = import.meta.env.VITE_ROTEAMENTO === 'hash';

function assinar(cb: () => void) {
  window.addEventListener('popstate', cb);
  window.addEventListener('hashchange', cb);
  window.addEventListener(EVENTO, cb);
  return () => {
    window.removeEventListener('popstate', cb);
    window.removeEventListener('hashchange', cb);
    window.removeEventListener(EVENTO, cb);
  };
}
let ultimaRota = '/';
function retrato() {
  if (!HASH) return window.location.pathname + window.location.search;
  // Âncoras comuns (#conteudo) não são rota: mantém a última rota válida.
  const h = window.location.hash.slice(1);
  if (h.startsWith('/')) ultimaRota = h;
  else if (!h) ultimaRota = '/';
  return ultimaRota;
}
const href = (para: string) => (HASH ? `#${para}` : para);

export function navegar(para: string, opcoes: { substituir?: boolean; manterRolagem?: boolean } = {}) {
  if (para === retrato()) return;
  const caminhoAntes = new URL(retrato(), window.location.origin).pathname;
  if (opcoes.substituir) window.history.replaceState(null, '', href(para));
  else window.history.pushState(null, '', href(para));
  window.dispatchEvent(new Event(EVENTO));
  if (!opcoes.manterRolagem && new URL(para, window.location.origin).pathname !== caminhoAntes) window.scrollTo({ top: 0 });
}

export function useLocal() {
  const atual = useSyncExternalStore(assinar, retrato, retrato);
  const url = new URL(atual, window.location.origin);
  return { caminho: url.pathname, busca: url.searchParams };
}

/** Lê e grava um parâmetro de busca sem empilhar histórico. */
export function useParametro(nome: string): [string | null, (v: string | null) => void] {
  const { busca } = useLocal();
  const definir = (v: string | null) => {
    const u = new URL(retrato(), window.location.origin);
    if (v === null || v === '') u.searchParams.delete(nome);
    else u.searchParams.set(nome, v);
    navegar(u.pathname + u.search, { substituir: true, manterRolagem: true });
  };
  return [busca.get(nome), definir];
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { para: string };

export function Link({ para, onClick, ...resto }: LinkProps) {
  const aoClicar = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (resto.target && resto.target !== '_self') return;
    e.preventDefault();
    navegar(para);
  };
  return <a href={href(para)} onClick={aoClicar} {...resto} />;
}

export type Params = Record<string, string>;
export type Rota = { padrao: string; render: (p: Params) => ReactNode };

function casar(padrao: string, caminho: string): Params | null {
  const a = padrao.split('/').filter(Boolean);
  const b = caminho.replace(/\/+$/, '').split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const p: Params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) p[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return p;
}

export function Roteador({ rotas, naoEncontrada }: { rotas: Rota[]; naoEncontrada: ReactNode }) {
  const { caminho } = useLocal();
  for (const r of rotas) {
    const p = casar(r.padrao, caminho);
    if (p) return <>{r.render(p)}</>;
  }
  return <>{naoEncontrada}</>;
}

/** Item de menu ativo quando o caminho começa com o prefixo. */
export function useAtivo(prefixo: string) {
  const { caminho } = useLocal();
  return prefixo === '/' ? caminho === '/' : caminho === prefixo || caminho.startsWith(prefixo + '/');
}
