/** 06 · Estatísticas: líderes, tabela de jogadores com filtros e ordenação, tabela de times e glossário. */
import { useMemo, useState } from 'react';
import { dados } from '../api/stats';
import { useDados } from '../api/useDados';
import type { RankingItem, TimeItem } from '../api/tipos';
import { useCatalogo } from '../componentes/Catalogo';
import { Agente, Carregando, ErroDados, FonteDados, LinkTime, Vazio } from '../componentes/Visuais';
import { Link, useParametro } from '../rotas';
import { Seletor } from '../componentes/Seletor';
import { dec, nomeTime, pct } from '../util/formato';

type Col = { k: keyof RankingItem | 'time'; t: string; f: (r: RankingItem) => string; v: (r: RankingItem) => number | string | null; titulo?: string };
const COLS: Col[] = [
  { k: 'partidas', t: 'Mapas', f: (r) => String(r.partidas), v: (r) => r.partidas },
  { k: 'acs', t: 'ACS', f: (r) => dec(r.acs ?? null, 0), v: (r) => r.acs ?? null },
  { k: 'kd', t: 'K/D', f: (r) => dec(r.kd, 2), v: (r) => r.kd },
  { k: 'adr', t: 'ADR', f: (r) => dec(r.adr, 0), v: (r) => r.adr },
  { k: 'kast_pct', t: 'KAST', f: (r) => pct(r.kast_pct ?? null, 0), v: (r) => r.kast_pct ?? null, titulo: 'Estimado: abate, assistência, sobreviveu ou foi trocado em até 5 s' },
  { k: 'hs_pct', t: 'HS%', f: (r) => pct(r.hs_pct, 1), v: (r) => r.hs_pct },
  { k: 'kills', t: 'K', f: (r) => String(r.kills), v: (r) => r.kills },
  { k: 'deaths', t: 'D', f: (r) => String(r.deaths), v: (r) => r.deaths },
  { k: 'assists', t: 'A', f: (r) => String(r.assists), v: (r) => r.assists },
  { k: 'first_bloods', t: 'FB', f: (r) => String(r.first_bloods), v: (r) => r.first_bloods },
  { k: 'first_deaths', t: 'FD', f: (r) => String(r.first_deaths ?? '—'), v: (r) => r.first_deaths ?? null },
  { k: 'taxa_vitoria_pct', t: 'Vitórias', f: (r) => pct(r.taxa_vitoria_pct ?? null, 0), v: (r) => r.taxa_vitoria_pct ?? null },
];
const LIDERES: [keyof RankingItem, string, (v: number | null) => string][] = [
  ['acs', 'ACS', (v) => dec(v, 0)], ['kd', 'K/D', (v) => dec(v, 2)], ['adr', 'ADR', (v) => dec(v, 0)],
  ['kast_pct', 'KAST', (v) => pct(v, 0)], ['first_bloods', 'First bloods', (v) => String(v ?? '—')], ['hs_pct', 'HS%', (v) => pct(v, 1)],
];

