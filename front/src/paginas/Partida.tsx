/** 03 · Partida: a série e, para o mapa escolhido, momentum, livro de rounds, placar dos jogadores e economia. */
import { dados } from '../api/stats';
import { useDados } from '../api/useDados';
import type { JogadorPartida, PartidaDetalhe } from '../api/tipos';
import { useCatalogo } from '../componentes/Catalogo';
import { BannerPrancheta, BotaoPrancheta, linkPrancheta } from '../componentes/Prancheta';
import { Agente, Carregando, ErroDados, FonteDados, SeloTime } from '../componentes/Visuais';
import { BarrasEspelhadas, EconomiaRounds, LivroRounds, Momentum, type CelulaRound } from '../graficos/Graficos';
import { Figura } from '../graficos/Figura';
import { useCoach, useContextoCoach } from '../coach/Coach';
import { Link } from '../rotas';
import { COMPRAS, dec, diaBrasilia, diaCurto, hora, minutos, nomeTime, num, pct, taxa } from '../util/formato';

export function Partida({ id }: { id: string }) {
  const det = useDados(`partida:${id}`, () => dados.partida(id));
  const ser = useDados(`serie:${id}`, () => dados.serieDaPartida(id));
  const { mapa, torneio } = useCatalogo();
  const { abrir } = useCoach();
  const p = det.dados?.data;
  const [ta, tb] = p?.times ?? [];
  useContextoCoach(p && ta && tb ? {
    tipo: 'partida', id: p.id, rotulo: `${nomeTime(ta.nome)} × ${nomeTime(tb.nome)} · ${mapa(p.mapa_id)}`,
    sugestoes: [
      { t: 'RESUMIR', q: `Me conta como foi o ${mapa(p.mapa_id)} entre ${nomeTime(ta.nome)} e ${nomeTime(tb.nome)}.` },
      { t: 'DECISIVO', q: 'Qual foi o round que decidiu esse mapa? Abre ele na prancheta.' },
      { t: 'ECONOMIA', q: `Como foi a economia de ${nomeTime(ta.nome)} nesse mapa?` },
      { t: 'JOGADORES', q: 'Quem jogou melhor nesse mapa e por quê?' },
    ],
  } : null);

  if (det.erro) return <main className="pagina"><ErroDados erro={det.erro} recarregar={det.recarregar} /></main>;
  if (!p || !ta || !tb) return <main className="pagina"><Carregando altura={260} /><Carregando altura={180} linhas={2} /></main>;

  const serie = ser.dados;
  // Na série, o time A é o primeiro do confronto; o mapa atual pode ter vindo invertido.
  const invertido = serie ? serie.time_a.id !== ta.id : false;
  const A = invertido ? tb : ta, B = invertido ? ta : tb;
  const rounds = p.rounds;
  const pontos = rounds.map((r) => ({ round: r.round, a: r.placar?.[A.id] ?? 0, b: r.placar?.[B.id] ?? 0 }));
  const temPlacar = rounds.every((r) => r.placar);
  if (!temPlacar) { let a = 0, b = 0; rounds.forEach((r, i) => { if (r.vencedor_id === A.id) a++; else if (r.vencedor_id === B.id) b++; pontos[i] = { round: r.round, a, b }; }); }
  const lado = (tid: string | null | undefined) => (tid === A.id ? 'a' : tid === B.id ? 'b' : null);
  const celulas: CelulaRound[] = rounds.map((r) => ({ round: r.round, vencedor: lado(r.vencedor_id), resultado: r.resultado, plant_site: r.plant_site, lado_vencedor: r.lado_vencedor }));
  const intervalo = pontos[11];
  const decisivo = acharDecisivo(p, A.id, B.id);
  const sequencia = maiorSequencia(rounds.map((r) => lado(r.vencedor_id)));
  const venceuA = p.vencedor_id === A.id;
  const jogA = p.jogadores.filter((j) => j.time_id === A.id), jogB = p.jogadores.filter((j) => j.time_id === B.id);
  const temEco = rounds.some((r) => r.equipamento);
  const ecoTime = (tid: string) => (['pistol', 'eco', 'force', 'full'] as const).map((tipo) => {
    const xs = rounds.filter((r) => r.compras?.[tid] === tipo);
    return { tipo, rounds: xs.length, taxa: taxa(xs.filter((r) => r.vencedor_id === tid).length, xs.length) };
  });
  const fbConv = (tid: string) => {
    const xs = rounds.filter((r) => r.first_blood_time_id === tid);
    return taxa(xs.filter((r) => r.vencedor_id === tid).length, xs.length);
  };
  const destaques = [
    ['MAIOR ACS', [...p.jogadores].sort((a, b) => (b.acs ?? 0) - (a.acs ?? 0))[0], (j: JogadorPartida) => `${dec(j.acs, 0)} ACS`],
    ['MAIS ABATES', [...p.jogadores].sort((a, b) => b.kills - a.kills)[0], (j: JogadorPartida) => `${j.kills} abates`],
    ['MAIS FIRST BLOODS', [...p.jogadores].sort((a, b) => b.first_bloods - a.first_bloods)[0], (j: JogadorPartida) => `${j.first_bloods} first bloods`],
  ] as const;

  return (
    <main className="pagina">
      <Link para="/partidas" className="voltar mono">← PARTIDAS</Link>

      <section className="confronto">
        <span className="rotulo rotulo--ambar">{torneio(p.torneio_id).toUpperCase()} · {diaCurto(diaBrasilia(p.inicio)).toUpperCase()}{p.inicio ? ` · ${hora(p.inicio)}` : ''}</span>
        <div className="confronto__linha">
          <Link para={`/times/${encodeURIComponent(A.id)}`} className="confronto__time">
            <SeloTime nome={A.nome} grande /><b className="titulo-m">{nomeTime(A.nome)}</b>
          </Link>
          <div className="confronto__placar">
            {serie && serie.mapas.length > 1 ? (
              <><span className="num"><span className="cor-a">{serie.vitorias_a}</span><span className="apagado-2">–</span><span className="cor-b">{serie.vitorias_b}</span></span><span className="rotulo">SÉRIE · MD3</span></>
            ) : (
              <><span className="num"><span className="cor-a">{A.rounds_ganhos}</span><span className="apagado-2">–</span><span className="cor-b">{B.rounds_ganhos}</span></span><span className="rotulo">MD1</span></>
            )}
          </div>
          <Link para={`/times/${encodeURIComponent(B.id)}`} className="confronto__time confronto__time--b">
            <b className="titulo-m">{nomeTime(B.nome)}</b><SeloTime nome={B.nome} lado="b" grande />
          </Link>
        </div>
        {serie && serie.mapas.length > 1 && (
          <nav className="abas-mapa" aria-label="Mapas da série">
            {serie.mapas.map((m, i) => (
              <Link key={m.partida_id} para={`/partidas/${encodeURIComponent(m.partida_id)}`} aria-current={m.partida_id === p.id ? 'page' : undefined} className="aba-mapa">
                <span className="mono apagado">M{i + 1}</span><b>{mapa(m.mapa_id)}</b>
                <span className="num"><span style={{ color: m.placar_a > m.placar_b ? 'var(--ambar)' : 'var(--apagado)' }}>{m.placar_a}</span>:<span style={{ color: m.placar_b > m.placar_a ? 'var(--menta)' : 'var(--apagado)' }}>{m.placar_b}</span></span>
                {m.prorrogacao && <span className="chip chip--alerta">PRORR.</span>}
              </Link>
            ))}
          </nav>
        )}
      </section>

      <section className="mapa-topo">
        <div className="cabeca">
          <span className="rotulo">{mapa(p.mapa_id).toUpperCase()} · {rounds.length} ROUNDS · {minutos(p.duracao_ms)}{rounds.length > 24 ? ' · PRORROGAÇÃO' : ''}</span>
          <h1 className="titulo-l">{venceuA ? nomeTime(A.nome) : nomeTime(B.nome)} vence o {mapa(p.mapa_id)} por {Math.max(A.rounds_ganhos, B.rounds_ganhos)}–{Math.min(A.rounds_ganhos, B.rounds_ganhos)}</h1>
        </div>
        <div className="grade grade-4">
          <div className="cartao-mini"><span className="rotulo">NO INTERVALO</span><b className="num" style={{ fontSize: 30 }}>{intervalo ? <><span className="cor-a">{intervalo.a}</span>–<span className="cor-b">{intervalo.b}</span></> : '—'}</b></div>
          <div className="cartao-mini"><span className="rotulo">MAIOR SEQUÊNCIA</span><b className="num" style={{ fontSize: 30 }}>{sequencia.n}</b><span className="apagado" style={{ fontSize: 12 }}>{sequencia.lado ? nomeTime(sequencia.lado === 'a' ? A.nome : B.nome) : ''}{sequencia.ate ? ` · até o round ${sequencia.ate}` : ''}</span></div>
          <div className="cartao-mini"><span className="rotulo">ABRIU E VENCEU</span><b className="num" style={{ fontSize: 30 }}><span className="cor-a">{pct(fbConv(A.id), 0)}</span> <span className="apagado-2">/</span> <span className="cor-b">{pct(fbConv(B.id), 0)}</span></b><span className="apagado" style={{ fontSize: 12 }}>rounds vencidos depois do first blood</span></div>
          <div className="cartao-mini"><span className="rotulo">SPIKE PLANTADA</span><b className="num" style={{ fontSize: 30 }}>{rounds.filter((r) => r.plant_site).length}</b><span className="apagado" style={{ fontSize: 12 }}>de {rounds.length} rounds</span></div>
        </div>
      </section>

      <BannerPrancheta partidaId={p.id} round={decisivo?.round} titulo={decisivo ? `Reveja o round ${decisivo.round} em 2D` : 'Reveja este mapa em 2D'}
        texto={decisivo ? decisivo.motivo : 'Abra qualquer round na prancheta e acompanhe as jogadas.'} />

      <div className="grade grade-2">
        <Figura titulo="Diferença no placar, round a round" legenda={[{ cor: 'var(--ambar)', rotulo: `${nomeTime(A.nome)} à frente` }, { cor: 'var(--menta)', rotulo: `${nomeTime(B.nome)} à frente` }]}
          tabela={{ colunas: ['Round', nomeTime(A.nome), nomeTime(B.nome)], linhas: pontos.map((x) => [x.round, x.a, x.b]) }} fonte={`${rounds.length} ROUNDS`}>
          <Momentum pontos={pontos} nomeA={nomeTime(A.nome)} nomeB={nomeTime(B.nome)} destaque={decisivo?.round} />
        </Figura>
        <div className="grade" style={{ gap: 14 }}>
          {destaques.map(([rot, j, f]) => j && (
            <Link key={rot} para={`/jogadores/${encodeURIComponent(j.jogador_id)}`} className="destaque-jogador">
              <Agente id={j.agente_id} tamanho="g" />
              <span><span className="rotulo">{rot}</span><b className="titulo-s" style={{ display: 'block' }}>{j.nome}</b><span className="apagado" style={{ fontSize: 13 }}>{nomeTime(j.time_id === A.id ? A.nome : B.nome)}</span></span>
              <b className="num destaque-jogador__v">{f(j)}</b>
            </Link>
          ))}
        </div>
      </div>

      <Figura titulo="Livro de rounds" fonte="CLIQUE NUM ROUND VENCIDO PARA ABRIR NA PRANCHETA" acao={<BotaoPrancheta partidaId={p.id} texto="Abrir o mapa na prancheta" />}>
        <LivroRounds rounds={celulas} nomeA={nomeTime(A.nome)} nomeB={nomeTime(B.nome)} linkRound={(n) => linkPrancheta(p.id, n)}
          renderLink={(href, c, rot, cls) => <Link para={href} className={cls} aria-label={rot}>{c}</Link>} />
      </Figura>

      <section className="grade grade-2">
        <Placar titulo={nomeTime(A.nome)} lado="a" jogadores={jogA} rounds={rounds.length} venceu={venceuA} />
        <Placar titulo={nomeTime(B.nome)} lado="b" jogadores={jogB} rounds={rounds.length} venceu={!venceuA} />
      </section>

      {temEco && (
        <section className="grade grade-2">
          <Figura titulo="Economia round a round" legenda={[{ cor: 'var(--ambar)', rotulo: nomeTime(A.nome) }, { cor: 'var(--menta)', rotulo: nomeTime(B.nome) }]}
            fonte="EQUIPAMENTO SOMADO DOS CINCO · BARRA CHEIA = VENCEU O ROUND"
            tabela={{ colunas: ['Round', `${nomeTime(A.nome)}`, `${nomeTime(B.nome)}`, 'Venceu'], linhas: rounds.map((r) => [r.round, `${COMPRAS[r.compras?.[A.id] ?? ''] ?? '—'} ${num(r.equipamento?.[A.id])}`, `${COMPRAS[r.compras?.[B.id] ?? ''] ?? '—'} ${num(r.equipamento?.[B.id])}`, r.vencedor_id === A.id ? nomeTime(A.nome) : nomeTime(B.nome)]) }}>
            <EconomiaRounds nomeA={nomeTime(A.nome)} nomeB={nomeTime(B.nome)} rounds={rounds.map((r) => ({
              round: r.round, eqA: r.equipamento?.[A.id] ?? 0, eqB: r.equipamento?.[B.id] ?? 0, compraA: r.compras?.[A.id] ?? '', compraB: r.compras?.[B.id] ?? '', vencedor: lado(r.vencedor_id),
            }))} />
          </Figura>
          <Figura titulo="Vitória por tipo de compra neste mapa" legenda={[{ cor: 'var(--ambar)', rotulo: nomeTime(A.nome) }, { cor: 'var(--menta)', rotulo: nomeTime(B.nome) }]}
            fonte="REGRA DA GOLD: PISTOL = ROUNDS 1 E 13 · ECO < 10 MIL · FORCE < 20 MIL · FULL ≥ 20 MIL">
            <BarrasEspelhadas nomeA={nomeTime(A.nome)} nomeB={nomeTime(B.nome)} linhas={ecoTime(A.id).map((e, i) => {
              const b = ecoTime(B.id)[i];
              return { rotulo: `${COMPRAS[e.tipo]} (${e.rounds}×${b.rounds})`, a: e.taxa, b: b.taxa, max: 100 };
            })} />
          </Figura>
        </section>
      )}

      <section className="bloco-ia bloco-ia--compacto">
        <div className="cabeca"><span className="rotulo rotulo--vermelho">TROPA AI</span><h2 className="titulo-m">Pergunte sobre este mapa</h2></div>
        <div className="seguir">
          {[`Por que ${nomeTime(venceuA ? B.nome : A.nome)} perdeu o ${mapa(p.mapa_id)}?`, 'Qual round decidiu o mapa?', `Compare ${nomeTime(A.nome)} e ${nomeTime(B.nome)}.`].map((q) => (
            <button key={q} type="button" className="pill" onClick={() => abrir(q)}>{q}</button>
          ))}
        </div>
      </section>
      <FonteDados meta={det.dados?.meta} extra={p.versao ? `VERSÃO ${p.versao.split('-')[1] ?? p.versao}` : undefined} />
    </main>
  );
}

