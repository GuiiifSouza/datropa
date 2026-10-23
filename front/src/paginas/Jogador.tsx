/** 05 · Jogador: números com a posição na cena, agentes, mapas, multikills e partidas recentes. */
import { useCallback, useMemo, useState } from 'react';
import { StoryJogador, type DadosStory } from '../componentes/Story';
import { dados } from '../api/stats';
import { useDados } from '../api/useDados';
import type { RankingItem } from '../api/tipos';
import { useCatalogo } from '../componentes/Catalogo';
import { BotaoPrancheta } from '../componentes/Prancheta';
import { Agente, Carregando, CorpoAgente, ErroDados, FonteDados, LinkTime } from '../componentes/Visuais';
import { COR_AGENTE } from '../util/arteAgentes';
import type { CSSProperties } from 'react';
import { Colunas } from '../graficos/Graficos';
import { Figura } from '../graficos/Figura';
import { useCoach, useContextoCoach } from '../coach/Coach';
import { Contador } from '../componentes/Vida';
import { Link, useParametro } from '../rotas';
import { dec, diaBrasilia, diaNumerico, nomeTime, pct, slugAgente } from '../util/formato';

const MIN_MAPAS = 8;
type Metrica = { chave: keyof RankingItem; rotulo: string; formato: (v: number | null) => string; ajuda: string };
const METRICAS: Metrica[] = [
  { chave: 'acs', rotulo: 'ACS', formato: (v) => dec(v, 0), ajuda: 'Pontuação de combate por round' },
  { chave: 'kd', rotulo: 'K/D', formato: (v) => dec(v, 2), ajuda: 'Abates por morte' },
  { chave: 'adr', rotulo: 'ADR', formato: (v) => dec(v, 0), ajuda: 'Dano em adversários por round' },
  { chave: 'kast_pct', rotulo: 'KAST', formato: (v) => pct(v, 0), ajuda: 'Rounds com abate, assistência, sobrevivência ou troca (estimado)' },
  { chave: 'hs_pct', rotulo: 'HS%', formato: (v) => pct(v, 1), ajuda: 'Tiros na cabeça entre os tiros que acertaram' },
  { chave: 'first_bloods', rotulo: 'First bloods', formato: (v) => (v === null ? '—' : Number.isInteger(v) ? String(v) : dec(v, 1)), ajuda: 'Primeiro abate do round' },
];

