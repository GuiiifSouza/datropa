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

/**
 * Mini prancheta animada, a mesma linguagem do orbe do header: mesa quadriculada girando,
 * jogadores dos dois times se mexendo e, no hover, o radar varre, o lápis rabisca e sobe um balão.
 */
const DICAS = ['bora rever!', 'smoke no B!', 'retake 2×1', 'entra junto!'];
export function MiniMesa({ dica = 0 }: { dica?: number }) {
  return (
    <>
      <span className="mini-mesa" aria-hidden="true">
        <span className="mini-mesa__grade" />
        <span className="mini-mesa__radar" />
        <i className="mm-pt mm-a1" /><i className="mm-pt mm-a2" /><i className="mm-pt mm-b1" /><i className="mm-pt mm-b2" />
        <svg className="mini-mesa__lapis" viewBox="0 0 14 60" aria-hidden="true">
          <path d="M3 4l4-4 4 4v6H3z" fill="#FF8FA3" /><rect x="3" y="10" width="8" height="4" fill="#C5CBD3" />
          <rect x="3" y="14" width="8" height="34" fill="#F9A23B" /><path d="M3 48h8l-4 10z" fill="#ECD3A8" /><path d="M6 55h2l-1 3z" fill="#0F1923" />
        </svg>
      </span>
      <span className="mini-dica" aria-hidden="true">{DICAS[dica % DICAS.length]}</span>
    </>
  );
}

export function BotaoPrancheta({ partidaId, round, texto = 'Prancheta', rotulo }: { partidaId?: string | null; round?: number | null; texto?: string; rotulo?: string }) {
  return (
    <Link para={linkPrancheta(partidaId, round)} className="botao-prancheta" aria-label={rotulo ?? (round ? `Ver o round ${round} na prancheta` : 'Rever na prancheta')}>
      <MiniMesa dica={round ?? 0} />{texto}
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
        {[[24, 58, 'var(--time-a)'], [44, 66, 'var(--time-a)'], [92, 18, 'var(--time-b)'], [66, 22, 'var(--time-b)']].map(([l, t, c], i) => (
          <span key={i} style={{ left: l as number, top: t as number, width: 11, height: 11, borderRadius: '50%', background: c as string }} />
        ))}
        <span style={{ left: 30, top: 28, fontSize: 14, color: 'var(--vermelho)', fontWeight: 700 }}>✕</span>
      </span>
      <span style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="rotulo rotulo--menta">PRANCHETA</span>
        <b className="titulo-m" style={{ fontSize: 28 }}>{titulo}</b>
        <span className="giz2" style={{ fontSize: 14 }}>{texto}</span>
      </span>
      <span className="botao botao--mesa"><MiniMesa dica={1} />Abrir</span>
    </Link>
  );
}
