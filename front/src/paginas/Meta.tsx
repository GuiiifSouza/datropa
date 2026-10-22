/** 07 · Meta da cena: agentes, mapas e sites, economia, armas e composições. */
import { dados } from '../api/stats';
import { useDados } from '../api/useDados';
import { useCatalogo } from '../componentes/Catalogo';
import { Agente, Carregando, ErroDados } from '../componentes/Visuais';
import { BarrasMedia } from '../graficos/Graficos';
import { Figura } from '../graficos/Figura';
import { useCoach } from '../coach/Coach';
import { useParametro } from '../rotas';
import { COMPRAS, dec, num, pct } from '../util/formato';

const CLASSES = ['Duelista', 'Iniciador', 'Controlador', 'Sentinela'];

export function Meta() {
  const [torneio, setTorneio] = useParametro('torneio');
  const [mapaSel, setMapa] = useParametro('mapa');
  const { cat, mapa, agente, classe } = useCatalogo();
  const { abrir } = useCoach();
  const f = { torneio_id: torneio ?? undefined, mapa_id: mapaSel ?? undefined };
  const m = useDados(`meta:${torneio ?? ''}:${mapaSel ?? ''}`, () => dados.metaCena(f));
  const d = m.dados;
  const totalAparicoes = d?.agentes.reduce((s, a) => s + a.aparicoes, 0) ?? 0;

  return (
    <main className="pagina">
      <div className="cabeca">
        <span className="rotulo rotulo--vermelho">O QUE A CENA ESTÁ JOGANDO</span>
        <h1 className="titulo-xl">Meta</h1>
      </div>
      <div className="barra-ferramentas">
        <select className="select" aria-label="Torneio" value={torneio ?? ''} onChange={(e) => setTorneio(e.target.value || null)}>
          <option value="">Todos os torneios</option>{cat?.torneios.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <div className="pills" role="toolbar" aria-label="Filtrar por mapa" style={{ flex: 1 }}>
          <button type="button" className="pill" aria-pressed={!mapaSel} onClick={() => setMapa(null)}>Todos os mapas</button>
          {cat?.mapas.map((x) => <button key={x.id} type="button" className="pill" aria-pressed={mapaSel === x.id} onClick={() => setMapa(x.id)}>{x.nome}</button>)}
        </div>
      </div>

      {m.erro ? <ErroDados erro={m.erro} recarregar={m.recarregar} /> : !d ? <Carregando altura={220} linhas={3} /> : (
        <>
          <section className="cartao">
            <div className="secao-topo">
              <span className="titulo-s">Agentes</span>
              <span className="apagado" style={{ fontSize: 12 }}>Pick = em quantos times-mapa o agente apareceu. Vitória = mapas vencidos com ele.</span>
            </div>
            <div className="classes">
              {CLASSES.map((c) => {
                const n = d.agentes.filter((a) => classe(a.agente_id) === c).reduce((s, a) => s + a.aparicoes, 0);
                return <span key={c} className="chip">{c} <b>{pct(totalAparicoes ? (100 * n) / totalAparicoes : null, 0)}</b></span>;
              })}
            </div>
            <div className="grade-agentes">
              {d.agentes.map((a) => (
                <div key={a.agente_id} className="agente-meta" title={`${agente(a.agente_id)}: ${a.aparicoes} aparições`}>
                  <Agente id={a.agente_id} tamanho="g" />
                  <b>{agente(a.agente_id)}</b>
                  <span className="agente-meta__linha"><span className="rotulo">PICK</span><b className="num">{pct(a.pick_pct, 0)}</b></span>
                  <span className="barra"><span style={{ width: `${Math.min(100, a.pick_pct ?? 0)}%` }} /></span>
                  <span className="agente-meta__linha"><span className="rotulo">VITÓRIA</span><b className="num" style={{ color: (a.taxa_vitoria_pct ?? 0) >= 50 ? 'var(--giz)' : 'var(--apagado)' }}>{pct(a.taxa_vitoria_pct, 0)}</b></span>
                  <span className="apagado mono" style={{ fontSize: 10 }}>K/D {dec(a.kd, 2)} · ACS {dec(a.acs, 0)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="grade grade-3">
            {d.mapas.map((x) => {
              const sites = Object.entries(x.plants).sort();
              const totalPlants = sites.reduce((s, [, n]) => s + n, 0);
              return (
                <div key={x.mapa_id} className="cartao mapa-meta">
                  <div className="secao-topo"><span className="titulo-m">{mapa(x.mapa_id)}</span><span className="mono apagado" style={{ fontSize: 11 }}>{x.partidas} MAPAS · {x.prorrogacoes} PRORR.</span></div>
                  <div className="lados-barra" title={`Ataque vence ${pct(x.ataque_pct)} dos rounds`}>
                    <span style={{ width: `${x.ataque_pct ?? 50}%`, background: 'var(--ambar)' }}><b>ATK {pct(x.ataque_pct, 0)}</b></span>
                    <span style={{ flex: 1, background: 'var(--menta)' }}><b>DEF {pct(x.ataque_pct === null ? null : 100 - x.ataque_pct, 0)}</b></span>
                  </div>
                  {totalPlants > 0 && (
                    <div className="sites">
                      <span className="rotulo">PLANTS POR SITE</span>
                      {sites.map(([s, n]) => (
                        <div key={s} className="linha-barra"><span className="mono">{s}</span><span className="barra"><span style={{ width: `${(100 * n) / totalPlants}%`, background: 'var(--giz-2)' }} /></span><b className="num">{pct((100 * n) / totalPlants, 0)}</b></div>
                      ))}
                    </div>
                  )}
                  <span style={{ display: 'flex', gap: 4 }}>{x.agentes_top.map((a) => <Agente key={a.agente_id} id={a.agente_id} tamanho="p" />)}</span>
                </div>
              );
            })}
          </section>

          <section className="grade grade-2">
            <Figura titulo="Vitória por tipo de compra" fonte="EQUIPAMENTO SOMADO DOS CINCO NO ROUND"
              tabela={{ colunas: ['Compra', 'Vitória', 'Rounds'], linhas: d.economia.map((e) => [COMPRAS[e.tipo], pct(e.taxa_vitoria_pct), num(e.rounds)]) }}>
              <BarrasMedia linhas={d.economia.map((e) => ({ rotulo: COMPRAS[e.tipo], valor: e.taxa_vitoria_pct, detalhe: `${num(e.rounds)} rounds` }))} />
            </Figura>
            <Figura titulo="Armas que mais mataram" fonte="BASE TODA · ABATE PELO ITEM DO DANO FINAL"
              tabela={{ colunas: ['Arma', 'Abates'], linhas: d.armas.slice(0, 10).map((a) => [a.nome, num(a.kills)]) }}>
              <BarrasMedia linhas={d.armas.slice(0, 8).map((a) => ({ rotulo: a.nome, valor: a.kills }))} max={d.armas[0]?.kills ?? 1} formato={(v) => num(v)} cor="var(--giz-2)" />
            </Figura>
          </section>

          <section className="cartao">
            <span className="titulo-s">Composições mais repetidas</span>
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead><tr><th>Mapa</th><th>Agentes</th><th className="n">Vezes</th><th className="n">Vitórias</th></tr></thead>
                <tbody>{d.composicoes.map((c) => (
                  <tr key={c.composicao_id}><td><b>{mapa(c.mapa_id)}</b></td><td><span style={{ display: 'inline-flex', gap: 4 }}>{c.agente_ids.map((a) => <Agente key={a} id={a} tamanho="p" />)}</span></td><td className="n">{c.aparicoes}</td><td className="n">{pct(c.taxa_vitoria_pct, 0)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </section>

          <button type="button" className="cartao cartao--ia cartao--link" style={{ textAlign: 'left', color: 'var(--giz)' }} onClick={() => abrir(`Qual a composição que mais vence${mapaSel ? ` no ${mapa(mapaSel)}` : ''}?`)}>
            <span className="rotulo rotulo--vermelho">TROPA AI</span>
            <b style={{ fontSize: 17 }}>“Qual composição mais vence{mapaSel ? ` no ${mapa(mapaSel)}` : ''}?”</b>
          </button>
        </>
      )}
    </main>
  );
}
