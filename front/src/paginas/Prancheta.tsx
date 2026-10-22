/**
 * Entrada da prancheta tática. DONO: Rhuan. Este arquivo é só o ponto de encaixe combinado:
 * o Rhuan substitui o conteúdo pela prancheta real mantendo a rota e os parâmetros.
 *
 * Contrato do link (o coach usa o mesmo, services/coach/coach/tools/abrir_na_prancheta.py):
 *   /prancheta?partida_id=<partida_id>&round=<n>   (round começa em 1)
 * Eventos do round: GET /api/stats/partidas/{partida_id}/rounds/{round}/eventos (docs/api.md, seção 6).
 */
import { dados } from '../api/stats';
import { useDados } from '../api/useDados';
import { useCatalogo } from '../componentes/Catalogo';
import { Link, useLocal } from '../rotas';
import { nomeTime } from '../util/formato';

export function Prancheta() {
  const { busca } = useLocal();
  const partidaId = busca.get('partida_id');
  const round = Number(busca.get('round')) || null;
  const { mapa } = useCatalogo();
  const p = useDados(partidaId ? `partida:${partidaId}` : null, () => dados.partida(partidaId!));
  const d = p.dados?.data;
  return (
    <main className="pagina pagina--estreita">
      <div className="cabeca">
        <span className="rotulo rotulo--menta">PRANCHETA TÁTICA · REPLAY 2D</span>
        <h1 className="titulo-xl">Prancheta</h1>
      </div>
      <section className="cartao" style={{ borderColor: 'rgba(50,224,196,.45)' }}>
        {d ? (
          <>
            <span className="rotulo">VOCÊ VEIO DE</span>
            <b className="titulo-m">{nomeTime(d.times[0].nome)} × {nomeTime(d.times[1].nome)} · {mapa(d.mapa_id)}{round ? ` · round ${round}` : ''}</b>
          </>
        ) : <b className="titulo-m">Escolha um mapa para rever</b>}
        <p className="giz2">A prancheta tática está sendo construída pelo Rhuan e entra nesta mesma rota. Os links de todo o site e da Tropa AI já chegam aqui com a partida e o round.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {d ? <Link para={`/partidas/${encodeURIComponent(d.id)}`} className="botao">Voltar para a partida</Link> : <Link para="/partidas" className="botao">Ver as partidas</Link>}
        </div>
        <code className="mono apagado" style={{ fontSize: 12 }}>/prancheta?partida_id={partidaId ?? '…'}&round={round ?? '…'}</code>
      </section>
    </main>
  );
}