function Placar({ titulo, lado, jogadores, venceu }: { titulo: string; lado: 'a' | 'b'; jogadores: JogadorPartida[]; rounds: number; venceu: boolean }) {
  return (
    <section className="cartao">
      <div className="secao-topo">
        <span className={`titulo-s ${lado === 'a' ? 'cor-a' : 'cor-b'}`}>{titulo}</span>
        <span className={`chip${venceu ? '' : ''}`}>{venceu ? 'Venceu' : 'Perdeu'}</span>
      </div>
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead><tr><th>Jogador</th><th className="n">ACS</th><th className="n">K</th><th className="n">D</th><th className="n">A</th><th className="n">K/D</th><th className="n">ADR</th><th className="n">HS%</th><th className="n" title="Rounds com abate, assistência, sobrevivência ou troca (estimado)">KAST</th><th className="n">FB</th></tr></thead>
          <tbody>
            {jogadores.map((j) => (
              <tr key={j.jogador_id}>
                <td><Link para={`/jogadores/${encodeURIComponent(j.jogador_id)}`} className="tabela-jogador"><Agente id={j.agente_id} tamanho="p" /><b>{j.nome}</b></Link></td>
                <td className="n"><b>{dec(j.acs, 0)}</b></td><td className="n">{j.kills}</td><td className="n">{j.deaths}</td><td className="n">{j.assists}</td>
                <td className="n">{dec(j.deaths ? j.kills / j.deaths : null, 2)}</td><td className="n">{dec(j.adr, 0)}</td><td className="n">{pct(j.hs_pct, 0)}</td>
                <td className="n">{pct(j.kast_pct, 0)}</td><td className="n">{j.first_bloods}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function maiorSequencia(lados: ('a' | 'b' | null)[]) {
  let melhor = { n: 0, lado: null as 'a' | 'b' | null, ate: 0 }, n = 0;
  lados.forEach((l, i) => {
    n = l && l === lados[i - 1] ? n + 1 : l ? 1 : 0;
    if (n > melhor.n) melhor = { n, lado: l, ate: i + 1 };
  });
  return melhor;
}

/** Round decisivo: o último que mudou quem liderava ou o match point convertido. Critério explícito, não é MVP. */
function acharDecisivo(p: PartidaDetalhe, a: string, b: string): { round: number; motivo: string } | null {
  const rs = p.rounds;
  if (!rs.length) return null;
  let lider: string | null = null, ultimaVirada: number | null = null, sa = 0, sb = 0;
  for (const r of rs) {
    if (r.vencedor_id === a) sa++; else if (r.vencedor_id === b) sb++;
    const l = sa > sb ? a : sb > sa ? b : null;
    if (l && l !== lider) { if (lider) ultimaVirada = r.round; lider = l; }
  }
  if (ultimaVirada && ultimaVirada > 12) return { round: ultimaVirada, motivo: `Foi o round da última virada no placar. Daí em diante, ninguém mais passou à frente.` };
  const ultimo = rs[rs.length - 1];
  return { round: ultimo.round, motivo: 'O round que fechou o mapa.' };
}
