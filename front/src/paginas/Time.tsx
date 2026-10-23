/** 04 · Time: campanha, lados, economia contra a cena, pós-plant, mapas, elenco, composições e últimas séries. */
import { dados } from '../api/stats';
import { useDados } from '../api/useDados';
import { useCatalogo } from '../componentes/Catalogo';
import { BannerPrancheta } from '../componentes/Prancheta';
import { CartaoSerie } from '../componentes/Series';
import { Agente, Carregando, CorpoAgente, ErroDados, estiloTime, FonteDados, SeloTime, useCorAgente } from '../componentes/Visuais';
import type { CSSProperties } from 'react';
import type { RankingItem, Serie } from '../api/tipos';
import { Anel, BarrasMedia, Colunas } from '../graficos/Graficos';
import { Figura } from '../graficos/Figura';
import { useCoach, useContextoCoach } from '../coach/Coach';
import { Link, useParametro } from '../rotas';
import { COMPRAS, dec, nomeTime, num, pct, taxa } from '../util/formato';

export function Time({ id }: { id: string }) {
  const [mapaSel, setMapa] = useParametro('mapa');
  const f = mapaSel ? { mapa_id: mapaSel } : {};
  const k = `${id}:${mapaSel ?? ''}`;
  const t = useDados(`time:${k}`, () => dados.time(id, f));
  const geral = useDados(`time:${id}:`, () => dados.time(id));
  const eco = useDados(`eco:${k}`, () => dados.economiaTime(id, f));
  const pp = useDados(`pp:${k}`, () => dados.posPlant(id, f));
  const elenco = useDados(`elenco:${k}`, () => dados.ranking({ ...f, time_id: id, page_size: 100 }));
  const comps = useDados(`comps:${k}`, () => dados.composicoes({ ...f, time_id: id, page_size: 5 }));
  const ser = useDados(`series:time:${id}`, () => dados.series({ time_id: id }));
  const cena = useDados('panorama', () => dados.panorama());
  const { mapa, torneio } = useCatalogo();
  const { abrir } = useCoach();
  const d = t.dados?.data;
  const nome = nomeTime(d?.nome ?? geral.dados?.data.nome);
  useContextoCoach(d ? {
    tipo: 'time', id, rotulo: `${nome}${mapaSel ? ` · ${mapa(mapaSel)}` : ''}`,
    sugestoes: [
      { t: 'SCOUTING', q: `Faz um scouting do ${nome}: mapas, lado forte, composição e jogadores-chave.` },
      { t: 'ECONOMIA', q: `Como o ${nome} se sai em cada tipo de compra?` },
      { t: 'PÓS-PLANT', q: `O ${nome} segura depois de plantar a spike?` },
      { t: 'COMPARAR', q: `Compare o ${nome} com o adversário mais forte que ele enfrentou.` },
    ],
  } : null);

  if (t.erro) return <main className="pagina"><ErroDados erro={t.erro} recarregar={t.recarregar} /></main>;
  if (!d) return <main className="pagina"><Carregando altura={200} /><Carregando altura={240} linhas={2} /></main>;

  const atk = d.lados.find((l) => l.lado === 'ataque'), def = d.lados.find((l) => l.lado === 'defesa');
  const mediaCena = new Map(cena.dados?.economia.map((e) => [e.tipo, e.taxa_vitoria_pct]));
  const mapasGeral = geral.dados?.data.mapas ?? d.mapas;
  const series = ser.dados ?? [];
  const torneios = [...new Set(series.map((s) => s.torneio_id))];
  const jogadores = [...(elenco.dados?.data ?? [])].sort((a, b) => b.partidas - a.partidas || (b.acs ?? 0) - (a.acs ?? 0));

  return (
    <main className="pagina pagina--time" style={estiloTime(d.nome)}>
      <Link para="/times" className="voltar mono">← TIMES</Link>
      <section className="time-heroi">
        <div className="time-heroi__logo"><SeloTime nome={d.nome} tamanho="xg" /></div>
        <div className="time-heroi__info">
          <span className="rotulo time-heroi__torneios">{torneios.map((x) => torneio(x)).join(' · ').toUpperCase() || 'TIME'}</span>
          <h1 className="titulo-xl time-heroi__nome">{nome}</h1>
          {series.length > 0 && <Forma series={series} id={id} />}
        </div>
        <div className="perfil__numeros time-heroi__numeros">
          <div><b className="num">{d.resumo.vitorias}<span className="apagado-2">–</span>{d.resumo.derrotas}</b><span className="rotulo">CAMPANHA</span></div>
          <div><b className="num cor-time">{pct(d.resumo.taxa_vitoria_pct, 0)}</b><span className="rotulo">MAPAS VENCIDOS</span></div>
          <div><b className="num">{pct(taxa(d.resumo.rounds_ganhos, d.resumo.rounds_jogados), 0)}</b><span className="rotulo">ROUNDS VENCIDOS</span></div>
        </div>
      </section>

      {elenco.dados && jogadores.length > 0 && (
        <section className="elenco">
          <div className="secao-topo">
            <span className="titulo-m">Jogadores</span>
            <span className="apagado" style={{ fontSize: 12 }}>Quem jogou pelo time{mapaSel ? ` em ${mapa(mapaSel)}` : ''}, do que mais jogou ao que menos jogou.</span>
          </div>
          <div className="elenco__grade">
            {jogadores.slice(0, 10).map((j) => <CartaoJogador key={j.jogador_id} j={j} total={d.resumo.partidas} />)}
          </div>
        </section>
      )}

      <div className="pills" role="toolbar" aria-label="Filtrar por mapa">
        <button type="button" className="pill" aria-pressed={!mapaSel} onClick={() => setMapa(null)}>Todos os mapas<span className="pill__n">{geral.dados?.data.resumo.partidas ?? d.resumo.partidas}</span></button>
        {mapasGeral.map((m) => <button key={m.mapa_id} type="button" className="pill" aria-pressed={mapaSel === m.mapa_id} onClick={() => setMapa(m.mapa_id)}>{mapa(m.mapa_id)}<span className="pill__n">{m.partidas}</span></button>)}
      </div>

      <section className="grade grade-3">
        <Figura titulo="Rounds vencidos por lado" fonte={`${num(d.resumo.rounds_jogados)} ROUNDS`}
          tabela={{ colunas: ['Lado', 'Vitória', 'Rounds'], linhas: d.lados.map((l) => [l.lado, pct(l.taxa_vitoria_pct), `${l.rounds_ganhos} de ${l.rounds_jogados}`]) }}>
          <div className="aneis">
            <Anel valor={atk?.taxa_vitoria_pct ?? null} rotulo={`Ataque · ${atk?.rounds_ganhos ?? 0} de ${atk?.rounds_jogados ?? 0}`} />
            <Anel valor={def?.taxa_vitoria_pct ?? null} rotulo={`Defesa · ${def?.rounds_ganhos ?? 0} de ${def?.rounds_jogados ?? 0}`} cor="var(--time-b)" />
          </div>
        </Figura>
        <Figura titulo="Depois do plant" fonte="MEDE O RESULTADO DEPOIS DO PLANT; NÃO PROVA TENTATIVA DE RETAKE"
          tabela={pp.dados ? { colunas: ['Situação', 'Sucesso', 'Rounds'], linhas: [['Pós-plant (atacando)', pct(pp.dados.data.pos_plant.taxa_sucesso_pct), `${pp.dados.data.pos_plant.vitorias} de ${pp.dados.data.pos_plant.oportunidades}`], ['Depois de sofrer plant (defendendo)', pct(pp.dados.data.retake.taxa_sucesso_pct), `${pp.dados.data.retake.vitorias} de ${pp.dados.data.retake.oportunidades}`]] } : undefined}>
          {pp.dados ? (
            <div className="aneis">
              <Anel valor={pp.dados.data.pos_plant.taxa_sucesso_pct} rotulo={`Pós-plant · ${pp.dados.data.pos_plant.vitorias} de ${pp.dados.data.pos_plant.oportunidades}`} />
              <Anel valor={pp.dados.data.retake.taxa_sucesso_pct} rotulo={`Defesa após plant · ${pp.dados.data.retake.vitorias} de ${pp.dados.data.retake.oportunidades}`} cor="var(--time-b)" />
            </div>
          ) : pp.erro ? <ErroDados erro={pp.erro} /> : <Carregando altura={120} />}
        </Figura>
        <Figura titulo="Vitória por tipo de compra" legenda={[{ cor: 'var(--cor-time)', rotulo: nome }, { cor: 'var(--giz)', rotulo: 'média geral', forma: 'traco' }]}
          fonte={eco.dados ? `REGRA ${eco.dados.data.classificacao_versao.toUpperCase()}` : undefined}
          tabela={eco.dados ? { colunas: ['Compra', 'Vitória', 'Geral', 'Rounds'], linhas: eco.dados.data.categorias.map((c) => [COMPRAS[c.tipo], pct(c.taxa_vitoria_pct), pct(mediaCena.get(c.tipo)), `${c.vitorias} de ${c.rounds}`]) } : undefined}>
          {eco.dados ? <BarrasMedia cor="var(--cor-time)" linhas={eco.dados.data.categorias.map((c) => ({ rotulo: COMPRAS[c.tipo], valor: c.taxa_vitoria_pct, media: mediaCena.get(c.tipo) ?? null, detalhe: `${c.vitorias} de ${c.rounds} rounds` }))} />
            : eco.erro ? <ErroDados erro={eco.erro} /> : <Carregando altura={120} />}
        </Figura>
      </section>

      <div className="dupla">
        <div className="dupla__principal">
          <Figura titulo="Vitórias por mapa" fonte="LINHA = 50%" tabela={{ colunas: ['Mapa', 'Vitória', 'Mapas'], linhas: mapasGeral.map((m) => [mapa(m.mapa_id), pct(m.taxa_vitoria_pct), `${m.vitorias} de ${m.partidas}`]) }}>
            <Colunas itens={mapasGeral.map((m) => ({ rotulo: mapa(m.mapa_id), valor: m.taxa_vitoria_pct, detalhe: `${m.vitorias} de ${m.partidas} mapas`, cor: mapaSel === m.mapa_id ? 'var(--vermelho)' : undefined }))} linhaRef={50} rotuloRef="50%" />
          </Figura>
          <section className="cartao">
            <div className="secao-topo"><span className="titulo-s">Números do elenco</span><span className="apagado" style={{ fontSize: 12 }}>Quem jogou pelo time, não necessariamente o elenco atual.</span></div>
            {elenco.erro ? <ErroDados erro={elenco.erro} /> : !elenco.dados ? <Carregando altura={40} linhas={5} /> : (
              <div className="tabela-rolagem">
                <table className="tabela">
                  <thead><tr><th>Jogador</th><th className="n">Mapas</th><th className="n">ACS</th><th className="n">K/D</th><th className="n">ADR</th><th className="n">KAST</th><th className="n">FB</th><th>Agentes</th></tr></thead>
                  <tbody>{jogadores.map((j) => (
                    <tr key={j.jogador_id}>
                      <td><Link para={`/jogadores/${encodeURIComponent(j.jogador_id)}`}><b>{j.nome}</b></Link></td>
                      <td className="n">{j.partidas}</td><td className="n"><b>{dec(j.acs, 0)}</b></td><td className="n">{dec(j.kd, 2)}</td><td className="n">{dec(j.adr, 0)}</td>
                      <td className="n">{pct(j.kast_pct, 0)}</td><td className="n">{j.first_bloods}</td>
                      <td><span style={{ display: 'inline-flex', gap: 4 }}>{(j.agentes_top ?? []).map((a) => <Agente key={a} id={a} tamanho="p" />)}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
          <section className="dia">
            <div className="dia__topo"><span className="titulo-m">Últimas séries</span><span className="dia__regua" aria-hidden="true" /></div>
            {series.slice(0, 6).map((s) => <CartaoSerie key={s.id} s={s} mostrarTorneio />)}
          </section>
        </div>
        <aside className="dupla__lateral">
          <section className="cartao">
            <span className="titulo-s">Composições mais usadas</span>
            {comps.dados?.data.length ? comps.dados.data.map((c) => (
              <div key={c.composicao_id} className="composicao">
                <span className="composicao__agentes">{c.agente_ids.map((a) => <Agente key={a} id={a} tamanho="p" />)}</span>
                <span className="apagado" style={{ fontSize: 12 }}>{mapa(c.mapa_id)} · {c.aparicoes}× · {pct(c.taxa_vitoria_pct, 0)} de vitória</span>
              </div>
            )) : comps.dados ? <span className="apagado">Sem composição completa no recorte.</span> : <Carregando altura={40} linhas={3} />}
          </section>
          <BannerPrancheta partidaId={series[0]?.mapas[series[0].mapas.length - 1]?.partida_id} titulo="Reveja a última série" texto="Abra o último mapa do time na prancheta." />
          <button type="button" className="cartao cartao--ia cartao--link" style={{ textAlign: 'left', color: 'var(--giz)' }} onClick={() => abrir(`Faz um scouting do ${nome}: mapas, lado forte, composição e jogadores-chave.`)}>
            <span className="rotulo rotulo--vermelho">TROPA AI · SCOUTING</span>
            <b style={{ fontSize: 17, lineHeight: 1.35 }}>“Como jogar contra o {nome}?”</b>
            <span className="giz2" style={{ fontSize: 13 }}>Mapas, lado forte, composição e jogadores-chave ↗</span>
          </button>
        </aside>
      </div>
      <FonteDados meta={t.dados?.meta} />
    </main>
  );
}

/** Últimas séries como V/D, da mais antiga para a mais recente. */
function Forma({ series, id }: { series: Serie[]; id: string }) {
  const ult = series.slice(0, 5).reverse();
  return (
    <span className="forma" aria-label="Últimas séries">
      <span className="rotulo">ÚLTIMAS SÉRIES</span>
      {ult.map((s) => {
        const souA = s.time_a.id === id;
        const meu = souA ? s.vitorias_a : s.vitorias_b, deles = souA ? s.vitorias_b : s.vitorias_a;
        const adv = nomeTime(souA ? s.time_b.nome : s.time_a.nome);
        const r = meu > deles ? 'v' : meu < deles ? 'd' : 'e';
        return <span key={s.id} className={`forma__item forma__item--${r}`} title={`${meu}–${deles} contra ${adv}`}>{r === 'v' ? 'V' : r === 'd' ? 'D' : 'E'}</span>;
      })}
    </span>
  );
}

/** Cartão do jogador com o retrato do agente que ele mais usa. */
function CartaoJogador({ j, total }: { j: RankingItem; total: number }) {
  const principal = j.agentes_top?.[0];
  const cor = useCorAgente(principal);
  const { agente } = useCatalogo();
  return (
    <Link para={`/jogadores/${encodeURIComponent(j.jogador_id)}`} className="jogador-cartao" style={{ '--cor-agente': cor ?? 'var(--trilho)' } as CSSProperties}>
      <span className="jogador-cartao__marca" aria-hidden="true">{principal ? agente(principal) : ''}</span>
      <span className="jogador-cartao__arte" aria-hidden="true"><CorpoAgente id={principal} /></span>
      {total > 0 && j.partidas / total >= 0.5 && <span className="jogador-cartao__selo mono">TITULAR</span>}
      <span className="jogador-cartao__info">
        <b className="jogador-cartao__nome">{j.nome}</b>
        <span className="mono jogador-cartao__agente">{principal ? agente(principal).toUpperCase() : 'SEM AGENTE'}</span>
        <span className="jogador-cartao__numeros">
          <span><b className="num">{dec(j.acs ?? null, 0)}</b><span className="rotulo">ACS</span></span>
          <span><b className="num">{dec(j.kd, 2)}</b><span className="rotulo">K/D</span></span>
          <span><b className="num">{j.partidas}</b><span className="rotulo">{total ? `DE ${total}` : 'MAPAS'}</span></span>
        </span>
        <span className="jogador-cartao__agentes">{(j.agentes_top ?? []).slice(0, 4).map((a) => <Agente key={a} id={a} tamanho="p" />)}</span>
      </span>
    </Link>
  );
}
