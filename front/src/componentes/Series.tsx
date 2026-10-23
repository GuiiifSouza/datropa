/** Cartão de série no grid padronizado de Partidas: colunas fixas e mapas em três slots iguais. */
import type { Serie } from '../api/tipos';
import { Link } from '../rotas';
import { nomeTime } from '../util/formato';
import { useCatalogo } from './Catalogo';
import { CHAVE_DO_MAPA } from '../prancheta/reais';
import { BotaoPrancheta } from './Prancheta';
import { SeloTime } from './Visuais';

export function CartaoSerie({ s, destaque, mostrarTorneio }: { s: Serie; destaque?: boolean; mostrarTorneio?: boolean }) {
  const { mapa, torneio } = useCatalogo();
  const slots = Math.max(3, s.mapas.length);
  const ganhouA = s.vitorias_a > s.vitorias_b, ganhouB = s.vitorias_b > s.vitorias_a;
  const md = s.mapas.length === 1 ? 'MD1' : 'MD3';
  const link = `/partidas/${encodeURIComponent(s.mapas[0].partida_id)}`;
  // a prancheta abre no Round real, no round 1, do primeiro mapa da série que tem desenho nela (o M1 quando dá);
  // mapa sem desenho cairia no Planejar vazio, sem as composições dos times
  const naPrancheta = s.mapas.find((m) => CHAVE_DO_MAPA[m.mapa_id]) ?? s.mapas[0];
  return (
    <div className={`serie${destaque ? ' serie--destaque' : ''}`}>
      {mostrarTorneio && <span className="rotulo serie__torneio">{torneio(s.torneio_id)}</span>}
      <div className="serie__linha">
        <Link para={link} className="serie__time serie__time--a" aria-label={`${nomeTime(s.time_a.nome)} ${s.vitorias_a} a ${s.vitorias_b} ${nomeTime(s.time_b.nome)}`}>
          <b className={ganhouA ? '' : 'apagado'}>{nomeTime(s.time_a.nome)}</b><SeloTime nome={s.time_a.nome} />
        </Link>
        <Link para={link} className="serie__placar num" tabIndex={-1} aria-hidden="true">
          <span className="cor-a">{s.vitorias_a}</span><span style={{ color: 'var(--apagado-2)' }}>–</span><span className="cor-b">{s.vitorias_b}</span>
        </Link>
        <Link para={link} className="serie__time" tabIndex={-1} aria-hidden="true">
          <SeloTime nome={s.time_b.nome} lado="b" /><b className={ganhouB ? '' : 'apagado'}>{nomeTime(s.time_b.nome)}</b>
        </Link>
        <span className="mono serie__md">{md}</span>
        <BotaoPrancheta partidaId={naPrancheta.partida_id} round={1} rotulo={`Rever ${nomeTime(s.time_a.nome)} × ${nomeTime(s.time_b.nome)} na prancheta`} />
      </div>
      <div className="serie__mapas" style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}>
        {Array.from({ length: slots }, (_, i) => {
          const m = s.mapas[i];
          // MD1: os slots vazios só guardam o alinhamento. MD3 decidida em 2 mapas: o 3º aparece como "não precisou".
          if (!m) return s.mapas.length === 1
            ? <span key={i} className="serie__mapa serie__mapa--vazio serie__mapa--oculto" aria-hidden="true" />
            : <span key={i} className="serie__mapa serie__mapa--vazio"><span className="mono">M{i + 1}</span><span>Não precisou</span></span>;
          return (
            <Link key={m.partida_id} para={`/partidas/${encodeURIComponent(m.partida_id)}`} className="serie__mapa">
              <span className="serie__mapa-nome">
                <span className="mono apagado-2">M{i + 1}</span>
                <span className="giz2">{mapa(m.mapa_id)}</span>
                {m.prorrogacao && <span className="mono" style={{ fontSize: 9, color: 'var(--alerta)' }}>PRORR.</span>}
              </span>
              <b className="num" style={{ fontSize: 20 }}>
                <span style={{ color: m.placar_a > m.placar_b ? 'var(--time-a)' : 'var(--apagado)' }}>{m.placar_a}</span>
                <span style={{ color: 'var(--apagado-2)' }}>:</span>
                <span style={{ color: m.placar_b > m.placar_a ? 'var(--time-b)' : 'var(--apagado)' }}>{m.placar_b}</span>
              </b>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
