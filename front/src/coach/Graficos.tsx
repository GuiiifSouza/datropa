/**
 * Gráficos das respostas da Tropa AI. O front monta o gráfico a partir do resultado das tools
 * (data.tools[].resultado), de forma determinística: o modelo só escolhe a tool, os números do gráfico
 * são os mesmos que ele citou. Sempre que houver número comparável, sai um gráfico.
 */
import type { ReactNode } from 'react';
import { Anel, BarrasEspelhadas, BarrasMedia, Colunas, LivroRounds, Momentum, type CelulaRound, type LinhaEspelho } from '../graficos/Graficos';
import { Figura } from '../graficos/Figura';
import { BotaoPrancheta, linkPrancheta } from '../componentes/Prancheta';
import { Link } from '../rotas';
import { COMPRAS, dec, nomeTime, pct } from '../util/formato';
import type { ToolChamada } from './cliente';
import type { Panorama } from '../api/tipos';

type Obj = Record<string, unknown>;
const ehObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);
const lista = (x: unknown): Obj[] => (Array.isArray(x) ? x.filter(ehObj) : []);
const n = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const s = (x: unknown): string => (typeof x === 'string' ? x : x == null ? '' : String(x));
const fonte = (t: ToolChamada) => `FONTE: ${t.nome}`;

const ROTULOS_COMPARACAO: [string, string, ((v: number | null) => string)?][] = [
  ['taxa_vitoria_pct', 'Vitórias'], ['taxa_rounds_pct', 'Rounds ganhos'], ['ataque_pct', 'Ataque'], ['defesa_pct', 'Defesa'],
  ['taxa_ataque_pct', 'Ataque'], ['taxa_defesa_pct', 'Defesa'], ['first_blood_pct', 'First blood'], ['pos_plant_pct', 'Pós-plant'],
  ['retake_pct', 'Retake'], ['kd_time', 'K/D do time', (v) => dec(v, 2)], ['adr_medio', 'ADR médio', (v) => dec(v, 0)],
];

function economia(t: ToolChamada, cena?: Panorama | null): ReactNode {
  const r = t.resultado as Obj;
  const cats = lista(r.por_categoria);
  if (!cats.length) return null;
  const media = new Map(cena?.economia.map((e) => [e.tipo as string, e.taxa_vitoria_pct]));
  const linhas = cats.map((c) => ({
    rotulo: COMPRAS[s(c.categoria)] ?? s(c.categoria), valor: n(c.taxa_vitoria_pct), media: media.get(s(c.categoria)) ?? null,
    detalhe: `${n(c.vitorias) ?? '?'} de ${n(c.rounds) ?? '?'} rounds`,
  }));
  const mapa = s((r.filtros as Obj | undefined)?.mapa);
  return (
    <Figura key={t.nome} titulo={`Vitória por tipo de compra${mapa ? ` · ${mapa}` : ''}`}
      legenda={[{ cor: 'var(--time-a)', rotulo: 'Time' }, ...(cena ? [{ cor: 'var(--giz)', rotulo: 'média geral', forma: 'traco' as const }] : [])]}
      tabela={{ colunas: ['Compra', 'Vitória', 'Média geral', 'Rounds'], linhas: linhas.map((l) => [l.rotulo, pct(l.valor), pct(l.media), l.detalhe]) }}
      fonte={`${n(r.rounds) ?? ''} ROUNDS · ${fonte(t)}`}>
      <BarrasMedia linhas={linhas} />
    </Figura>
  );
}

function posPlant(t: ToolChamada): ReactNode {
  const r = t.resultado as Obj;
  const g = r.geral as Obj | undefined;
  if (!g) return null;
  const pp = g.pos_plant as Obj | undefined, rt = g.retake as Obj | undefined;
  const mapas = lista(r.por_mapa).filter((m) => n((m.pos_plant as Obj | undefined)?.taxa_sucesso_pct) !== null);
  return (
    <Figura key={t.nome} titulo="Depois do plant" fonte={`MEDE O RESULTADO APÓS O PLANT, NÃO PROVA TENTATIVA DE RETAKE · ${fonte(t)}`}
      tabela={{ colunas: ['Recorte', 'Pós-plant', 'Retake'], linhas: [['Geral', pct(n(pp?.taxa_sucesso_pct)), pct(n(rt?.taxa_sucesso_pct))],
        ...mapas.map((m) => [s(m.mapa), pct(n((m.pos_plant as Obj).taxa_sucesso_pct)), pct(n((m.retake as Obj | undefined)?.taxa_sucesso_pct))])] }}>
      <div className="aneis">
        <Anel valor={n(pp?.taxa_sucesso_pct)} rotulo={`Pós-plant · ${n(pp?.vitorias) ?? 0} de ${n(pp?.oportunidades) ?? 0}`} />
        <Anel valor={n(rt?.taxa_sucesso_pct)} rotulo={`Defesa após plant · ${n(rt?.vitorias) ?? 0} de ${n(rt?.oportunidades) ?? 0}`} cor="var(--time-b)" />
      </div>
      {mapas.length > 1 && <BarrasMedia linhas={mapas.map((m) => ({ rotulo: s(m.mapa), valor: n((m.pos_plant as Obj).taxa_sucesso_pct) }))} />}
    </Figura>
  );
}

