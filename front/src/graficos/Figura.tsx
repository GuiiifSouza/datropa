/**
 * Moldura comum dos gráficos: título, legenda, alternância Gráfico/Tabela e fonte.
 * A tabela garante que nenhum número fica só na cor ou só no hover.
 */
import { useState, type ReactNode } from 'react';

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
          <table className="tabela">
            <thead><tr>{tabela.colunas.map((c) => <th key={c}>{c}</th>)}</tr></thead>
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

/** Dica flutuante simples, posicionada pelo ponteiro dentro do gráfico. */
export function useDica() {
  const [dica, setDica] = useState<{ x: number; y: number; conteudo: ReactNode } | null>(null);
  const mostrar = (e: { clientX: number; clientY: number; currentTarget: Element }, conteudo: ReactNode) => {
    const caixa = (e.currentTarget.closest('[data-grafico]') as HTMLElement | null)?.getBoundingClientRect();
    if (!caixa) return;
    setDica({ x: e.clientX - caixa.left, y: e.clientY - caixa.top, conteudo });
  };
  const esconder = () => setDica(null);
  const elemento = dica ? (
    <div className="dica" role="status" style={{ left: dica.x, top: dica.y }}>{dica.conteudo}</div>
  ) : null;
  return { mostrar, esconder, elemento };
}
