/** 02 · Partidas: séries agrupadas por dia, com filtro por torneio e resumo do recorte ao lado. */
import { useMemo, useState } from 'react';
import { dados } from '../api/stats';
import { useDados } from '../api/useDados';
import { useCatalogo } from '../componentes/Catalogo';
import { BannerPrancheta } from '../componentes/Prancheta';
import { CartaoSerie } from '../componentes/Series';
import { Carregando, ErroDados, Vazio } from '../componentes/Visuais';
import { useCoach } from '../coach/Coach';
import { useParametro } from '../rotas';
import { diaCurto, num, plural } from '../util/formato';
import type { Serie } from '../api/tipos';

const DIAS_POR_VEZ = 4;

export function Partidas() {
  const [torneioSel, setTorneio] = useParametro('torneio');
  const [busca, setBusca] = useState('');
  const [dias, setDias] = useState(DIAS_POR_VEZ);
  const { dados: todas, erro, recarregar } = useDados('series:todas', () => dados.series());
  const { torneio, mapa, cat } = useCatalogo();
  const { abrir } = useCoach();

  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of todas ?? []) m.set(s.torneio_id, (m.get(s.torneio_id) ?? 0) + s.mapas.length);
    return m;
  }, [todas]);
  const total = [...contagem.values()].reduce((a, b) => a + b, 0);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (todas ?? []).filter((s) => (!torneioSel || s.torneio_id === torneioSel)
      && (!q || s.time_a.nome.toLowerCase().includes(q) || s.time_b.nome.toLowerCase().includes(q)));
  }, [todas, torneioSel, busca]);

  const porDia = useMemo(() => {
    const m = new Map<string, Serie[]>();
    for (const s of filtradas) (m.get(s.dia ?? '') ?? m.set(s.dia ?? '', []).get(s.dia ?? '')!).push(s);
    return [...m.entries()];
  }, [filtradas]);

  const resumo = useMemo(() => {
    const mapas = filtradas.flatMap((s) => s.mapas);
    const times = new Set(filtradas.flatMap((s) => [s.time_a.id, s.time_b.id]));
    const rounds = mapas.reduce((t, m) => t + m.placar_a + m.placar_b, 0);
    const porMapa = new Map<string, number>();
    for (const m of mapas) porMapa.set(m.mapa_id, (porMapa.get(m.mapa_id) ?? 0) + 1);
    const ranking = [...porMapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const datas = filtradas.map((s) => s.dia).filter(Boolean).sort() as string[];
    return { mapas: mapas.length, times: times.size, rounds, prorr: mapas.filter((m) => m.prorrogacao).length, ranking, de: datas[0], ate: datas[datas.length - 1] };
  }, [filtradas]);

  const torneiosOrdem = (cat?.torneios ?? []).map((t) => t.id).sort((a, b) => (contagem.get(b) ?? 0) - (contagem.get(a) ?? 0));

  return (
    <main className="pagina">
      <div className="cabeca">
        <span className="rotulo rotulo--vermelho">{num(total)} MAPAS · {cat?.torneios.length ?? '…'} TORNEIOS</span>
        <h1 className="titulo-xl">Partidas</h1>
      </div>

      <div className="pills" role="toolbar" aria-label="Filtrar por torneio">
        <button type="button" className="pill" aria-pressed={!torneioSel} onClick={() => { setTorneio(null); setDias(DIAS_POR_VEZ); }}>Todos<span className="pill__n">{num(total)}</span></button>
        {torneiosOrdem.map((t) => (
          <button key={t} type="button" className="pill" aria-pressed={torneioSel === t} onClick={() => { setTorneio(t); setDias(DIAS_POR_VEZ); }}>
            {torneio(t)}<span className="pill__n">{contagem.get(t) ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="dupla">
        <div className="dupla__principal">
          <label className="campo-busca">
            <span className="so-leitor">Filtrar por time</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar por time" />
          </label>
          {erro ? <ErroDados erro={erro} recarregar={recarregar} /> : !todas ? <Carregando altura={130} linhas={4} /> : porDia.length === 0 ? (
            <Vazio titulo="Nenhuma série nesse recorte">Tire o filtro de time ou escolha outro torneio.</Vazio>
          ) : (
            <>
              {porDia.slice(0, dias).map(([dia, ss]) => (
                <section key={dia} className="dia">
                  <div className="dia__topo">
                    <span className="titulo-m">{diaCurto(dia)}</span>
                    <span className="rotulo">{[...new Set(ss.map((s) => torneio(s.torneio_id)))].join(' · ').toUpperCase()} · {plural(ss.length, 'SÉRIE', 'SÉRIES')}</span>
                    <span className="dia__regua" aria-hidden="true" />
                  </div>
                  {ss.map((s) => <CartaoSerie key={s.id} s={s} mostrarTorneio={!torneioSel && new Set(ss.map((x) => x.torneio_id)).size > 1} />)}
                </section>
              ))}
              {dias < porDia.length && (
                <button type="button" className="botao botao--linha" style={{ alignSelf: 'center' }} onClick={() => setDias((d) => d + DIAS_POR_VEZ)}>
                  Carregar dias anteriores ({porDia.length - dias} restantes)
                </button>
              )}
            </>
          )}
        </div>

        <aside className="dupla__lateral">
          <BannerPrancheta partidaId={filtradas[0]?.mapas[0]?.partida_id} />
          <section className="cartao">
            <span className="rotulo rotulo--ambar">{torneioSel ? torneio(torneioSel).toUpperCase() : 'TODOS OS TORNEIOS'}</span>
            <span className="titulo-m">{resumo.de ? `${diaCurto(resumo.de).split(' · ')[1]} a ${diaCurto(resumo.ate).split(' · ')[1]}` : '—'}</span>
            <div className="grade" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {[[num(resumo.mapas), 'MAPAS'], [num(resumo.times), 'TIMES'], [num(resumo.rounds), 'ROUNDS'], [num(resumo.prorr), 'PRORROGAÇÕES']].map(([v, r]) => (
                <div key={r} className="cartao-mini"><b className="num" style={{ fontSize: 32 }}>{v}</b><span className="rotulo" style={{ fontSize: 10 }}>{r}</span></div>
              ))}
            </div>
          </section>
          <section className="cartao">
            <span className="rotulo">MAPAS MAIS JOGADOS NO RECORTE</span>
            {resumo.ranking.map(([m, n]) => (
              <div key={m} className="linha-barra">
                <span>{mapa(m)}</span>
                <span className="barra"><span style={{ width: `${(n / (resumo.ranking[0]?.[1] || 1)) * 100}%` }} /></span>
                <b className="num">{n}</b>
              </div>
            ))}
          </section>
          <button type="button" className="cartao cartao--ia cartao--link" style={{ textAlign: 'left', color: 'var(--giz)' }}
            onClick={() => abrir(torneioSel ? `Resuma o ${torneio(torneioSel)}: quem se destacou e quais séries foram mais disputadas?` : 'Quais foram as séries mais disputadas da base?')}>
            <span className="rotulo rotulo--vermelho">TROPA AI</span>
            <b style={{ fontSize: 17, lineHeight: 1.35 }}>“{torneioSel ? `Resuma o ${torneio(torneioSel)}.` : 'Quais séries foram mais disputadas?'}”</b>
            <span className="giz2" style={{ fontSize: 13 }}>Perguntar sobre estas partidas ↗</span>
          </button>
        </aside>
      </div>
    </main>
  );
}
