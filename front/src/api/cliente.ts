/**
 * Cliente HTTP de /api/stats no formato de docs/api.md (envelope, erros e paginação),
 * com troca automática para o snapshot quando a rota ainda não está no ar.
 */
import type { Meta } from './tipos';

export type ModoDados = 'auto' | 'api' | 'snapshot';
const modoEnv = (import.meta.env.VITE_FONTE_DADOS as string | undefined)?.toLowerCase();
export const MODO: ModoDados = modoEnv === 'api' || modoEnv === 'snapshot' ? modoEnv : 'auto';

export class ErroApi extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
    public retryAfter?: number,
  ) {
    super(message);
  }
  /** Sem API para essa rota (Hosting devolveu HTML, rede caiu, timeout, serviço fora). */
  get semApi() {
    return this.code === 'SEM_API' || this.status === 0 || this.status === 502 || this.status === 503 || this.status === 504
      || (this.status === 404 && this.code !== 'NOT_FOUND') || this.status === 405 || this.status === 501;
  }
}

type ProvedorToken = (garantir?: boolean) => Promise<string | null>;
let tokenProvider: ProvedorToken | null = null;
/** O módulo de auth registra aqui como pegar o ID token do Firebase. */
export function registrarToken(fn: ProvedorToken) {
  tokenProvider = fn;
}
/** `garantir`: sem usuário, entra como anônimo antes (a Tropa AI precisa do token; as stats não). */
export async function tokenAtual(garantir = false): Promise<string | null> {
  try {
    return tokenProvider ? await tokenProvider(garantir) : null;
  } catch {
    return null;
  }
}

export type Params = Record<string, string | number | boolean | null | undefined>;
export function querystring(params: Params = {}): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : '';
}

// O Cloud Run pode levar alguns segundos no cold start; timeout curto jogaria a sessão inteira no snapshot.
const TIMEOUT_MS = 15000;

async function lerErro(res: Response): Promise<ErroApi> {
  let code = 'INTERNAL';
  let message = `Erro ${res.status}`;
  let details: Record<string, unknown> | undefined;
  try {
    const corpo = await res.json();
    code = corpo?.error?.code ?? code;
    message = corpo?.error?.message ?? message;
    details = corpo?.error?.details;
  } catch {
    /* corpo sem JSON */
  }
  const ra = Number(res.headers.get('Retry-After'));
  return new ErroApi(res.status, code, message, details, Number.isFinite(ra) && ra > 0 ? ra : undefined);
}

/** GET em /api/stats. Lança ErroApi; `semApi` diz se vale cair no snapshot. */
export async function getStats<T>(rota: string, params?: Params): Promise<T> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = await tokenAtual();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`/api/stats${rota}${querystring(params)}`, { headers, signal: ctrl.signal });
    const tipo = res.headers.get('content-type') ?? '';
    if (!tipo.includes('json')) throw new ErroApi(0, 'SEM_API', 'A rota ainda não está no ar.');
    if (!res.ok) throw await lerErro(res);
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ErroApi) throw e;
    if (ctrl.signal.aborted) throw new ErroApi(0, 'TIMEOUT', 'A API demorou para responder.');
    throw new ErroApi(0, 'SEM_API', 'Não deu para falar com a API.');
  } finally {
    window.clearTimeout(timer);
  }
}

// Rota que falhou por falta de API não é tentada de novo nesta sessão (evita esperar o timeout a cada tela).
const rotasFora = new Set<string>();
const chaveRota = (rota: string) => rota.replace(/\/[^/]*[0-9a-f]{8,}[^/]*/gi, '/:id');

/**
 * Busca na API e, no modo auto, cai no snapshot quando a rota não existe ou não responde.
 * Erro de verdade (400 de parâmetro, 404 de entidade) sobe para a tela.
 */
export async function comFallback<T extends { meta?: Meta }>(rota: string, params: Params | undefined, local: () => Promise<T>): Promise<T> {
  if (MODO === 'snapshot' || (MODO === 'auto' && rotasFora.has(chaveRota(rota)))) return marcar(await local(), 'snapshot');
  try {
    return marcar(await getStats<T>(rota, params), 'api');
  } catch (e) {
    if (MODO === 'auto' && e instanceof ErroApi && (e.semApi || e.status === 400)) {
      // Timeout é passageiro (cold start): tenta a API de novo na próxima tela.
      if (e.semApi && e.code !== 'TIMEOUT') rotasFora.add(chaveRota(rota));
      if (import.meta.env.DEV) console.info(`[dados] ${rota}: usando o snapshot (${e.code}).`);
      return marcar(await local(), 'snapshot');
    }
    throw e;
  }
}

function marcar<T extends { meta?: Meta }>(r: T, fonte: 'api' | 'snapshot'): T {
  return { ...r, meta: { atualizado_em: r.meta?.atualizado_em ?? null, ...r.meta, fonte } };
}