function comparar(t: ToolChamada): ReactNode {
  const r = t.resultado as Obj;
  const a = r.time_a as Obj | undefined, b = r.time_b as Obj | undefined;
  if (!a || !b) return null;
  const nomeA = nomeTime(s(a.time ?? a.nome ?? 'Time A')), nomeB = nomeTime(s(b.time ?? b.nome ?? 'Time B'));
  const linhas: LinhaEspelho[] = [];
  const vistos = new Set<string>();
  for (const [k, rot, f] of ROTULOS_COMPARACAO) {
    if (vistos.has(rot)) continue;
    const va = n(a[k]), vb = n(b[k]);
    if (va === null && vb === null) continue;
    vistos.add(rot);
    linhas.push({ rotulo: rot, a: va, b: vb, formato: f, max: f ? undefined : 100 });
  }
  const compras = (x: Obj) => lista(x.economia ?? x.taxa_por_compra);
  for (const c of compras(a)) {
    const cb = compras(b).find((y) => y.categoria === c.categoria);
    linhas.push({ rotulo: COMPRAS[s(c.categoria)] ?? s(c.categoria), a: n(c.taxa_vitoria_pct), b: n(cb?.taxa_vitoria_pct), max: 100 });
  }
  if (!linhas.length) return null;
  const diretos = r.confrontos_diretos as Obj | undefined;
  return (
    <Figura key={t.nome} titulo={`${nomeA} × ${nomeB}`} legenda={[{ cor: 'var(--time-a)', rotulo: nomeA }, { cor: 'var(--time-b)', rotulo: nomeB }]}
      tabela={{ colunas: ['Métrica', nomeA, nomeB], linhas: linhas.map((l) => [l.rotulo, (l.formato ?? pct)(l.a), (l.formato ?? pct)(l.b)]) }}
      fonte={`${diretos ? `${n(diretos.partidas) ?? 0} CONFRONTOS DIRETOS · ` : ''}${fonte(t)}`}>
      <BarrasEspelhadas linhas={linhas} nomeA={nomeA} nomeB={nomeB} />
    </Figura>
  );
}

function resumoPartida(t: ToolChamada): ReactNode {
  const r = t.resultado as Obj;
  const rounds = lista(r.rounds);
  const placar = r.placar as Obj | undefined;
  if (!rounds.length || !placar) return null;
  const [nomeA, nomeB] = Object.keys(placar);
  let a = 0, b = 0;
  const pontos = rounds.map((x) => {
    if (s(x.vencedor) === nomeA) a++;
    else if (s(x.vencedor) === nomeB) b++;
    return { round: n(x.round) ?? 0, a, b };
  });
  const celulas: CelulaRound[] = rounds.map((x) => ({
    round: n(x.round) ?? 0, vencedor: s(x.vencedor) === nomeA ? 'a' : s(x.vencedor) === nomeB ? 'b' : null,
    resultado: s(x.resultado) || null, plant_site: s(x.site_plant) || null, lado_vencedor: s(x.lado_vencedor) || null,
  }));
  const pid = s(r.partida_id);
  return (
    <Figura key={t.nome} titulo={`${nomeTime(nomeA)} ${n(placar[nomeA])}–${n(placar[nomeB])} ${nomeTime(nomeB)}${r.mapa ? ` · ${s(r.mapa)}` : ''}`}
      legenda={[{ cor: 'var(--time-a)', rotulo: `${nomeTime(nomeA)} à frente` }, { cor: 'var(--time-b)', rotulo: `${nomeTime(nomeB)} à frente` }]}
      fonte={`${rounds.length} ROUNDS · ${fonte(t)}`} acao={pid ? <BotaoPrancheta partidaId={pid} texto="Abrir na prancheta" /> : undefined}>
      <Momentum pontos={pontos} nomeA={nomeTime(nomeA)} nomeB={nomeTime(nomeB)} altura={180} />
      <LivroRounds rounds={celulas} nomeA={nomeTime(nomeA)} nomeB={nomeTime(nomeB)} linkRound={pid ? (k) => linkPrancheta(pid, k) : undefined}
        renderLink={(href, c, rot, cls) => <Link para={href} className={cls} aria-label={rot}>{c}</Link>} />
    </Figura>
  );
}

