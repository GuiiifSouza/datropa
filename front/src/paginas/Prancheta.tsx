/**
 * Prancheta tática (dono: Rhuan). A tela vem do protótipo exportado por scripts/exportar_prancheta.py
 * e roda no motor de src/prancheta/Motor.tsx.
 *
 * Links que abrem a prancheta:
 *   /prancheta?partida_id=<partida_id>&round=<n>  round real (contrato com o site e a Tropa AI; round começa em 1)
 *   /prancheta?j=<código>                         jogada compartilhada, pronta para editar
 *   /prancheta?j=<código>&modo=ver                jogada compartilhada, só visualização
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { dados } from '../api/stats';
import { useCatalogo } from '../componentes/Catalogo';
import { Link, useLocal } from '../rotas';
import { nomeTime } from '../util/formato';
import { compilar, criarBase } from '../prancheta/Motor';
import { CHAVE_DO_MAPA, criarReais } from '../prancheta/reais';
import { criarCalor } from '../prancheta/calor';
import { ligarDeslize } from '../prancheta/deslize';
import { criarPrancheta } from '../prancheta/gerado/logica';
import molde from '../prancheta/gerado/molde.html?raw';
import '../prancheta/gerado/prancheta.css';
import '../prancheta/pagina.css';

type Logica = {
  trocarMapa: (chave: string) => void;
  abrirJogada: (j: unknown, soVer?: boolean) => boolean;
  jogadaInvalida: () => void;
  setState: (p: Record<string, unknown>) => void;
};

export function Prancheta() {
  const { busca } = useLocal();
  const { agente } = useCatalogo();
  const agenteRef = useRef(agente);
  agenteRef.current = agente;
  const raiz = useRef<HTMLDivElement>(null);

  const partidaId = busca.get('partida_id');
  const round = Number(busca.get('round')) || 1;
  const link = busca.get('j') ? window.location.href : null;

  // a classe é montada uma vez por entrada na página; o link que trouxe a pessoa decide o começo
  const Tela = useMemo(() => {
    const amb: Record<string, unknown> = {
      calor: criarCalor(),
      baseLink: `${window.location.origin}/prancheta`,
      reais: criarReais({ nomeAgente: (id) => agenteRef.current(id), nomeTime, partidaInicial: partidaId }),
    };
    amb.inicio = (c: Logica) => {
      const decodificar = amb.decodificar as ((t: string) => Promise<{ jogada: unknown; soVer: boolean }>) | undefined;
      if (link && decodificar) {
        // link estragado (cortado, editado à mão, de versão velha): avisa e abre a prancheta vazia
        Promise.resolve()
          .then(() => decodificar(link))
          .then((r) => { if (!r.jogada || !c.abrirJogada(r.jogada, r.soVer)) c.jogadaInvalida(); })
          .catch(() => c.jogadaInvalida());
        return;
      }
      if (partidaId) {
        dados.partida(partidaId).then((r) => {
          const chave = CHAVE_DO_MAPA[r.data.mapa_id];
          if (!chave) return; // mapa ainda sem desenho na prancheta: fica no Planejar
          c.trocarMapa(chave);
          c.setState({ modo: 'round', partida: 0, round, evento: 0 });
        }).catch(() => { /* partida não encontrada: abre a prancheta normal */ });
      }
    };
    return criarPrancheta(criarBase(compilar(molde)), amb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidaId, round, link]);

  // no celular a prancheta não cabe (foi desenhada para tela de computador): avisa antes de abrir
  const consulta = '(max-width: 859px)';
  const [estreito, setEstreito] = useState(() => window.matchMedia(consulta).matches);
  const [abrirMesmoAssim, setAbrirMesmoAssim] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(consulta);
    const mudar = () => setEstreito(m.matches);
    m.addEventListener('change', mudar);
    return () => m.removeEventListener('change', mudar);
  }, []);

  // a prancheta ocupa a altura que sobra entre o topo e o rodapé do site, que aqui fica numa linha fina
  // (pagina.css): a página inteira cabe na tela, sem rolagem
  useEffect(() => {
    const topo = document.querySelector<HTMLElement>('.topo');
    const rodape = document.querySelector<HTMLElement>('.rodape');
    const el = raiz.current;
    if (!topo || !el) return;
    document.documentElement.classList.add('na-prancheta');
    const medir = () => {
      // o respiro em cima da prancheta (padding do .prancheta-dc, para os orbes do topo não encostarem nas abas)
      // entra junto com o topo, senão sobrava esse tanto e a página ganhava uma rolagem
      const dc = el.querySelector<HTMLElement>('.prancheta-dc');
      const respiro = dc ? parseFloat(getComputedStyle(dc).paddingTop) || 0 : 0;
      el.style.setProperty('--altura-topo-site', `${topo.getBoundingClientRect().height + respiro}px`);
      el.style.setProperty('--altura-rodape-site', `${rodape ? rodape.getBoundingClientRect().height : 0}px`);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(topo);
    if (rodape) ro.observe(rodape);
    return () => {
      ro.disconnect();
      document.documentElement.classList.remove('na-prancheta');
    };
  }, [estreito, abrirMesmoAssim]);

  // pílula vermelha que desliza entre os botões dos grupos segmentados (prancheta/deslize.ts)
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    return ligarDeslize(el);
  }, [estreito, abrirMesmoAssim]);

  if (estreito && !abrirMesmoAssim) {
    return (
      <main className="pagina pagina--estreita">
        <div className="cabeca">
          <span className="rotulo rotulo--menta">PRANCHETA TÁTICA</span>
          <h1 className="titulo-xl">Prancheta</h1>
        </div>
        <section className="cartao" style={{ borderColor: 'rgba(50,224,196,.45)' }}>
          <b className="titulo-m">Melhor no computador</b>
          <p className="giz2">A prancheta precisa de espaço para o mapa, os agentes e as etapas. Abra pelo computador para montar e apresentar as jogadas.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="botao" onClick={() => setAbrirMesmoAssim(true)}>Abrir mesmo assim</button>
            <Link para="/partidas" className="botao botao--linha">Ver as partidas</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div ref={raiz} style={{ display: 'flex', flexDirection: 'column' }}>
      <h1 className="so-leitor">Prancheta tática</h1>
      <Tela key={`${partidaId}|${round}|${link}`} />
    </div>
  );
}
