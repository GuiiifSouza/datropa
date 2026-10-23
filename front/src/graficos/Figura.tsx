/**
 * Moldura comum dos gráficos: título, legenda, alternância Gráfico/Tabela e fonte.
 * A tabela garante que nenhum número fica só na cor ou só no hover.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ItemLegenda = { cor: string; rotulo: string; forma?: 'barra' | 'linha' | 'traco' };
export type Tabela = { colunas: string[]; linhas: (string | number)[][] };

export function Legenda({ itens }: { itens: ItemLegenda[] }) {
  return (
    <span className="legenda">
      {itens.map((i) => (
        <span key={i.rotulo} className="legenda__item">
          <span className={`legenda__marca legenda__marca--${i.forma ?? 'barra'}`} style={{ background: i.cor }} aria-hidden="true" />
          {i.rotulo}
        </span>
      ))}
    </span>
  );
}

export function Figura({ titulo, legenda, tabela, fonte, acao, children, compacta }: {
  titulo: ReactNode; legenda?: ItemLegenda[]; tabela?: Tabela; fonte?: ReactNode; acao?: ReactNode; children: ReactNode; compacta?: boolean;
}) {
  const [modo, setModo] = useState<'grafico' | 'tabela'>('grafico');
  return (
    <figure className={`figura${compacta ? ' figura--compacta' : ''}`}>
      <figcaption className="figura__topo">
        <b className="figura__titulo">{titulo}</b>
        {legenda && legenda.length > 1 && <Legenda itens={legenda} />}
      </figcaption>
      {modo === 'grafico' || !tabela ? children : (
        <div className="tabela-rolagem">
          <table className="tabela tabela--figura">
            <thead><tr>{tabela.colunas.map((c, j) => <th key={c} className={j > 0 ? 'n' : undefined}>{c}</th>)}</tr></thead>
            <tbody>{tabela.linhas.map((l, i) => <tr key={i}>{l.map((v, j) => <td key={j} className={j > 0 ? 'n' : undefined}>{v}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      {(fonte || tabela || acao) && (
        <div className="figura__rodape">
          <span className="mono figura__fonte">{fonte}</span>
          <span className="figura__acoes">
            {acao}
            {tabela && (
              <span className="segmentado" role="group" aria-label="Ver como">
                <button type="button" aria-pressed={modo === 'grafico'} onClick={() => setModo('grafico')}>Gráfico</button>
                <button type="button" aria-pressed={modo === 'tabela'} onClick={() => setModo('tabela')}>Tabela</button>
              </span>
            )}
          </span>
        </div>
      )}
    </figure>
  );
}

/**
 * Dica flutuante posicionada pelo ponteiro. Fica fora do gráfico (portal no body, position fixed): dentro dele ela
 * era cortada por qualquer caixa com overflow (livro de rounds, economia e tabelas rolam na horizontal; cartões
 * têm cantos arredondados). Não sai da tela: encosta nas laterais e desce para baixo do ponteiro quando falta
 * espaço em cima. Some ao rolar, para não ficar parada no ar.
 */
export function useDica() {
  const [dica, setDica] = useState<{ x: number; y: number; conteudo: ReactNode } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const mostrar = (e: { clientX: number; clientY: number; currentTarget: Element }, conteudo: ReactNode) => {
    setDica({ x: e.clientX, y: e.clientY, conteudo });
  };
  const esconder = () => setDica(null);
  const aberta = dica !== null;
  useEffect(() => {
    if (!aberta) return;
    window.addEventListener('scroll', esconder, true);
    window.addEventListener('resize', esconder);
    return () => { window.removeEventListener('scroll', esconder, true); window.removeEventListener('resize', esconder); };
  }, [aberta]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !dica) return;
    const w = el.offsetWidth, h = el.offsetHeight, folga = 8;
    const esquerda = dica.x - w / 2;
    const dx = Math.max(folga - esquerda, Math.min(0, window.innerWidth - folga - (esquerda + w)));
    el.style.setProperty('--dica-dx', `${dx}px`);
    el.classList.toggle('dica--abaixo', dica.y - 12 - h < folga);
  });
  const elemento = dica ? createPortal(
    <div ref={ref} className="dica dica--fixa" role="status" style={{ left: dica.x, top: dica.y }}>{dica.conteudo}</div>,
    document.body,
  ) : null;
  return { mostrar, esconder, elemento };
}
