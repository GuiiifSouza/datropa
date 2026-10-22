/**
 * Menu suspenso próprio (substitui o <select> do navegador).
 * Teclado: Enter/Espaço/↓ abre, ↑↓ navega, Home/End, digitar busca pela letra, Enter escolhe, Esc fecha.
 * Segue o padrão listbox do WAI-ARIA.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export type OpcaoSeletor = { valor: string; rotulo: string; extra?: ReactNode };

export function Seletor({ rotulo, valor, opcoes, aoMudar, larguraMin = 200 }: {
  rotulo: string; valor: string; opcoes: OpcaoSeletor[]; aoMudar: (v: string) => void; larguraMin?: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [paraCima, setParaCima] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const busca = useRef({ texto: '', ate: 0 });
  const id = useId();
  const atual = opcoes.find((o) => o.valor === valor) ?? opcoes[0];

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    lista.current?.querySelector<HTMLElement>(`[data-i="${ativo}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [aberto, ativo]);

  const abrir = () => {
    const caixa = botao.current?.getBoundingClientRect();
    setParaCima(!!caixa && window.innerHeight - caixa.bottom < 300 && caixa.top > 300);
    setAtivo(Math.max(0, opcoes.findIndex((o) => o.valor === valor)));
    setAberto(true);
  };
  const escolher = (i: number) => {
    const o = opcoes[i];
    if (o) aoMudar(o.valor);
    setAberto(false);
    botao.current?.focus();
  };
  const tecla = (e: KeyboardEvent) => {
    if (!aberto) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); abrir(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setAberto(false); botao.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((a) => Math.min(opcoes.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setAtivo(0); }
    else if (e.key === 'End') { e.preventDefault(); setAtivo(opcoes.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); escolher(ativo); }
    else if (e.key === 'Tab') setAberto(false);
    else if (e.key.length === 1) {
      const agora = Date.now();
      busca.current = { texto: (agora < busca.current.ate ? busca.current.texto : '') + e.key.toLowerCase(), ate: agora + 700 };
      const i = opcoes.findIndex((o) => o.rotulo.toLowerCase().startsWith(busca.current.texto));
      if (i >= 0) setAtivo(i);
    }
  };

  return (
    <div className={`seletor${aberto ? ' seletor--aberto' : ''}`} ref={raiz} style={{ minWidth: larguraMin }} onKeyDown={tecla}>
      <button ref={botao} type="button" className="seletor__botao" aria-haspopup="listbox" aria-expanded={aberto} aria-controls={`${id}-lista`}
        aria-label={`${rotulo}: ${atual?.rotulo ?? ''}`} onClick={() => (aberto ? setAberto(false) : abrir())}>
        <span className="seletor__rotulo">{rotulo}</span>
        <span className="seletor__valor">{atual?.rotulo}</span>
        <svg className="seletor__seta" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {aberto && (
        <ul ref={lista} id={`${id}-lista`} role="listbox" aria-label={rotulo} tabIndex={-1} aria-activedescendant={`${id}-${ativo}`}
          className={`seletor__lista${paraCima ? ' seletor__lista--cima' : ''}`}>
          {opcoes.map((o, i) => (
            <li key={o.valor || '_todos'} id={`${id}-${i}`} data-i={i} role="option" aria-selected={o.valor === valor}
              className={`seletor__opcao${i === ativo ? ' seletor__opcao--ativa' : ''}`} style={{ animationDelay: `${Math.min(i, 10) * 18}ms` }}
              onPointerEnter={() => setAtivo(i)} onClick={() => escolher(i)}>
              <span>{o.rotulo}</span>
              {o.extra && <span className="seletor__extra">{o.extra}</span>}
              {o.valor === valor && <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--vermelho)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10" /></svg>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
