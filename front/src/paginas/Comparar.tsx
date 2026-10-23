/** 08 · Comparador de jogadores: dois jogadores lado a lado, vermelho (A) contra azul (B), com a arte do agente principal. */
import { useMemo, useState, type CSSProperties } from 'react';
import { dados } from '../api/stats';
import { useDados } from '../api/useDados';
import type { JogadorDetalhe, RankingItem } from '../api/tipos';
import { useCatalogo } from '../componentes/Catalogo';
import { Agente, Carregando, CorpoAgente, ErroDados, SeloTime } from '../componentes/Visuais';
import { useCoach } from '../coach/Coach';
import { Link, useParametro } from '../rotas';
import { COR_AGENTE } from '../util/arteAgentes';
import { dec, nomeTime, pct, slugAgente } from '../util/formato';

const MIN_MAPAS = 8;
type Linha = { nome: string; v: (j: JogadorDetalhe) => number | null; r: (r: RankingItem) => number | null; f: (v: number | null) => string; menorMelhor?: boolean };
const LINHAS: Linha[] = [
  { nome: 'ACS', v: (j) => j.resumo.acs ?? null, r: (r) => r.acs ?? null, f: (v) => dec(v, 0) },
  { nome: 'K/D', v: (j) => j.resumo.kd, r: (r) => r.kd, f: (v) => dec(v, 2) },
  { nome: 'ADR', v: (j) => j.resumo.adr, r: (r) => r.adr, f: (v) => dec(v, 0) },
  { nome: 'KAST', v: (j) => j.resumo.kast_pct ?? null, r: (r) => r.kast_pct ?? null, f: (v) => pct(v, 0) },
  { nome: 'HS%', v: (j) => j.resumo.hs_pct, r: (r) => r.hs_pct, f: (v) => pct(v, 1) },
  { nome: 'First bloods por mapa', v: (j) => (j.resumo.partidas ? j.resumo.first_bloods / j.resumo.partidas : null), r: (r) => (r.partidas ? r.first_bloods / r.partidas : null), f: (v) => dec(v, 1) },
  { nome: 'Vitórias', v: (j) => j.resumo.taxa_vitoria_pct ?? null, r: (r) => r.taxa_vitoria_pct ?? null, f: (v) => pct(v, 0) },
];

