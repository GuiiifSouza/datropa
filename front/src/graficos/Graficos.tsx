/**
 * Gráficos próprios em SVG/HTML, na identidade Sinal Aberto. Sem biblioteca: os formatos são poucos
 * e fixos (barras contra a média, barras espelhadas, momentum, livro de rounds, anel, colunas, economia).
 * Regras: marcas finas, cantos de 4px, texto sempre em tinta de texto (nunca na cor da série),
 * dica no hover e foco por teclado, e a Figura oferece a tabela com os mesmos números.
 */
import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { useDica } from './Figura';
import { COMPRAS, RESULTADOS, pct } from '../util/formato';

const AMBAR = 'var(--time-a)';
const MENTA = 'var(--time-b)';

// ---------------------------------------------------------------- barras contra a média
export type LinhaMedia = { rotulo: string; valor: number | null; media?: number | null; detalhe?: string };
export function BarrasMedia({ linhas, cor = AMBAR, max = 100, formato = (v: number | null) => pct(v), rotuloMedia = 'média geral' }: {
  linhas: LinhaMedia[]; cor?: string; max?: number; formato?: (v: number | null) => string; rotuloMedia?: string;
}) {
  const { mostrar, esconder, elemento } = useDica();
  const larg = (v: number | null | undefined) => `${Math.max(0, Math.min(100, ((v ?? 0) / max) * 100))}%`;
  return (
    <div className="barras-media" data-grafico>
      {linhas.map((l) => {
        const texto = `${l.rotulo}: ${formato(l.valor)}${l.media != null ? ` · ${rotuloMedia} ${formato(l.media)}` : ''}${l.detalhe ? ` · ${l.detalhe}` : ''}`;
        return (
          <div key={l.rotulo} className="barras-media__linha" tabIndex={0} aria-label={texto}
            onPointerMove={(e) => mostrar(e, texto)} onPointerLeave={esconder} onFocus={(e) => mostrar({ clientX: e.currentTarget.getBoundingClientRect().left + 80, clientY: e.currentTarget.getBoundingClientRect().top, currentTarget: e.currentTarget }, texto)} onBlur={esconder}>
            <span className="barras-media__rotulo">{l.rotulo}</span>
            <span className="barras-media__trilho">
              <span className="barras-media__fundo" />
              <span className="barras-media__barra" style={{ width: larg(l.valor), background: cor }} />
              {l.media != null && <span className="barras-media__media" style={{ left: `calc(${larg(l.media)} - 1.5px)` }} />}
            </span>
            <b className="num barras-media__valor">{formato(l.valor)}</b>
          </div>
        );
      })}
      {elemento}
    </div>
  );
}

// ---------------------------------------------------------------- barras espelhadas (A × B)
export type LinhaEspelho = { rotulo: string; a: number | null; b: number | null; formato?: (v: number | null) => string; max?: number };
export function BarrasEspelhadas({ linhas, nomeA, nomeB }: { linhas: LinhaEspelho[]; nomeA: string; nomeB: string }) {
  const { mostrar, esconder, elemento } = useDica();
  return (
    <div className="espelho" data-grafico>
      {linhas.map((l) => {
        const f = l.formato ?? ((v: number | null) => pct(v));
        const max = l.max ?? Math.max(l.a ?? 0, l.b ?? 0, 1);
        const w = (v: number | null) => `${Math.max(2, ((v ?? 0) / max) * 100)}%`;
        const texto = `${l.rotulo}: ${nomeA} ${f(l.a)} · ${nomeB} ${f(l.b)}`;
        const ganhaA = (l.a ?? -Infinity) > (l.b ?? -Infinity);
        const ganhaB = (l.b ?? -Infinity) > (l.a ?? -Infinity);
        return (
          <div key={l.rotulo} className="espelho__linha" tabIndex={0} aria-label={texto} onPointerMove={(e) => mostrar(e, texto)} onPointerLeave={esconder}>
            <b className={`num espelho__v${ganhaA ? '' : ' apagado'}`}>{f(l.a)}</b>
            <span className="espelho__lado espelho__lado--a"><span style={{ width: w(l.a), background: AMBAR, opacity: ganhaA || !ganhaB ? 1 : 0.45 }} /></span>
            <span className="espelho__rotulo">{l.rotulo}</span>
            <span className="espelho__lado"><span style={{ width: w(l.b), background: MENTA, opacity: ganhaB || !ganhaA ? 1 : 0.45 }} /></span>
            <b className={`num espelho__v espelho__v--b${ganhaB ? '' : ' apagado'}`}>{f(l.b)}</b>
          </div>
        );
      })}
      {elemento}
    </div>
  );
}

