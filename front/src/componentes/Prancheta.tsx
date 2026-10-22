/**
 * Ponte para a prancheta tática (dono: Rhuan). Contrato do link combinado com o coach:
 * /prancheta?partida_id=<id>&round=<n>, round começando em 1.
 */
import { Link } from '../rotas';

export function linkPrancheta(partidaId?: string | null, round?: number | null): string {
  const q = new URLSearchParams();
  if (partidaId) q.set('partida_id', partidaId);
  if (round) q.set('round', String(round));
  const s = q.toString();
  return `/prancheta${s ? `?${s}` : ''}`;
}

const Icone = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--menta)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5h16v14H4z" /><path d="M10 9l5 3-5 3z" />
  </svg>
);

export function BotaoPrancheta({ partidaId, round, texto = 'Prancheta', rotulo }: { partidaId?: string | null; round?: number | null; texto?: string; rotulo?: string }) {
  return (
    <Link para={linkPrancheta(partidaId, round)} className="botao-prancheta" aria-label={rotulo ?? (round ? `Ver o round ${round} na prancheta` : 'Rever na prancheta')}>
      <Icone />{texto}
    </Link>
  );
}

export function BannerPrancheta({ partidaId, round, titulo = 'Viu um round que interessa?', texto = 'Abra qualquer mapa na prancheta e acompanhe as jogadas em 2D.' }: {
  partidaId?: string | null; round?: number | null; titulo?: string; texto?: string;
}) {
  return (
    <Link para={linkPrancheta(partidaId, round)} className="banner-prancheta">
      <span aria-hidden="true" className="mini-prancheta">
        <span style={{ left: 14, top: 14, width: 40, height: 30, border: '1px solid rgba(236,232,225,.25)', borderRadius: 6 }} />
        <span style={{ left: 80, top: 40, width: 38, height: 34, border: '1px solid rgba(236,232,225,.25)', borderRadius: 6 }} />
        {[[24, 58, 'var(--ambar)'], [44, 66, 'var(--ambar)'], [92, 18, 'var(--menta)'], [66, 22, 'var(--menta)']].map(([l, t, c], i) => (
          <span key={i} style={{ left: l as number, top: t as number, width: 11, height: 11, borderRadius: '50%', background: c as string }} />
        ))}
        <span style={{ left: 30, top: 28, fontSize: 14, color: 'var(--vermelho)', fontWeight: 700 }}>✕</span>
      </span>
      <span style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="rotulo rotulo--menta">PRANCHETA</span>
        <b className="titulo-m" style={{ fontSize: 28 }}>{titulo}</b>
        <span className="giz2" style={{ fontSize: 14 }}>{texto}</span>
      </span>
      <span className="botao"><Icone />Abrir</span>
    </Link>
  );
}
