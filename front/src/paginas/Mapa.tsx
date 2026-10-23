/** 09 · Mapa: banner com a arte, lado forte, sites, agentes que mais vencem, composição e times que mandam nele. */
import type { CSSProperties } from 'react';
import { dados } from '../api/stats';
import { useDados } from '../api/useDados';
import { useCatalogo } from '../componentes/Catalogo';
import { BotaoPrancheta } from '../componentes/Prancheta';
import { Agente, Carregando, ErroDados, estiloTime, FonteDados, SeloTime, Vazio } from '../componentes/Visuais';
import { BarrasMedia } from '../graficos/Graficos';
import { Figura } from '../graficos/Figura';
import { useCoach, useContextoCoach } from '../coach/Coach';
import { Link, useParametro } from '../rotas';
import { COR_AGENTE } from '../util/arteAgentes';
import { COMPRAS, dec, nomeTime, num, pct, slugAgente } from '../util/formato';

// Artes de banner que existem em public/arte/prancheta/banners (as mesmas da prancheta).
const BANNERS = ['abyss', 'ascent', 'bind', 'breeze', 'corrode', 'fracture', 'haven', 'icebox', 'lotus', 'pearl', 'split', 'summit', 'sunset'];
const MIN_PICKS = 4;
// vitória ajustada à amostra (Laplace): 3 de 3 não passa na frente de 7 de 8
const forca = (t: { vitorias: number; partidas: number }) => (t.vitorias + 1) / (t.partidas + 2);