export function Jogador({ id }: { id: string }) {
  const [agenteSel, setAgente] = useParametro('agente');
  const j = useDados(`jogador:${id}:${agenteSel ?? ''}`, () => dados.jogador(id, agenteSel ? { agente_id: agenteSel } : {}));
  const base = useDados(`jogador:${id}:`, () => dados.jogador(id));
  const rank = useDados('ranking:completo', () => dados.rankingCompleto());
  const { mapa, agente } = useCatalogo();
  const { abrir } = useCoach();
  const d = j.dados?.data;
  useContextoCoach(d ? {
    tipo: 'jogador', id, rotulo: d.nome,
    sugestoes: [
      { t: 'RESUMO', q: `Como está jogando o ${d.nome}?` },
      { t: 'AGENTES', q: `Em qual agente o ${d.nome} rende mais?` },
      { t: 'MAPAS', q: `Em quais mapas o ${d.nome} vai melhor e pior?` },
      { t: 'COMPARAR', q: `Compare o ${d.nome} com os melhores da mesma função.` },
    ],
  } : null);

  const posicoes = useMemo(() => {
    const pool = (rank.dados?.data ?? []).filter((r) => r.partidas >= MIN_MAPAS);
    const out = new Map<string, { pos: number; de: number; pctil: number }>();
    for (const m of METRICAS) {
      const vals = pool.map((r) => r[m.chave] as number | null).filter((v): v is number => v !== null).sort((a, b) => b - a);
      const meu = (rank.dados?.data ?? []).find((r) => r.jogador_id === id)?.[m.chave] as number | null | undefined;
      if (meu == null || !vals.length) continue;
      const pos = vals.filter((v) => v > meu).length + 1;
      out.set(m.chave, { pos, de: vals.length, pctil: 100 * (1 - (pos - 1) / vals.length) });
    }
    return out;
  }, [rank.dados, id]);
  const medias = useMemo(() => {
    const pool = (rank.dados?.data ?? []).filter((r) => r.partidas >= MIN_MAPAS);
    const m = new Map<string, number>();
    for (const x of METRICAS) {
      const vs = pool.map((r) => r[x.chave] as number | null).filter((v): v is number => v !== null);
      if (vs.length) m.set(x.chave, vs.reduce((a, b) => a + b, 0) / vs.length);
    }
    return m;
  }, [rank.dados]);

  const [story, setStory] = useState(false);
  const fecharStory = useCallback(() => setStory(false), []);
  const dadosStory = useMemo<DadosStory | null>(() => {
    const dd = base.dados?.data;
    if (!dd) return null;
    const pos = (k: string) => { const x = posicoes.get(k); return x ? `${x.pos}º de ${x.de}` : undefined; };
    const rr = dd.resumo;
    return {
      nome: dd.nome, time: dd.times[0] ? nomeTime(dd.times[0].nome) : null, agente: dd.agentes[0] ? agente(dd.agentes[0].agente_id) : null,
      mapas: rr.partidas, vitoriaPct: rr.taxa_vitoria_pct ?? null,
      numeros: [
        { v: dec(rr.acs ?? null, 0), l: 'ACS', pos: pos('acs') },
        { v: dec(rr.kd, 2), l: 'K/D', pos: pos('kd') },
        { v: String(rr.first_bloods), l: 'First bloods', pos: pos('first_bloods') },
      ],
    };
  }, [base.dados, posicoes, agente]);

  if (j.erro) return <main className="pagina"><ErroDados erro={j.erro} recarregar={j.recarregar} /></main>;
  if (!d) return <main className="pagina"><Carregando altura={200} /><Carregando altura={200} linhas={2} /></main>;
  const r = d.resumo;
  const principal = (base.dados?.data.agentes ?? d.agentes)[0]?.agente_id;
  const recentes = d.partidas_recentes ?? [];

  return (
    <main className="pagina">
      <Link para="/estatisticas" className="voltar mono">← ESTATÍSTICAS</Link>
      <section className="perfil perfil--jogador" style={{ '--cor-agente': COR_AGENTE[slugAgente(agente(principal))] ?? 'var(--trilho)' } as CSSProperties}>
        <CorpoAgente id={principal} className="perfil__corpo" />
        <Agente id={principal} tamanho="g" />
        <div className="cabeca" style={{ flex: '1 1 320px' }}>
          <span className="rotulo rotulo--ambar">{d.times.map((t) => nomeTime(t.nome)).join(' · ').toUpperCase()}{principal ? ` · MAIS JOGA DE ${agente(principal).toUpperCase()}` : ''}</span>
          <h1 className="titulo-xl" style={{ fontSize: 'clamp(48px, 7vw, 84px)' }}>{d.nome}{d.tag && <span className="apagado" style={{ fontSize: '0.4em', marginLeft: 8 }}>#{d.tag}</span>}</h1>
          <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{d.times.map((t, i) => <LinkTime key={t.id} id={t.id} nome={t.nome} lado={i === 0 ? 'a' : 'b'} />)}</span>
          <span className="perfil__acoes">
            <Link para={`/comparar?a=${encodeURIComponent(id)}`} className="botao botao--linha botao--pequeno">⇄ Comparar</Link>
            <button type="button" className="botao botao--ia botao--pequeno" onClick={() => setStory(true)} disabled={!dadosStory}>Compartilhar</button>
          </span>
        </div>
        <div className="perfil__numeros">
          <div><b className="num">{r.partidas}</b><span className="rotulo">MAPAS</span></div>
          <div><b className="num cor-a">{pct(r.taxa_vitoria_pct ?? null, 0)}</b><span className="rotulo">VITÓRIAS</span></div>
          <div><b className="num">{r.kills}<span className="apagado-2">/</span>{r.deaths}<span className="apagado-2">/</span>{r.assists}</b><span className="rotulo">K / D / A</span></div>
        </div>
      </section>

      {(base.dados?.data.agentes.length ?? 0) > 1 && (
        <div className="pills" role="toolbar" aria-label="Filtrar por agente">
          <button type="button" className="pill" aria-pressed={!agenteSel} onClick={() => setAgente(null)}>Todos os agentes</button>
          {base.dados!.data.agentes.map((a) => <button key={a.agente_id} type="button" className="pill" aria-pressed={agenteSel === a.agente_id} onClick={() => setAgente(a.agente_id)}><Agente id={a.agente_id} tamanho="p" />{agente(a.agente_id)}<span className="pill__n">{a.partidas}</span></button>)}
        </div>
      )}

      <section className="grade grade-6">
        {METRICAS.map((m) => {
          const v = r[m.chave as keyof typeof r] as number | null | undefined;
          const p = !agenteSel ? posicoes.get(m.chave) : undefined;
          const media = medias.get(m.chave);
          return (
            <div key={m.chave} className="metrica" title={m.ajuda}>
              <span className="rotulo">{m.rotulo}</span>
              <b className="num"><Contador valor={v ?? null} formato={m.formato} /></b>
              {p ? <span className="metrica__pos"><b>{p.pos}º</b> de {p.de}</span> : <span className="metrica__pos apagado">{r.partidas < MIN_MAPAS ? `menos de ${MIN_MAPAS} mapas` : agenteSel ? 'no agente' : ''}</span>}
              <span className="metrica__barra" aria-hidden="true"><span style={{ width: `${p?.pctil ?? 0}%` }} />{media !== undefined && <i />}</span>
              {media !== undefined && <span className="apagado" style={{ fontSize: 11 }}>média {m.formato(media)}</span>}
            </div>
          );
        })}
      </section>
      <span className="apagado" style={{ fontSize: 12, marginTop: -14 }}>Posição entre os {posicoes.get('acs')?.de ?? '…'} jogadores com {MIN_MAPAS} mapas ou mais. KAST é estimado pela base (troca em até 5 s).</span>

      <div className="dupla">
        <div className="dupla__principal">
          <section className="cartao">
            <span className="titulo-s">Agentes</span>
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead><tr><th>Agente</th><th className="n">Mapas</th><th className="n">Vitórias</th><th className="n">K/D</th><th className="n">ACS</th></tr></thead>
                <tbody>{d.agentes.map((a) => (
                  <tr key={a.agente_id}><td><Agente id={a.agente_id} tamanho="p" mostrarNome /></td><td className="n">{a.partidas}</td><td className="n">{pct(a.taxa_vitoria_pct, 0)}</td><td className="n">{dec(a.kd ?? null, 2)}</td><td className="n"><b>{dec(a.acs ?? null, 0)}</b></td></tr>
                ))}</tbody>
              </table>
            </div>
          </section>
          <Figura titulo="Vitórias por mapa" fonte="LINHA = 50%" tabela={{ colunas: ['Mapa', 'Vitórias', 'Mapas', 'ACS'], linhas: d.mapas.map((m) => [mapa(m.mapa_id), pct(m.taxa_vitoria_pct), m.partidas, dec(m.acs ?? null, 0)]) }}>
            <Colunas itens={d.mapas.map((m) => ({ rotulo: mapa(m.mapa_id), valor: m.taxa_vitoria_pct, detalhe: `${m.vitorias} de ${m.partidas} · ACS ${dec(m.acs ?? null, 0)}` }))} linhaRef={50} rotuloRef="50%" />
          </Figura>
          <section className="cartao">
            <span className="titulo-s">Partidas</span>
            {recentes.length ? (
              <div className="tabela-rolagem">
                <table className="tabela">
                  <thead><tr><th>Data</th><th>Mapa</th><th>Contra</th><th>Agente</th><th className="n">Placar</th><th className="n">K/D/A</th><th className="n">ACS</th><th /></tr></thead>
                  <tbody>{recentes.slice(0, 15).map((x) => (
                    <tr key={x.partida_id}>
                      <td className="mono apagado">{diaNumerico(diaBrasilia(x.inicio))}</td>
                      <td><Link para={`/partidas/${encodeURIComponent(x.partida_id)}`}><b>{mapa(x.mapa_id)}</b></Link></td>
                      <td>{x.adversario_id ? <AdvNome id={x.adversario_id} /> : '—'}</td>
                      <td><Agente id={x.agente_id} tamanho="p" /></td>
                      <td className="n"><b style={{ color: x.venceu ? 'var(--ambar)' : 'var(--apagado)' }}>{x.placar[0]}:{x.placar[1]}</b></td>
                      <td className="n">{x.kills}/{x.deaths}/{x.assists}</td>
                      <td className="n"><b>{dec(x.acs, 0)}</b></td>
                      <td><BotaoPrancheta partidaId={x.partida_id} texto="" rotulo={`Rever o ${mapa(x.mapa_id)} na prancheta`} /></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <span className="apagado">Sem partidas no recorte.</span>}
          </section>
        </div>
        <aside className="dupla__lateral">
          <section className="cartao">
            <span className="titulo-s">Multikills</span>
            <div className="grade" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {(['k3', 'k4', 'k5'] as const).map((k) => (
                <div key={k} className="cartao-mini" style={{ alignItems: 'center' }}><b className="num" style={{ fontSize: 34 }}>{r.multikills?.[k] ?? '—'}</b><span className="rotulo">{k.slice(1)}K</span></div>
              ))}
            </div>
            <span className="apagado" style={{ fontSize: 12 }}>Rounds com 3, 4 ou 5 abates do jogador. First deaths: {r.first_deaths ?? '—'}.</span>
          </section>
          <button type="button" className="cartao cartao--ia cartao--link" style={{ textAlign: 'left', color: 'var(--giz)' }} onClick={() => abrir(`Como está jogando o ${d.nome}? Pontos fortes e fracos.`)}>
            <span className="rotulo rotulo--vermelho">TROPA AI</span>
            <b style={{ fontSize: 17, lineHeight: 1.35 }}>“Quais os pontos fortes e fracos do {d.nome}?”</b>
            <span className="giz2" style={{ fontSize: 13 }}>Perguntar sobre este jogador ↗</span>
          </button>
        </aside>
      </div>
      {story && dadosStory && <StoryJogador dados={dadosStory} fechar={fecharStory} />}
      <FonteDados meta={j.dados?.meta} />
    </main>
  );
}

function AdvNome({ id }: { id: string }) {
  const { dados: t } = useDados(`times:100`, () => dados.times({ page_size: 100 }));
  const nome = t?.data.find((x) => x.id === id)?.nome;
  return <Link para={`/times/${encodeURIComponent(id)}`}>{nomeTime(nome ?? '…')}</Link>;
}