export function Estatisticas() {
  const [torneio, setTorneio] = useParametro('torneio');
  const [mapa, setMapa] = useParametro('mapa');
  const [agente, setAgente] = useParametro('agente');
  const [minimo, setMinimo] = useState(8);
  const [ordem, setOrdem] = useState<{ k: Col['k']; desc: boolean }>({ k: 'acs', desc: true });
  const [mostrar, setMostrar] = useState(50);
  const [q, setQ] = useState('');
  const { cat } = useCatalogo();
  const f = { torneio_id: torneio ?? undefined, mapa_id: mapa ?? undefined, agente_id: agente ?? undefined };
  const rank = useDados(`ranking:completo:${torneio ?? ''}:${mapa ?? ''}:${agente ?? ''}`, () => dados.rankingCompleto(f));
  const tms = useDados(`times:100:${torneio ?? ''}:${mapa ?? ''}`, () => dados.times({ page_size: 100, torneio_id: torneio ?? undefined, mapa_id: mapa ?? undefined }));
  const nomesTime = useMemo(() => new Map((tms.dados?.data ?? []).map((t) => [t.id, t.nome])), [tms.dados]);

  const pool = useMemo(() => (rank.dados?.data ?? []).filter((r) => r.partidas >= minimo), [rank.dados, minimo]);
  const linhas = useMemo(() => {
    const col = COLS.find((c) => c.k === ordem.k) ?? COLS[1];
    const t = q.trim().toLowerCase();
    return pool.filter((r) => !t || r.nome.toLowerCase().includes(t)).sort((a, b) => {
      const va = col.v(a), vb = col.v(b);
      if (va === null) return 1;
      if (vb === null) return -1;
      const d = (va as number) - (vb as number);
      return (ordem.desc ? -d : d) || a.jogador_id.localeCompare(b.jogador_id);
    });
  }, [pool, ordem, q]);

  return (
    <main className="pagina">
      <div className="cabeca">
        <span className="rotulo rotulo--vermelho">{rank.dados ? `${rank.dados.data.length} JOGADORES NO RECORTE` : 'ESTATÍSTICAS'}</span>
        <h1 className="titulo-xl">Estatísticas</h1>
      </div>

      <div className="barra-ferramentas">
        <Seletor rotulo="Torneio" valor={torneio ?? ''} aoMudar={(v) => setTorneio(v || null)}
          opcoes={[{ valor: '', rotulo: 'Todos os torneios' }, ...(cat?.torneios ?? []).map((t) => ({ valor: t.id, rotulo: t.nome }))]} larguraMin={240} />
        <Seletor rotulo="Mapa" valor={mapa ?? ''} aoMudar={(v) => setMapa(v || null)}
          opcoes={[{ valor: '', rotulo: 'Todos os mapas' }, ...(cat?.mapas ?? []).map((m) => ({ valor: m.id, rotulo: m.nome }))]} larguraMin={180} />
        <Seletor rotulo="Agente" valor={agente ?? ''} aoMudar={(v) => setAgente(v || null)} larguraMin={180}
          opcoes={[{ valor: '', rotulo: 'Todos os agentes' }, ...[...(cat?.agentes ?? [])].sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '')).map((a) => ({ valor: a.id, rotulo: a.nome ?? a.id, extra: <Agente id={a.id} tamanho="p" /> }))]} />
        <span className="segmentado" role="group" aria-label="Mínimo de mapas">
          {[1, 5, 8, 15].map((n) => <button key={n} type="button" aria-pressed={minimo === n} onClick={() => setMinimo(n)}>{n === 1 ? 'Todos' : `${n}+ mapas`}</button>)}
        </span>
      </div>

      {rank.erro ? <ErroDados erro={rank.erro} recarregar={rank.recarregar} /> : !rank.dados ? <Carregando altura={150} linhas={2} /> : (
        <>
          <section className="grade grade-lideres">
            {LIDERES.map(([k, rot, fmt]) => {
              const top = [...pool].filter((r) => r[k] != null).sort((a, b) => (b[k] as number) - (a[k] as number)).slice(0, 5);
              if (!top.length) return null;
              const [p1, ...resto] = top;
              return (
                <div key={k} className="cartao lider">
                  <span className="rotulo">{rot}</span>
                  <Link para={`/jogadores/${encodeURIComponent(p1.jogador_id)}`} className="lider__p1">
                    <Agente id={p1.agentes_top?.[0]} tamanho="g" />
                    <span><b className="titulo-s" style={{ display: 'block' }}>{p1.nome}</b><span className="apagado" style={{ fontSize: 12 }}>{nomeTime(nomesTime.get(p1.time_id ?? '') ?? (p1.time_id ? '…' : 'vários times'))} · {p1.partidas} mapas</span></span>
                    <b className="num lider__v">{fmt(p1[k] as number)}</b>
                  </Link>
                  <ol className="lista-rank lista-rank--compacta" start={2}>
                    {resto.map((r, i) => (
                      <li key={r.jogador_id}><span className="num lista-rank__pos">{i + 2}</span><Link para={`/jogadores/${encodeURIComponent(r.jogador_id)}`} className="lista-rank__nome"><b>{r.nome}</b></Link><b className="num lista-rank__v">{fmt(r[k] as number)}</b></li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </section>

          <section className="cartao">
            <div className="secao-topo">
              <span className="titulo-s">Jogadores</span>
              <label className="campo-busca campo-busca--pequeno"><span className="so-leitor">Buscar jogador</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar jogador" /></label>
            </div>
            {linhas.length === 0 ? <Vazio titulo="Ninguém nesse recorte">Diminua o mínimo de mapas ou tire um filtro.</Vazio> : (
              <div className="tabela-rolagem">
                <table className="tabela">
                  <thead><tr>
                    <th>#</th><th>Jogador</th><th>Time</th>
                    {COLS.map((c) => (
                      <th key={c.k} className="n" title={c.titulo} aria-sort={ordem.k === c.k ? (ordem.desc ? 'descending' : 'ascending') : undefined}>
                        <button type="button" aria-pressed={ordem.k === c.k} onClick={() => setOrdem((o) => ({ k: c.k, desc: o.k === c.k ? !o.desc : true }))}>{c.t}{ordem.k === c.k ? (ordem.desc ? ' ↓' : ' ↑') : ''}</button>
                      </th>
                    ))}
                  </tr></thead>
                  <tbody>{linhas.slice(0, mostrar).map((r, i) => (
                    <tr key={r.jogador_id}>
                      <td className="mono apagado">{i + 1}</td>
                      <td><Link para={`/jogadores/${encodeURIComponent(r.jogador_id)}`} className="tabela-jogador"><Agente id={r.agentes_top?.[0]} tamanho="p" /><b>{r.nome}</b></Link></td>
                      <td>{r.time_id ? <Link para={`/times/${encodeURIComponent(r.time_id)}`} className="giz2">{nomeTime(nomesTime.get(r.time_id) ?? '…')}</Link> : <span className="apagado">vários</span>}</td>
                      {COLS.map((c) => <td key={c.k} className="n">{ordem.k === c.k ? <b>{c.f(r)}</b> : c.f(r)}</td>)}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {mostrar < linhas.length && <button type="button" className="botao botao--linha botao--pequeno" style={{ alignSelf: 'center' }} onClick={() => setMostrar((m) => m + 50)}>Mostrar mais ({linhas.length - mostrar})</button>}
          </section>
        </>
      )}

      <TabelaTimes itens={tms.dados?.data} />

      <section className="cartao glossario">
        <span className="titulo-s">Glossário</span>
        <dl>
          <dt>ACS</dt><dd>Pontuação de combate média por round, como no placar do jogo.</dd>
          <dt>K/D</dt><dd>Abates divididos por mortes, somados no recorte (nunca média de partidas).</dd>
          <dt>ADR</dt><dd>Dano em adversários por round. Dano em aliado não conta.</dd>
          <dt>HS%</dt><dd>Tiros na cabeça entre todos os tiros que acertaram (cabeça, corpo e perna).</dd>
          <dt>KAST</dt><dd>Rounds em que o jogador abateu, assistiu, sobreviveu ou foi trocado em até 5 s. Estimado a partir dos abates da base.</dd>
          <dt>FB / FD</dt><dd>First blood e first death: primeiro abate e primeira morte do round.</dd>
          <dt>Compra</dt><dd>Pelo equipamento somado dos cinco: pistol (rounds 1 e 13), eco (menos de 10 mil), force (menos de 20 mil) e full.</dd>
        </dl>
      </section>
      <FonteDados meta={rank.dados?.meta} />
    </main>
  );
}

function TabelaTimes({ itens }: { itens?: TimeItem[] }) {
  const [ordem, setOrdem] = useState<'partidas' | 'taxa'>('taxa');
  if (!itens) return <Carregando altura={200} />;
  const xs = [...itens].filter((t) => t.partidas >= 3).sort((a, b) => ordem === 'taxa' ? (b.taxa_vitoria_pct ?? -1) - (a.taxa_vitoria_pct ?? -1) || b.partidas - a.partidas : b.partidas - a.partidas);
  return (
    <section className="cartao">
      <div className="secao-topo">
        <span className="titulo-s">Times</span>
        <span className="segmentado" role="group" aria-label="Ordenar times">
          <button type="button" aria-pressed={ordem === 'taxa'} onClick={() => setOrdem('taxa')}>Vitórias</button>
          <button type="button" aria-pressed={ordem === 'partidas'} onClick={() => setOrdem('partidas')}>Mapas</button>
        </span>
      </div>
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead><tr><th>#</th><th>Time</th><th className="n">Mapas</th><th className="n">V</th><th className="n">D</th><th className="n">Vitórias</th><th style={{ width: '30%' }} /></tr></thead>
          <tbody>{xs.map((t, i) => (
            <tr key={t.id}>
              <td className="mono apagado">{i + 1}</td><td><LinkTime id={t.id} nome={t.nome} /></td>
              <td className="n">{t.partidas}</td><td className="n">{t.vitorias}</td><td className="n">{t.derrotas}</td><td className="n"><b>{pct(t.taxa_vitoria_pct, 0)}</b></td>
              <td><span className="barra"><span style={{ width: `${t.taxa_vitoria_pct ?? 0}%` }} /></span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <span className="apagado" style={{ fontSize: 12 }}>Times com 3 mapas ou mais no recorte.</span>
    </section>
  );
}