// ---------------------------------------------------------------- momentum do placar
export type PontoPlacar = { round: number; a: number; b: number };
export function Momentum({ pontos, nomeA, nomeB, altura = 220, destaque }: { pontos: PontoPlacar[]; nomeA: string; nomeB: string; altura?: number; destaque?: number }) {
  const { mostrar, esconder, elemento } = useDica();
  if (!pontos.length) return null;
  const n = pontos.length;
  const W = 10 + n * 10, H = 110, meio = H / 2;
  const maxD = Math.max(3, ...pontos.map((p) => Math.abs(p.a - p.b)));
  const esc = (meio - 8) / maxD;
  const xy = [[5, meio], ...pontos.map((p, i) => [5 + (i + 1) * 10, meio - (p.a - p.b) * esc])];
  const linha = 'M' + xy.map((p) => p.join(',')).join(' L');
  const area = (s: 1 | -1) => 'M' + xy.map(([x, y]) => `${x},${s > 0 ? Math.min(y, meio) : Math.max(y, meio)}`).join(' L') + ` L${W - 5},${meio} L5,${meio} Z`;
  const pico = pontos.reduce((m, p) => (Math.abs(p.a - p.b) > Math.abs(m.a - m.b) ? p : m), pontos[0]);
  const ultimo = pontos[n - 1];
  const legenda = `${nomeA} ${pico.a > pico.b ? 'chega a +' + (pico.a - pico.b) : ''}${pico.b > pico.a ? `${nomeB} chega a +${pico.b - pico.a}` : ''} no round ${pico.round}; termina ${ultimo.a}–${ultimo.b}.`;
  return (
    <div className="momentum" data-grafico>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={legenda} style={{ height: altura }}>
        <line x1="5" y1={meio} x2={W - 5} y2={meio} stroke="#3A4856" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {[12, 24].filter((r) => r < n).map((r) => (
          <line key={r} x1={5 + r * 10} y1="4" x2={5 + r * 10} y2={H - 4} stroke="#263442" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        ))}
        <path className="momentum__area" d={area(1)} fill="rgba(255,70,85,.24)" />
        <path className="momentum__area" d={area(-1)} fill="rgba(63,169,245,.24)" />
        <path className="momentum__linha" pathLength={1} d={linha} fill="none" stroke="#ECE8E1" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {destaque && destaque <= n && <circle cx={5 + destaque * 10} cy={xy[destaque][1]} r="3" fill="#FF4655" stroke="#16212C" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        {pontos.map((p, i) => (
          <rect key={p.round} x={5 + i * 10 + 5} y="0" width="10" height={H} fill="transparent"
            onPointerMove={(e) => mostrar(e, `Round ${p.round}: ${nomeA} ${p.a}–${p.b} ${nomeB}`)} onPointerLeave={esconder} />
        ))}
      </svg>
      <div className="momentum__eixo mono">
        <span>R1</span>{n > 12 && <span>R12 · troca de lado</span>}{n > 24 && <span>R24 · prorrogação</span>}<span>R{n}</span>
      </div>
      {elemento}
    </div>
  );
}

// ---------------------------------------------------------------- livro de rounds
export type CelulaRound = { round: number; vencedor: 'a' | 'b' | null; resultado: string | null; plant_site?: string | null; lado_vencedor?: string | null; fb?: 'a' | 'b' | null };
const ICONE: Record<string, ReactNode> = {
  eliminacao: <path d="M7 7l10 10M17 7L7 17" />,
  detonacao: <path d="M12 3l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" />,
  desarme: <path d="M5 12l4 4 10-10" />,
  tempo: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
};
export function LivroRounds({ rounds, nomeA, nomeB, linkRound, renderLink }: {
  rounds: CelulaRound[]; nomeA: string; nomeB: string; linkRound?: (n: number) => string; renderLink?: (href: string, conteudo: ReactNode, rotulo: string, cls: string) => ReactNode;
}) {
  const { mostrar, esconder, elemento } = useDica();
  return (
    <div className="livro" data-grafico>
      <div className="livro__linhas">
        {(['a', 'b'] as const).map((lado) => (
          <div key={lado} className="livro__linha">
            <span className={`livro__nome ${lado === 'a' ? 'cor-a' : 'cor-b'}`}>{lado === 'a' ? nomeA : nomeB}</span>
            <div className="livro__celulas">
              {rounds.map((r, idx) => {
                const ganhou = r.vencedor === lado;
                const texto = `Round ${r.round}: ${r.vencedor === 'a' ? nomeA : r.vencedor === 'b' ? nomeB : '?'} venceu${r.lado_vencedor ? ` no ${r.lado_vencedor}` : ''} · ${RESULTADOS[r.resultado ?? ''] ?? '—'}${r.plant_site ? ` · plant no ${r.plant_site}` : ''}`;
                const cls = `livro__celula${ganhou ? ` livro__celula--${lado}` : ''}${r.round === 13 || r.round === 25 ? ' livro__celula--corte' : ''}`;
                const conteudo = ganhou ? (
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONE[r.resultado ?? ''] ?? ICONE.eliminacao}</svg>
                ) : null;
                const props = { onPointerMove: (e: PointerEvent) => mostrar(e, texto), onPointerLeave: esconder };
                const atraso = { '--i': idx } as CSSProperties;
                if (ganhou && linkRound && renderLink) return <span key={r.round} {...props} className="livro__slot" style={atraso}>{renderLink(linkRound(r.round), conteudo, `${texto}. Abrir na prancheta`, cls)}</span>;
                return <span key={r.round} {...props} style={atraso} className={cls} aria-label={ganhou ? texto : undefined} role={ganhou ? 'img' : undefined}>{conteudo}</span>;
              })}
            </div>
          </div>
        ))}
        <div className="livro__linha livro__linha--numeros">
          <span className="livro__nome" />
          <div className="livro__celulas">{rounds.map((r) => <span key={r.round} className={`livro__n mono${r.round === 13 || r.round === 25 ? ' livro__celula--corte' : ''}`}>{r.round}</span>)}</div>
        </div>
      </div>
      <div className="livro__legenda mono">
        <span><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6">{ICONE.eliminacao}</svg> eliminação</span>
        <span><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6">{ICONE.detonacao}</svg> spike explodiu</span>
        <span><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6">{ICONE.desarme}</svg> desarme</span>
        <span><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6">{ICONE.tempo}</svg> tempo</span>
      </div>
      {elemento}
    </div>
  );
}

