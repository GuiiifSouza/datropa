/** Orbes do centro do header: Tropa AI (abre o coach) e Prancheta (leva à prancheta do Rhuan). */
import type { CSSProperties } from 'react';
import { Link } from '../rotas';

const v = (o: Record<string, string | number>) => o as CSSProperties;

const ICONES: [string, JSX.Element][] = [
  ['#FF4655', <path key="a" d="M5 19V11M12 19V5M19 19v-6" />],
  ['#32E0C4', <g key="b"><circle cx="12" cy="12" r="7" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /></g>],
  ['#F9A23B', <path key="c" d="M13 2L5 14h6l-1 8 8-12h-6z" />],
  ['#ECE8E1', <g key="d"><path d="M3 17l5-6 4 4 8-9" /><path d="M15 6h5v5" /></g>],
  ['#32E0C4', <path key="e" d="M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7z" />],
  ['#F9A23B', <path key="f" d="M8 4h8v5a4 4 0 0 1-8 0zM6 5H3a3 3 0 0 0 5 4M18 5h3a3 3 0 0 1-5 4M12 13v4M8 21h8" />],
];
const DICAS = [
  { t: 'smoke no B!', c: '#ECE8E1', x: '-92px', y: '66px', r: '-7deg', o: '90% 0', cauda: '78%', d: '0s' },
  { t: 'entra junto', c: '#F9A23B', x: '-4px', y: '100px', r: '3deg', o: '40% 0', cauda: '30%', d: '.08s' },
  { t: 'retake 2×1 →', c: '#32E0C4', x: '68px', y: '62px', r: '6deg', o: '10% 0', cauda: '14px', d: '.16s' },
];

export function Hubs({ coachAberto, alternarCoach }: { coachAberto: boolean; alternarCoach: () => void }) {
  return (
    <div className="dt-hubs">
      <button type="button" className={`dt-link ai${coachAberto ? ' is-open' : ''}`} style={v({ '--c': '#FF4655' })}
        aria-label={coachAberto ? 'Fechar a Tropa AI (Esc)' : 'Abrir a Tropa AI (Ctrl K)'} aria-expanded={coachAberto} aria-controls="painel-coach"
        title={coachAberto ? 'Fechar · Esc' : 'Ctrl K'} onClick={alternarCoach}>
        <span className="hub-nome">TROPA AI</span>
        <span className={`dt-hub ai${coachAberto ? ' aberto' : ''}`} aria-hidden="true">
          <span className="hub-base" />
          <span className="ai-aura" />
          <svg className="ai-giz" viewBox="0 0 72 72" fill="none" stroke="#ECE8E1" strokeLinecap="round">
            <circle cx="36" cy="36" r="27" strokeWidth="1.3" strokeDasharray="34 5 14 6 50 4" />
            <circle cx="36.6" cy="35.4" r="28.6" strokeWidth=".8" strokeDasharray="18 9 40 7" opacity=".6" />
          </svg>
          <svg className="ai-globo" viewBox="-20 -20 40 40" fill="none" strokeWidth=".9">
            <defs>
              <radialGradient id="aiGloboFill" cx="34%" cy="30%" r="80%">
                <stop offset="0" stopColor="#FF4655" stopOpacity=".3" />
                <stop offset=".6" stopColor="#FF4655" stopOpacity=".1" />
                <stop offset="1" stopColor="#FF4655" stopOpacity="0" />
              </radialGradient>
            </defs>
            <g transform="rotate(-20)">
              <circle r="17" fill="url(#aiGloboFill)" stroke="#FF4655" strokeWidth="1.4" />
              <ellipse rx="17" ry="4.6" stroke="#FF4655" opacity=".55" />
              <ellipse cy="-9" rx="14.4" ry="3.6" stroke="#FF4655" opacity=".35" />
              <ellipse cy="9" rx="14.4" ry="3.6" stroke="#FF4655" opacity=".35" />
              {['#FF4655', '#FF4655', '#32E0C4', '#F9A23B'].map((c, k) => (
                <ellipse key={k} className="mer" style={v({ '--k': k })} rx="17" ry="17" stroke={c} opacity={k === 1 ? 0.7 : 1} />
              ))}
            </g>
            <path className="ai-nucleo" d="M0 -6.5l1.6 4.9 4.9 1.6-4.9 1.6L0 6.5l-1.6-4.9L-6.5 0l4.9-1.6z" fill="#ECE8E1" stroke="none" />
          </svg>
          <span className="ai-orbita">
            {ICONES.map(([c, icone], i) => (
              <span key={i} className="ai-ic" style={v({ '--d': `${(-8 * i) / 6}s`, '--t': `${0.05 * i}s` })}>
                <b style={v({ '--c': c })}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{icone}</svg>
                </b>
              </span>
            ))}
          </span>
          <svg className="ai-x" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ECE8E1" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </span>
      </button>

      <Link para="/prancheta" className="dt-link pr" style={v({ '--c': '#32E0C4' })} aria-label="Abrir a prancheta tática" title="Replay 2D dos rounds">
        <span className="dt-hub pr" aria-hidden="true">
          <span className="hub-base" />
          <span className="pr-mesa">
            <span className="pr-radar" /><span className="pr-pt a1" /><span className="pr-pt a2" /><span className="pr-pt b1" /><span className="pr-pt b2" />
          </span>
          <svg className="pr-traco" viewBox="0 0 72 72" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 30c4-10 16-12 20-4s4 18 8 24" stroke="#ECE8E1" strokeWidth="2.2" />
            <path d="M17 25l6 6M23 25l-6 6" stroke="#FF4655" strokeWidth="2.4" style={{ animation: 'none', strokeDasharray: 'none' }} />
          </svg>
          <span className="pr-lapis">
            <svg width="14" height="60" viewBox="0 0 14 60">
              <rect x="1" y="0" width="12" height="8" rx="3" fill="#FF8FA0" /><rect x="1" y="7" width="12" height="5" fill="#9AA6B2" />
              <path d="M1 8.5h12M1 10.5h12" stroke="#5D6B78" strokeWidth=".7" /><rect x="1" y="12" width="12" height="34" fill="#F9A23B" />
              <rect x="5" y="12" width="4" height="34" fill="#FFC06B" /><rect x="1" y="12" width="2" height="34" fill="#D9822A" />
              <path d="M1 46h12L7 59z" fill="#E9CFA6" /><path d="M5 54h4l-2 5z" fill="#263442" />
            </svg>
          </span>
          {DICAS.map((d) => (
            <span key={d.t} className="pr-dica" style={v({ '--c': d.c, '--x': d.x, '--y': d.y, '--r': d.r, '--o': d.o, '--cauda': d.cauda, '--t': d.d })}>{d.t}</span>
          ))}
        </span>
        <span className="hub-nome">PRANCHETA</span>
      </Link>
    </div>
  );
}
