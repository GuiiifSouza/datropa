/**
 * Cliente de POST /api/coach/perguntar (services/coach/README.md).
 * O serviço não guarda estado: o front manda o histórico em texto (até 20 turnos).
 */
import { tokenAtual } from '../api/cliente';

export type Papel = 'usuario' | 'coach';
export type ToolChamada = { nome: string; argumentos: Record<string, unknown>; resultado: unknown };
export type RespostaCoach = { resposta: string; tools: ToolChamada[] };
export type ErroCoach = { tipo: 'login' | 'limite' | 'invalido' | 'indisponivel' | 'fora'; mensagem: string; retryAfter?: number };

export const LIMITE_PERGUNTA = 1000;
const MAX_TURNOS = 20;
const TIMEOUT_MS = 60000;

export async function perguntar(pergunta: string, historico: { papel: Papel; texto: string }[]): Promise<RespostaCoach> {
  const token = await tokenAtual();
  if (!token) throw { tipo: 'login', mensagem: 'Entre com o Google para conversar com a Tropa AI.' } satisfies ErroCoach;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch('/api/coach/perguntar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pergunta: pergunta.slice(0, LIMITE_PERGUNTA), historico: historico.slice(-MAX_TURNOS) }),
      signal: ctrl.signal,
    });
  } catch {
    throw { tipo: 'indisponivel', mensagem: 'A Tropa AI demorou demais ou está fora do ar. Tente de novo.' } satisfies ErroCoach;
  } finally {
    window.clearTimeout(timer);
  }
  if (!(res.headers.get('content-type') ?? '').includes('json')) {
    throw { tipo: 'fora', mensagem: 'A Tropa AI ainda não está publicada neste ambiente.' } satisfies ErroCoach;
  }
  const corpo = await res.json().catch(() => null);
  if (res.ok && corpo?.data) return { resposta: corpo.data.resposta ?? '', tools: corpo.data.tools ?? [] };
  const msg = corpo?.error?.message as string | undefined;
  if (res.status === 401) throw { tipo: 'login', mensagem: 'Sua sessão expirou. Entre de novo com o Google.' } satisfies ErroCoach;
  if (res.status === 429) {
    const ra = Number(res.headers.get('Retry-After')) || undefined;
    throw { tipo: 'limite', mensagem: `Você fez muitas perguntas seguidas. Tente de novo${ra ? ` em ${Math.ceil(ra / 60)} min` : ' daqui a pouco'}.`, retryAfter: ra } satisfies ErroCoach;
  }
  if (res.status === 400) throw { tipo: 'invalido', mensagem: msg ?? 'Não entendi a pergunta. Escreva de outro jeito.' } satisfies ErroCoach;
  throw { tipo: 'indisponivel', mensagem: 'A Tropa AI não conseguiu consultar os dados agora. Tente de novo.' } satisfies ErroCoach;
}
