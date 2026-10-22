/** 01 · Panorama: a cena em números, a série em destaque, quem está jogando bem e a porta para a Tropa AI. */
import { dados } from '../api/stats';
import { useDados } from '../api/useDados';
import { useCatalogo } from '../componentes/Catalogo';
import { BannerPrancheta } from '../componentes/Prancheta';
import { CartaoSerie } from '../componentes/Series';
import { Agente, Carregando, ErroDados, FonteDados, LinkTime } from '../componentes/Visuais';
import { BarrasMedia } from '../graficos/Graficos';
import { Figura } from '../graficos/Figura';
import { useCoach } from '../coach/Coach';
import { Link } from '../rotas';
import { COMPRAS, RESULTADOS, dec, diaCurto, nomeTime, num, pct } from '../util/formato';

export function Panorama() {
  const pan = useDados('panorama', () => dados.panorama());
  const ser = useDados('series:todas', () => dados.series());
  const rank = useDados('ranking:completo', () => dados.rankingCompleto());
  const tms = useDados('times:100', () => dados.times({ page_size: 100 }));
  const { torneio, mapa } = useCatalogo();
  const { abrir } = useCoach();

  if (pan.erro) return <main className="pagina"><ErroDados erro={pan.erro} recarregar={pan.recarregar} /></main>;
  const p = pan.dados;
  const series = ser.dados ?? [];
  const recentes = series.slice(0, 8);
  const ultimoDia = series[0]?.dia;
  const destaque = series.filter((s) => s.dia === ultimoDia).sort((a, b) =>
    b.mapas.reduce((t, m) => t + m.placar_a + m.placar_b, 0) - a.mapas.reduce((t, m) => t + m.placar_a + m.placar_b, 0))[0];
  const top = (rank.dados?.data ?? []).filter((r) => r.partidas >= 8 && r.acs != null).sort((a, b) => (b.acs ?? 0) - (a.acs ?? 0)).slice(0, 5);
  const emForma = (tms.dados?.data ?? []).filter((t) => t.partidas >= 10).sort((a, b) => (b.taxa_vitoria_pct ?? 0) - (a.taxa_vitoria_pct ?? 0)).slice(0, 5);

  return (
    <main className="pagina">
      {recentes.length > 0 && (
        <div className="ticker" aria-label="Resultados recentes">
          <span className="rotulo rotulo--vermelho">ÚLTIMOS</span>
          <div className="ticker__trilho">
            {recentes.map((s) => (
              <Link key={s.id} para={`/partidas/${encodeURIComponent(s.mapas[0].partida_id)}`} className="ticker__item">
                <b className={s.vitorias_a > s.vitorias_b ? '' : 'apagado'}>{nomeTime(s.time_a.nome)}</b>
                <span className="num"><span className="cor-a">{s.vitorias_a}</span>–<span className="cor-b">{s.vitorias_b}</span></span>
                <b className={s.vitorias_b > s.vitorias_a ? '' : 'apagado'}>{nomeTime(s.time_b.nome)}</b>
              </Link>
            ))}
          </div>
        </div>
      )}

      <section className="heroi">
        <div className="cabeca">
          <span className="rotulo rotulo--vermelho">{p ? `${p.partidas} MAPAS · ${p.torneios} TORNEIOS · ${diaCurto(p.periodo[0]).split(' · ')[1]} A ${diaCurto(p.periodo[1]).split(' · ')[1]}` : 'CARREGANDO A BASE'}</span>
          <h1 className="titulo-xl">A cena universitária<br />em <span className="cor-ia">números</span></h1>
          <p className="giz2 heroi__texto">Todos os mapas dos campeonatos universitários da base oficial, round a round. Escolha uma partida, um time ou um jogador, ou pergunte direto para a Tropa AI.</p>
          <div className="heroi__acoes">
            <Link para="/partidas" className="botao">Ver as partidas</Link>
            <button type="button" className="botao botao--linha" onClick={() => abrir()}>Perguntar à Tropa AI</button>
          </div>
        </div>
        {destaque ? (
          <div className="heroi__destaque">
            <span className="rotulo rotulo--ambar">EM DESTAQUE · {torneio(destaque.torneio_id).toUpperCase()} · {diaCurto(destaque.dia).toUpperCase()}</span>
            <CartaoSerie s={destaque} destaque />
          </div>
        ) : <Carregando altura={200} />}
      </section>

      {p ? (
        <section className="grade grade-6 kpis" aria-label="A base em números">
          {[[num(p.partidas), 'mapas jogados'], [num(p.rounds), 'rounds'], [num(p.kills), 'abates'], [num(p.times), 'times'], [num(p.jogadores), 'jogadores'], [num(p.prorrogacoes), 'prorrogações']].map(([v, r]) => (
            <div key={r} className="kpi"><b className="num">{v}</b><span className="rotulo">{r}</span></div>
          ))}
        </section>
      ) : <Carregando altura={110} />}

      {p && (
        <section className="grade grade-2 grade--topo">
          <Figura titulo="Vitória por tipo de compra, na base toda" fonte={`REGRA: PISTOL = ROUNDS 1 E 13 · ECO < 10 MIL · FORCE < 20 MIL · FULL ≥ 20 MIL`}
            tabela={{ colunas: ['Compra', 'Vitória', 'Rounds'], linhas: p.economia.map((e) => [COMPRAS[e.tipo], pct(e.taxa_vitoria_pct), num(e.rounds)]) }}>
            <BarrasMedia linhas={p.economia.map((e) => ({ rotulo: COMPRAS[e.tipo], valor: e.taxa_vitoria_pct, detalhe: `${num(e.vitorias)} de ${num(e.rounds)} rounds` }))} />
          </Figura>
          <div className="grade grade-2 fatos">
            <div className="fato"><b className="num">{pct(p.fb_conversao_pct)}</b><span>dos rounds ficam com quem abriu o round (first blood).</span></div>
            <div className="fato"><b className="num">{pct(p.ataque_pct)}</b><span>dos rounds vão para o ataque. A cena é quase equilibrada entre os lados.</span></div>
            <div className="fato"><b className="num">{pct(p.plant_pct)}</b><span>dos rounds têm a spike plantada.</span></div>
            <div className="fato"><b className="num">{dec(p.duracao_media_min, 0)} min</b><span>é a duração média de um mapa. {num(p.prorrogacoes)} foram para a prorrogação.</span></div>
            <div className="fato fato--largo">
              <span className="rotulo">COMO OS ROUNDS ACABAM</span>
              <div className="resultados">
                {p.resultados.map((r) => (
                  <span key={r.resultado} className="resultados__item" style={{ flexGrow: r.rounds }} title={`${RESULTADOS[r.resultado]}: ${num(r.rounds)} rounds`}>
                    <b>{pct((100 * r.rounds) / p.rounds, 0)}</b><span>{RESULTADOS[r.resultado]}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="grade grade-3">
        <div className="cartao">
          <div className="secao-topo"><span className="titulo-s">Top 5 em ACS</span><Link para="/estatisticas" className="mono apagado" style={{ fontSize: 11 }}>TODOS ↗</Link></div>
          <span className="apagado" style={{ fontSize: 12 }}>Mínimo de 8 mapas. ACS = pontuação de combate por round.</span>
          {top.length ? (
            <ol className="lista-rank">
              {top.map((j, i) => (
                <li key={j.jogador_id}>
                  <span className="num lista-rank__pos">{i + 1}</span>
                  <Agente id={j.agentes_top?.[0]} tamanho="p" />
                  <Link para={`/jogadores/${encodeURIComponent(j.jogador_id)}`} className="lista-rank__nome"><b>{j.nome}</b><span className="apagado">{j.partidas} mapas · K/D {dec(j.kd, 2)}</span></Link>
                  <b className="num lista-rank__v">{dec(j.acs, 0)}</b>
                </li>
              ))}
            </ol>
          ) : <Carregando altura={40} linhas={5} />}
        </div>
        <div className="cartao">
          <div className="secao-topo"><span className="titulo-s">Times em forma</span><Link para="/times" className="mono apagado" style={{ fontSize: 11 }}>TODOS ↗</Link></div>
          <span className="apagado" style={{ fontSize: 12 }}>Mais vitórias entre os times com 10 mapas ou mais.</span>
          {emForma.length ? (
            <ol className="lista-rank">
              {emForma.map((t, i) => (
                <li key={t.id}>
                  <span className="num lista-rank__pos">{i + 1}</span>
                  <LinkTime id={t.id} nome={t.nome} className="lista-rank__time" />
                  <span className="apagado mono" style={{ fontSize: 11 }}>{t.vitorias}V {t.derrotas}D</span>
                  <b className="num lista-rank__v">{pct(t.taxa_vitoria_pct, 0)}</b>
                </li>
              ))}
            </ol>
          ) : <Carregando altura={40} linhas={5} />}
        </div>
        <div className="cartao">
          <span className="titulo-s">Torneios na base</span>
          {p ? (
            <ul className="lista-torneios">
              {p.por_torneio.map((t) => (
                <li key={t.torneio_id}>
                  <Link para={`/partidas?torneio=${encodeURIComponent(t.torneio_id)}`}><b>{torneio(t.torneio_id)}</b></Link>
                  <span className="apagado mono" style={{ fontSize: 11 }}>{t.partidas} MAPAS · {diaCurto(t.dia_inicio).split(' · ')[1]} A {diaCurto(t.dia_fim).split(' · ')[1]}</span>
                </li>
              ))}
            </ul>
          ) : <Carregando altura={40} linhas={5} />}
        </div>
      </section>

      <BannerPrancheta partidaId={destaque?.mapas[destaque.mapas.length - 1]?.partida_id} titulo="Reveja qualquer round em 2D"
        texto={destaque ? `Comece pelo ${mapa(destaque.mapas[destaque.mapas.length - 1].mapa_id)} entre ${nomeTime(destaque.time_a.nome)} e ${nomeTime(destaque.time_b.nome)}.` : undefined} />

      <section className="bloco-ia">
        <div className="cabeca">
          <span className="rotulo rotulo--vermelho">TROPA AI · COACH</span>
          <h2 className="titulo-l">Pergunte como perguntaria ao seu coach</h2>
          <p className="giz2">A Tropa AI consulta a base com ferramentas prontas, cita os números que usou e mostra o gráfico sempre que dá.</p>
        </div>
        <div className="sugestoes">
          {['Qual time converte melhor depois de plantar a spike?', 'Quem foi o melhor jogador da fase de grupos do Univavá?', 'Como a Macklogic Red se sai em cada tipo de compra?', 'Compare Azure Bears Golden e Wolf Gaming.'].map((q) => (
            <button key={q} type="button" className="sugestao" onClick={() => abrir(q)}><span className="rotulo rotulo--vermelho">PERGUNTAR</span><span>{q}</span></button>
          ))}
        </div>
      </section>
      <FonteDados meta={rank.dados?.meta} extra="ranking" />
    </main>
  );
}