export function Mapa({ id }: { id: string }) {
  const [torneio] = useParametro('torneio');
  const f = { mapa_id: id, torneio_id: torneio ?? undefined };
  const m = useDados(`meta:${torneio ?? ''}:${id}`, () => dados.metaCena(f));
  const ts = useDados(`times:100:${torneio ?? ''}:${id}`, () => dados.times({ ...f, page_size: 100 }));
  const ser = useDados(`series:mapa:${id}`, () => dados.series({ mapa_id: id }));
  const { mapa, agente, classe } = useCatalogo();
  const { abrir } = useCoach();
  const nome = mapa(id);
  const slug = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  useContextoCoach({
    tipo: 'mapa', id, rotulo: nome,
    sugestoes: [
      { t: 'COMPOSIÇÃO', q: `Qual composição mais vence no ${nome}?` },
      { t: 'LADO', q: `O ${nome} favorece ataque ou defesa? Por quê?` },
      { t: 'SITES', q: `Em qual site do ${nome} o ataque mais converte depois do plant?` },
      { t: 'TIMES', q: `Quais times jogam melhor o ${nome}?` },
    ],
  });

  if (m.erro) return <main className="pagina"><ErroDados erro={m.erro} recarregar={m.recarregar} /></main>;
  const d = m.dados;
  const info = d?.mapas.find((x) => x.mapa_id === id) ?? d?.mapas[0];
  const ultimo = ser.dados?.flatMap((s) => s.mapas).find((x) => x.mapa_id === id);

  const banner = BANNERS.includes(slug) ? `/arte/prancheta/banners/${slug}.webp` : null;
  return (
    <main className="pagina pagina--mapa">
      <Link para="/meta" className="voltar mono">← META</Link>
      <section className={`mapa-heroi${banner ? '' : ' mapa-heroi--sem-arte'}`} style={banner ? { backgroundImage: `linear-gradient(90deg, rgba(15,25,35,.95) 0%, rgba(15,25,35,.62) 45%, rgba(15,25,35,.12) 100%), url(${banner})` } : undefined}>
        <span className="rotulo rotulo--menta">MAPA{info ? ` · ${Object.keys(info.plants).length || 2} SITES` : ''}</span>
        <h1 className="mapa-heroi__nome">{nome}</h1>
        {info ? (
          <div className="mapa-heroi__kpis">
            <span><b className="num">{info.partidas}</b><span className="rotulo">MAPAS JOGADOS</span></span>
            <span><b className="num">{pct(info.ataque_pct, 0)}</b><span className="rotulo">ATAQUE VENCE</span></span>
            <span><b className="num">{info.prorrogacoes}</b><span className="rotulo">PRORROGAÇÕES</span></span>
            <span><b className="num">{info.partidas ? dec(info.rounds / info.partidas, 1) : '—'}</b><span className="rotulo">ROUNDS POR MAPA</span></span>
            {ultimo && <BotaoPrancheta partidaId={ultimo.partida_id} texto="Abrir na prancheta" rotulo={`Abrir o último ${nome} na prancheta`} />}
          </div>
        ) : <Carregando altura={60} />}
      </section>

      {!d ? <Carregando altura={240} linhas={2} /> : !info ? <Vazio titulo="Esse mapa não aparece no recorte">Tire o filtro de torneio.</Vazio> : (
        <>
          <div className="grade grade-2">
            <section className="cartao">
              <span className="titulo-s">Lado forte</span>
              <div className="lados-barra" title={`Ataque vence ${pct(info.ataque_pct)} dos rounds`}>
                <span style={{ width: `${info.ataque_pct ?? 50}%`, background: 'var(--time-a)' }}><b>ATAQUE {pct(info.ataque_pct, 0)}</b></span>
                <span style={{ flex: 1, background: 'var(--time-b)' }}><b>DEFESA {pct(info.ataque_pct === null ? null : 100 - info.ataque_pct, 0)}</b></span>
              </div>
              <Sites plants={info.plants} />
              <span className="apagado" style={{ fontSize: 12 }}>
                {(info.ataque_pct ?? 50) >= 52 ? 'Mapa de ataque: quem começa atacando sai na frente.' : (info.ataque_pct ?? 50) <= 48 ? 'Mapa de defesa: segurar o primeiro half vale ouro.' : 'Mapa equilibrado entre os lados.'}
              </span>
            </section>

            <section className="cartao">
              <div className="secao-topo"><span className="titulo-s">Agentes que mais vencem</span><span className="apagado mono" style={{ fontSize: 10 }}>MÍNIMO DE {MIN_PICKS} PICKS</span></div>
              <div className="mapa-agentes">
                {[...d.agentes].filter((a) => a.aparicoes >= MIN_PICKS).sort((a, b) => (b.taxa_vitoria_pct ?? 0) - (a.taxa_vitoria_pct ?? 0)).slice(0, 6).map((a) => (
                  <Link key={a.agente_id} para={`/estatisticas?agente=${encodeURIComponent(a.agente_id)}&mapa=${encodeURIComponent(id)}`} className="mapa-agente"
                    style={{ '--cor-agente': COR_AGENTE[slugAgente(agente(a.agente_id))] ?? 'var(--trilho)' } as CSSProperties}>
                    <Agente id={a.agente_id} tamanho="g" />
                    <b className="mapa-agente__nome">{agente(a.agente_id)}</b>
                    <span className="mono apagado" style={{ fontSize: 10 }}>{(classe(a.agente_id) ?? '').toUpperCase()}</span>
                    <span className="mapa-agente__nums"><span>VIT <b>{pct(a.taxa_vitoria_pct, 0)}</b></span><span className="apagado">PICK {pct(a.pick_pct, 0)}</span></span>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <div className="grade grade-2">
            <section className="cartao">
              <span className="titulo-s">Composições que mais vencem</span>
              {[...d.composicoes].filter((c) => c.mapa_id === id && c.aparicoes >= 2).sort((a, b) => (b.taxa_vitoria_pct ?? 0) - (a.taxa_vitoria_pct ?? 0) || b.aparicoes - a.aparicoes).slice(0, 3).map((c, i) => (
                <div key={c.composicao_id} className={`mapa-comp${i === 0 ? ' mapa-comp--top' : ''}`}>
                  <span className="mapa-comp__agentes">{c.agente_ids.map((a) => <Agente key={a} id={a} tamanho={i === 0 ? 'g' : 'm'} />)}</span>
                  <span className="mapa-comp__v"><b className="num">{pct(c.taxa_vitoria_pct, 0)}</b><span className="mono apagado">{c.aparicoes} VEZES</span></span>
                </div>
              ))}
              {!d.composicoes.some((c) => c.mapa_id === id && c.aparicoes >= 2) && <span className="apagado">Nenhuma composição se repetiu nesse recorte.</span>}
            </section>

            <section className="cartao">
              <span className="titulo-s">Quem manda no {nome}</span>
              {ts.erro ? <ErroDados erro={ts.erro} /> : !ts.dados ? <Carregando altura={40} linhas={4} /> : (
                <ol className="lista-rank">
                  {[...ts.dados.data].filter((t) => t.partidas >= 2).sort((a, b) => forca(b) - forca(a) || b.partidas - a.partidas).slice(0, 5).map((t, i) => (
                    <li key={t.id} style={estiloTime(t.nome)}>
                      <span className="num lista-rank__pos">{i + 1}</span>
                      <SeloTime nome={t.nome} />
                      <Link para={`/times/${encodeURIComponent(t.id)}?mapa=${encodeURIComponent(id)}`} className="lista-rank__nome"><b>{nomeTime(t.nome)}</b><span className="apagado">{t.vitorias} de {t.partidas} mapas</span></Link>
                      <b className="num lista-rank__v cor-time">{pct(t.taxa_vitoria_pct, 0)}</b>
                    </li>
                  ))}
                </ol>
              )}
              <span className="apagado" style={{ fontSize: 12 }}>Ordenado pela vitória ajustada à amostra: quem venceu mais vezes aparece na frente de quem jogou só 2.</span>
            </section>
          </div>

          <Figura titulo={`Vitória por tipo de compra no ${nome}`} fonte="EQUIPAMENTO SOMADO DOS CINCO NO ROUND"
            tabela={{ colunas: ['Compra', 'Vitória', 'Rounds'], linhas: d.economia.map((e) => [COMPRAS[e.tipo], pct(e.taxa_vitoria_pct), num(e.rounds)]) }}>
            <BarrasMedia linhas={d.economia.map((e) => ({ rotulo: COMPRAS[e.tipo], valor: e.taxa_vitoria_pct, detalhe: `${num(e.rounds)} rounds` }))} />
          </Figura>

          <button type="button" className="cartao cartao--ia cartao--link" style={{ textAlign: 'left', color: 'var(--giz)' }} onClick={() => abrir(`Qual composição mais vence no ${nome} e por quê?`)}>
            <span className="rotulo rotulo--vermelho">TROPA AI</span>
            <b style={{ fontSize: 17 }}>“Qual composição mais vence no {nome} e por quê?”</b>
          </button>
        </>
      )}
      <FonteDados meta={ts.dados?.meta} />
    </main>
  );
}

function Sites({ plants }: { plants: Record<string, number> }) {
  const xs = Object.entries(plants).sort();
  const total = xs.reduce((s, [, n]) => s + n, 0);
  if (!total) return null;
  return (
    <div className="sites">
      <span className="rotulo">PLANTS POR SITE</span>
      {xs.map(([s, n]) => (
        <div key={s} className="linha-barra"><span className="mono">{s}</span><span className="barra"><span style={{ width: `${(100 * n) / total}%`, background: 'var(--giz-2)' }} /></span><b className="num">{pct((100 * n) / total, 0)}</b></div>
      ))}
    </div>
  );
}