export function Comparar() {
  const [a, setA] = useParametro('a');
  const [b, setB] = useParametro('b');
  const rank = useDados('ranking:completo', () => dados.rankingCompleto());
  const ja = useDados(a ? `jogador:${a}:` : null, () => dados.jogador(a ?? ''));
  const jb = useDados(b ? `jogador:${b}:` : null, () => dados.jogador(b ?? ''));
  const { abrir } = useCoach();
  const A = ja.dados?.data ?? null, B = jb.dados?.data ?? null;

  const pool = useMemo(() => (rank.dados?.data ?? []).filter((r) => r.partidas >= MIN_MAPAS), [rank.dados]);
  const linhas = LINHAS.map((l) => {
    const vs = pool.map(l.r).filter((v): v is number => v !== null);
    const media = vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null;
    const max = Math.max(...vs, A ? l.v(A) ?? 0 : 0, B ? l.v(B) ?? 0 : 0) || 1;
    const va = A ? l.v(A) : null, vb = B ? l.v(B) : null;
    const ganha = va === null || vb === null || va === vb ? null : (va > vb) !== !!l.menorMelhor ? 'a' : 'b';
    return { ...l, media, max, va, vb, ganha };
  });
  const placar = { a: linhas.filter((l) => l.ganha === 'a').length, b: linhas.filter((l) => l.ganha === 'b').length };
  const trocar = () => { const x = a; setA(b); setB(x); };

  return (
    <main className="pagina comparar">
      <div className="cabeca" style={{ alignItems: 'center', textAlign: 'center' }}>
        <span className="rotulo rotulo--vermelho">ESTATÍSTICAS · COMPARAR</span>
        <h1 className="titulo-xl">Comparador</h1>
      </div>

      <div className="comparar__escolha">
        <EscolherJogador lado="a" valor={a} nome={A?.nome} aoEscolher={setA} lista={rank.dados?.data} />
        <button type="button" className="botao-redondo" onClick={trocar} aria-label="Trocar os lados" disabled={!a && !b}>⇄</button>
        <EscolherJogador lado="b" valor={b} nome={B?.nome} aoEscolher={setB} lista={rank.dados?.data} />
      </div>

      {!!(ja.erro || jb.erro) && <ErroDados erro={ja.erro ?? jb.erro} recarregar={ja.erro ? ja.recarregar : jb.recarregar} />}

      <section className="duelo">
        <LadoDuelo lado="a" j={A} carregando={!!a && !A} />
        <div className="duelo__vs">
          <span className="num">VS</span>
          {A && B && <span className="mono">VENCE EM<br /><b className="cor-a">{placar.a}</b> × <b className="cor-b">{placar.b}</b></span>}
        </div>
        <LadoDuelo lado="b" j={B} carregando={!!b && !B} />
      </section>

      {A && B ? (
        <>
          <section className="cartao comparar__metricas">
            <div className="secao-topo"><span className="titulo-m">Cara a cara</span><span className="apagado mono" style={{ fontSize: 10 }}>MESMO RECORTE PARA OS DOIS · MARCA = MÉDIA DE QUEM TEM {MIN_MAPAS}+ MAPAS</span></div>
            {linhas.map((l) => (
              <div key={l.nome} className="espelho-linha">
                <b className={`num espelho-linha__v${l.ganha === 'a' ? ' cor-a' : ' apagado'}`}>{l.f(l.va)}</b>
                <span className="espelho-linha__trilho espelho-linha__trilho--a">
                  <span style={{ width: `${(100 * (l.va ?? 0)) / l.max}%`, opacity: l.ganha === 'a' ? 1 : 0.45 }} />
                  {l.media !== null && <i style={{ right: `${(100 * l.media) / l.max}%` }} />}
                </span>
                <span className="espelho-linha__nome"><b>{l.nome}</b><span className="mono apagado">MÉDIA {l.f(l.media)}</span></span>
                <span className="espelho-linha__trilho espelho-linha__trilho--b">
                  <span style={{ width: `${(100 * (l.vb ?? 0)) / l.max}%`, opacity: l.ganha === 'b' ? 1 : 0.45 }} />
                  {l.media !== null && <i style={{ left: `${(100 * l.media) / l.max}%` }} />}
                </span>
                <b className={`num espelho-linha__v espelho-linha__v--b${l.ganha === 'b' ? ' cor-b' : ' apagado'}`}>{l.f(l.vb)}</b>
              </div>
            ))}
          </section>

          <div className="grade grade-2">
            <section className="cartao">
              <span className="titulo-s">Agentes</span>
              <div className="comparar__agentes">
                {[A, B].map((j, i) => (
                  <div key={j.id} className="comparar__coluna">
                    <span className={`rotulo ${i === 0 ? 'cor-a' : 'cor-b'}`}>{j.nome.toUpperCase()}</span>
                    {j.agentes.slice(0, 4).map((ag) => (
                      <span key={ag.agente_id} className="comparar__agente">
                        <Agente id={ag.agente_id} tamanho="g" mostrarNome />
                        <span className="mono apagado">{ag.partidas} MAPAS · {pct(ag.taxa_vitoria_pct, 0)}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </section>
            <MapasLadoALado A={A} B={B} />
          </div>

          <button type="button" className="cartao cartao--ia cartao--link comparar__ia" onClick={() => abrir(`Compare ${A.nome} com ${B.nome}: quem rende mais e em quê?`)}>
            <span className="rotulo rotulo--vermelho">TROPA AI</span>
            <b style={{ fontSize: 18 }}>“Quem rende mais, {A.nome} ou {B.nome}, e em quê?”</b>
          </button>
        </>
      ) : !rank.dados ? <Carregando altura={260} /> : (
        <Sugestoes pool={pool} a={a} b={b} setA={setA} setB={setB} />
      )}
    </main>
  );
}

function LadoDuelo({ lado, j, carregando }: { lado: 'a' | 'b'; j: JogadorDetalhe | null; carregando: boolean }) {
  const { agente } = useCatalogo();
  const principal = j?.agentes[0]?.agente_id;
  const cor = principal ? COR_AGENTE[slugAgente(agente(principal))] : undefined;
  return (
    <div className={`duelo__lado duelo__lado--${lado}`} style={{ '--cor-agente': cor ?? 'var(--trilho)' } as CSSProperties}>
      {j ? (
        <>
          <CorpoAgente id={principal} className="duelo__corpo" />
          <span className="duelo__time">{j.times[0] && <><SeloTime nome={j.times[0].nome} tamanho="p" /><span>{nomeTime(j.times[0].nome)}</span></>}</span>
          <Link para={`/jogadores/${encodeURIComponent(j.id)}`} className="duelo__nome" style={{ fontSize: `clamp(22px, ${Math.min(6, 54 / Math.max(j.nome.length, 1))}vw, 88px)` }}>{j.nome}</Link>
          <span className="mono duelo__sub">{principal ? `MAIS JOGA DE ${agente(principal).toUpperCase()} · ` : ''}{j.resumo.partidas} MAPAS</span>
        </>
      ) : carregando ? <span className="apagado">Carregando…</span> : (
        <span className="duelo__vazio"><b className="titulo-s">Jogador {lado.toUpperCase()}</b><span className="apagado">Escolha alguém no campo acima.</span></span>
      )}
    </div>
  );
}

function MapasLadoALado({ A, B }: { A: JogadorDetalhe; B: JogadorDetalhe }) {
  const { mapa } = useCatalogo();
  const ids = [...new Set([...A.mapas.map((m) => m.mapa_id), ...B.mapas.map((m) => m.mapa_id)])];
  const de = (j: JogadorDetalhe, id: string) => j.mapas.find((m) => m.mapa_id === id);
  const linhas = ids.map((id) => ({ id, a: de(A, id), b: de(B, id) }))
    .sort((x, y) => ((y.a?.partidas ?? 0) + (y.b?.partidas ?? 0)) - ((x.a?.partidas ?? 0) + (x.b?.partidas ?? 0))).slice(0, 7);
  const v = (m?: { acs?: number | null; taxa_vitoria_pct: number | null }) => (m ? (m.acs != null ? dec(m.acs, 0) : pct(m.taxa_vitoria_pct, 0)) : '—');
  const usaAcs = A.mapas.some((m) => m.acs != null);
  return (
    <section className="cartao">
      <div className="secao-topo"><span className="titulo-s">{usaAcs ? 'ACS por mapa' : 'Vitória por mapa'}</span><span className="apagado mono" style={{ fontSize: 10 }}>— = NÃO JOGOU</span></div>
      <div className="comparar__mapas">
        {linhas.map((l) => (
          <Link key={l.id} para={`/mapas/${encodeURIComponent(l.id)}`} className="comparar__mapa">
            <b className="num cor-a">{v(l.a)}</b><span>{mapa(l.id)}</span><b className="num cor-b">{v(l.b)}</b>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Sugestoes({ pool, a, b, setA, setB }: { pool: RankingItem[]; a: string | null; b: string | null; setA: (v: string) => void; setB: (v: string) => void }) {
  const top = [...pool].sort((x, y) => (y.acs ?? 0) - (x.acs ?? 0)).filter((r) => r.jogador_id !== a && r.jogador_id !== b).slice(0, 8);
  return (
    <section className="cartao comparar__sugestoes">
      <span className="titulo-s">Comece por quem está jogando muito</span>
      <span className="apagado">Toque para colocar no lado que estiver vazio.</span>
      <div className="comparar__chips">
        {top.map((r) => (
          <button key={r.jogador_id} type="button" className="pill" onClick={() => (a ? setB(r.jogador_id) : setA(r.jogador_id))}>
            <Agente id={r.agentes_top?.[0]} tamanho="p" />{r.nome}<span className="pill__n">{dec(r.acs ?? null, 0)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Campo com busca própria (sem o menu do navegador): digita, aparece a lista, escolhe. */
function EscolherJogador({ lado, valor, nome, aoEscolher, lista }: { lado: 'a' | 'b'; valor: string | null; nome?: string; aoEscolher: (v: string | null) => void; lista?: RankingItem[] }) {
  const [q, setQ] = useState('');
  const [aberto, setAberto] = useState(false);
  const t = q.trim().toLowerCase();
  const achados = t ? (lista ?? []).filter((r) => r.nome.toLowerCase().includes(t)).sort((x, y) => y.partidas - x.partidas).slice(0, 8) : [];
  return (
    <div className={`escolher escolher--${lado}`}>
      <label className="campo-busca">
        <span className={`mono ${lado === 'a' ? 'cor-a' : 'cor-b'}`}>{lado.toUpperCase()}</span>
        <span className="so-leitor">Jogador {lado.toUpperCase()}</span>
        <input value={aberto ? q : nome ?? q} placeholder={valor ? 'Carregando…' : 'Buscar jogador'} role="combobox" aria-expanded={aberto && achados.length > 0}
          onFocus={() => { setAberto(true); setQ(''); }} onBlur={() => setTimeout(() => setAberto(false), 150)} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && achados[0]) { aoEscolher(achados[0].jogador_id); setAberto(false); (e.target as HTMLInputElement).blur(); } }} />
        {valor && <button type="button" className="escolher__limpar" aria-label={`Tirar o jogador ${lado.toUpperCase()}`} onClick={() => aoEscolher(null)}>✕</button>}
      </label>
      {aberto && achados.length > 0 && (
        <ul className="seletor__lista escolher__lista" role="listbox">
          {achados.map((r) => (
            <li key={r.jogador_id} role="option" aria-selected={r.jogador_id === valor}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { aoEscolher(r.jogador_id); setAberto(false); }}>
                <Agente id={r.agentes_top?.[0]} tamanho="p" /><b>{r.nome}</b><span className="mono apagado">{r.partidas} MAPAS</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
