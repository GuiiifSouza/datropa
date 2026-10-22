/** Formatação pt-BR e nomes de exibição. Valor ausente vira "—", nunca zero. */

export const VAZIO = '—';

export function pct(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return VAZIO;
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) + '%';
}
export function dec(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return VAZIO;
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
export function num(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return VAZIO;
  return Math.round(v).toLocaleString('pt-BR');
}
export function taxa(vitorias: number, total: number): number | null {
  return total > 0 ? (100 * vitorias) / total : null;
}
export function razao(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

// Siglas que a gold escreve como "Ufmt" (INITCAP). Só exibição; o ID não muda.
const SIGLAS = new Set(['a2e', 'uff', 'caap', 'ceub', 'fatec', 'pg', 'fei', 'utfpr', 'ufg', 'gdu', 'ufpb', 'ime', 'iff', 'umc', 'gc', 'ufmg',
  'ufmt', 'ufpr', 'bbn', 'ufrj', 'ufu', 'uscs', 'usp', 'pucc', 'pucgo', 'unifesp']);
const ACENTOS: Record<string, string> = { maua: 'Mauá', passaro: 'Pássaro', panterao: 'Panterão', fenix: 'Fênix', unievangelica: 'UniEVANGÉLICA',
  sistematica: 'Sistemática', vulkanica: 'Vulkânica', univava: 'Univavá' };

export function nomeTime(nome: string | null | undefined): string {
  if (!nome) return 'Time desconhecido';
  return nome.split(' ').map((w) => {
    const l = w.toLowerCase();
    if (SIGLAS.has(l)) return l.toUpperCase();
    if (ACENTOS[l]) return ACENTOS[l];
    return w;
  }).join(' ');
}

/** Sigla curta para o selo do time: iniciais das palavras, até 3 letras. */
export function sigla(nome: string | null | undefined): string {
  const n = nomeTime(nome);
  const palavras = n.split(' ').filter(Boolean);
  if (palavras.length === 1) return palavras[0].slice(0, 3).toUpperCase();
  return palavras.map((w) => w[0]).join('').slice(0, 3).toUpperCase();
}

export function slugAgente(nome: string | null | undefined): string {
  return (nome ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Dia local de Brasília (YYYY-MM-DD) de um instante ISO. */
export function diaBrasilia(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function diaCurto(dia: string | null | undefined): string {
  if (!dia) return 'Data desconhecida';
  const [a, m, d] = dia.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d, 12));
  return `${DIAS[dt.getUTCDay()]} · ${d} ${MESES[m - 1]}`;
}
export function diaNumerico(dia: string | null | undefined): string {
  if (!dia) return VAZIO;
  const [a, m, d] = dia.split('-');
  return `${d}/${m}/${a.slice(2)}`;
}
export function hora(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
export function minutos(ms: number | null | undefined): string {
  if (!ms) return VAZIO;
  return `${Math.round(ms / 60000)} min`;
}
export function plural(n: number, um: string, varios: string): string {
  return `${num(n)} ${n === 1 ? um : varios}`;
}
export const COMPRAS: Record<string, string> = { pistol: 'Pistol', eco: 'Eco', force: 'Force', full: 'Full' };
export const RESULTADOS: Record<string, string> = { eliminacao: 'Eliminação', detonacao: 'Spike explodiu', desarme: 'Desarme', tempo: 'Tempo', outro: 'Outro' };
