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
  const token = await tokenAtual(true);
  if (!token) throw { tipo: 'login', mensagem: 'Não deu para iniciar a sessão da Tropa AI. Recarregue a página e tente de novo.' } satisfies ErroCoach;
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
  const json = (res.headers.get('content-type') ?? '').includes('json');
  const corpo = json ? await res.json().catch(() => null) : null;
  const msg = typeof corpo?.error?.message === 'string' && corpo.error.message.trim() ? corpo.error.message as string : undefined;
  // 429 vem antes do teste de JSON: o limite de perguntas do coach (RESOURCE_EXHAUSTED) ou o do Cloud Run.
  if (res.status === 429) {
    const ra = Number(res.headers.get('Retry-After')) || undefined;
    const quando = ra ? ` Tente de novo em ${Math.ceil(ra / 60)} min.` : '';
    throw { tipo: 'limite', mensagem: msg ?? `Limite de perguntas atingido.${quando || ' Tente mais tarde.'}`, retryAfter: ra } satisfies ErroCoach;
  }
  if (!json) throw { tipo: 'fora', mensagem: 'A Tropa AI ainda não está publicada neste ambiente.' } satisfies ErroCoach;
  if (res.ok && corpo?.data) return { resposta: corpo.data.resposta ?? '', tools: corpo.data.tools ?? [] };
  if (res.status === 401) throw { tipo: 'login', mensagem: 'Sua sessão expirou. Recarregue a página e tente de novo.' } satisfies ErroCoach;
  if (res.status === 400) throw { tipo: 'invalido', mensagem: msg ?? 'Não entendi a pergunta. Escreva de outro jeito.' } satisfies ErroCoach;
  throw { tipo: 'indisponivel', mensagem: 'A Tropa AI não conseguiu consultar os dados agora. Tente de novo.' } satisfies ErroCoach;
}