// ---------------------------------------------------------------- anel
export function Anel({ valor, rotulo, cor = AMBAR, tamanho = 96, centro }: { valor: number | null; rotulo: string; cor?: string; tamanho?: number; centro?: string }) {
  const r = 40, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, valor ?? 0));
  return (
    <div className="anel" style={{ width: tamanho }}>
      <svg viewBox="0 0 100 100" width={tamanho} height={tamanho} role="img" aria-label={`${rotulo}: ${pct(valor)}`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--trilho)" strokeWidth="9" />
        {valor !== null && <circle cx="50" cy="50" r={r} fill="none" stroke={cor} strokeWidth="9" className="anel__arco" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 50 50)" />}
        <text x="50" y="57" textAnchor="middle" className="anel__texto">{centro ?? pct(valor, 0)}</text>
      </svg>
      <span className="anel__rotulo">{rotulo}</span>
    </div>
  );
}

// ---------------------------------------------------------------- colunas
export type Coluna = { rotulo: string; valor: number | null; detalhe?: string; cor?: string };
export function Colunas({ itens, max = 100, formato = (v: number | null) => pct(v, 0), altura = 160, linhaRef, rotuloRef }: {
  itens: Coluna[]; max?: number; formato?: (v: number | null) => string; altura?: number; linhaRef?: number; rotuloRef?: string;
}) {
  const { mostrar, esconder, elemento } = useDica();
  return (
    <div className="colunas" data-grafico style={{ height: altura + 44 }}>
      {linhaRef != null && <span className="colunas__ref" style={{ bottom: 26 + (linhaRef / max) * altura }}><span className="mono">{rotuloRef}</span></span>}
      {itens.map((i) => {
        const texto = `${i.rotulo}: ${formato(i.valor)}${i.detalhe ? ` · ${i.detalhe}` : ''}`;
        return (
          <div key={i.rotulo} className="colunas__item" tabIndex={0} aria-label={texto} onPointerMove={(e) => mostrar(e, texto)} onPointerLeave={esconder}>
            <b className="num colunas__v">{formato(i.valor)}</b>
            <span className="colunas__trilho" style={{ height: altura }}>
              <span style={{ height: `${Math.max(1.5, ((i.valor ?? 0) / max) * 100)}%`, background: i.cor ?? AMBAR }} />
            </span>
            <span className="colunas__rotulo">{i.rotulo}</span>
          </div>
        );
      })}
      {elemento}
    </div>
  );
}

// ---------------------------------------------------------------- economia round a round
export type RoundEconomia = { round: number; eqA: number; eqB: number; compraA: string; compraB: string; vencedor: 'a' | 'b' | null };
export function EconomiaRounds({ rounds, nomeA, nomeB }: { rounds: RoundEconomia[]; nomeA: string; nomeB: string }) {
  const { mostrar, esconder, elemento } = useDica();
  const max = Math.max(1, ...rounds.flatMap((r) => [r.eqA, r.eqB]));
  return (
    <div className="eco-rounds" data-grafico>
      {rounds.map((r) => {
        const texto = `Round ${r.round}: ${nomeA} ${COMPRAS[r.compraA] ?? r.compraA} (${r.eqA.toLocaleString('pt-BR')}) · ${nomeB} ${COMPRAS[r.compraB] ?? r.compraB} (${r.eqB.toLocaleString('pt-BR')}) · venceu ${r.vencedor === 'a' ? nomeA : r.vencedor === 'b' ? nomeB : '?'}`;
        return (
          <div key={r.round} className={`eco-rounds__col${r.round === 13 || r.round === 25 ? ' eco-rounds__col--corte' : ''}`} tabIndex={0} aria-label={texto}
            onPointerMove={(e) => mostrar(e, texto)} onPointerLeave={esconder}>
            <span className="eco-rounds__meia eco-rounds__meia--a"><span style={{ height: `${(r.eqA / max) * 100}%`, background: AMBAR, opacity: r.vencedor === 'a' ? 1 : 0.4 }} /></span>
            <span className="eco-rounds__meia eco-rounds__meia--b"><span style={{ height: `${(r.eqB / max) * 100}%`, background: MENTA, opacity: r.vencedor === 'b' ? 1 : 0.4 }} /></span>
          </div>
        );
      })}
      {elemento}
    </div>
  );
}