/** stats_time, stats_jogador, scouting_time e qualquer resultado com uma lista de taxas por mapa/agente. */
function porMapa(t: ToolChamada): ReactNode {
  const r = t.resultado as Obj;
  const blocos: ReactNode[] = [];
  const mapas = lista(r.por_mapa).filter((m) => n(m.taxa_vitoria_pct) !== null);
  if (mapas.length >= 2) {
    blocos.push(
      <Figura key={`${t.nome}-mapas`} titulo={`Vitórias por mapa${r.time ? ` · ${nomeTime(s(r.time))}` : r.jogador ? ` · ${s(r.jogador)}` : ''}`}
        tabela={{ colunas: ['Mapa', 'Vitórias', 'Partidas'], linhas: mapas.map((m) => [s(m.mapa ?? m.mapa_id), pct(n(m.taxa_vitoria_pct)), n(m.partidas) ?? '—']) }}
        fonte={fonte(t)}>
        <Colunas itens={mapas.slice(0, 8).map((m) => ({ rotulo: s(m.mapa ?? m.mapa_id), valor: n(m.taxa_vitoria_pct), detalhe: `${n(m.partidas) ?? '?'} partidas` }))} linhaRef={50} rotuloRef="50%" />
      </Figura>,
    );
  }
  const ags = lista(r.agentes_mais_usados).filter((x) => n(x.partidas) !== null);
  if (ags.length >= 2) {
    const max = Math.max(...ags.map((x) => n(x.partidas) ?? 0));
    blocos.push(
      <Figura key={`${t.nome}-agentes`} titulo="Agentes mais usados" fonte={fonte(t)}
        tabela={{ colunas: ['Agente', 'Partidas', 'Vitórias'], linhas: ags.map((x) => [s(x.agente), n(x.partidas) ?? '—', pct(n(x.taxa_vitoria_pct))]) }}>
        <BarrasMedia linhas={ags.map((x) => ({ rotulo: s(x.agente), valor: n(x.partidas), detalhe: `vitórias ${pct(n(x.taxa_vitoria_pct))}` }))} max={max} formato={(v) => (v === null ? '—' : String(v))} />
      </Figura>,
    );
  }
  return blocos.length ? <>{blocos}</> : null;
}

function prancheta(t: ToolChamada): ReactNode {
  const r = t.resultado as Obj;
  const pid = s(r.partida_id), round = n(r.round);
  if (!pid) return null;
  return (
    <div key={t.nome} className="coach-prancheta">
      <span className="rotulo rotulo--menta">PRANCHETA</span>
      <b>Round {round} {r.mapa ? `· ${s(r.mapa)}` : ''}{r.vencedor ? ` · venceu ${nomeTime(s(r.vencedor))}` : ''}</b>
      <span className="giz2">{lista(r.eventos).length} eventos com posição. A linha do tempo completa abre na prancheta.</span>
      <BotaoPrancheta partidaId={pid} round={round} texto={`Ver o round ${round ?? ''} na prancheta`} />
    </div>
  );
}

const POR_TOOL: Record<string, (t: ToolChamada, cena?: Panorama | null) => ReactNode> = {
  economia_time: economia, pos_plant_retake: posPlant, comparar_times: comparar, resumo_partida: resumoPartida,
  stats_time: porMapa, stats_jogador: porMapa, scouting_time: (t) => <>{porMapa(t)}{economia({ ...t, resultado: (t.resultado as Obj).economia ?? {} })}</>,
  abrir_na_prancheta: prancheta,
};

export function GraficosDasTools({ tools, cena }: { tools: ToolChamada[]; cena?: Panorama | null }) {
  // A mesma tool chamada duas vezes (ex.: dois times) gera dois gráficos; tools de busca não geram.
  const blocos = tools.map((t, i) => {
    if (!ehObj(t.resultado)) return null;
    const f = POR_TOOL[t.nome];
    const el = f ? f(t, cena) : null;
    return el ? <div key={`${t.nome}-${i}`} className="coach-grafico">{el}</div> : null;
  }).filter(Boolean);
  return blocos.length ? <div className="coach-graficos">{blocos}</div> : null;
}
