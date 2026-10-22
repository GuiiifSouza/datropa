/**
 * Tropa AI: estado da conversa, painel que desce do header e a conversa compartilhada com a tela cheia.
 * Ctrl/Cmd+K abre e fecha, Esc fecha. A tela atual pode passar contexto (partida, time, jogador),
 * que vai junto da pergunta com os IDs, para o coach chamar as tools certas.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useAuth } from '../auth/Auth';
import { dados } from '../api/stats';
import { useDados } from '../api/useDados';
import { Link, navegar, useLocal } from '../rotas';
import { LIMITE_PERGUNTA, perguntar, type ErroCoach, type ToolChamada } from './cliente';
import { GraficosDasTools } from './Graficos';
import { linkPrancheta } from '../componentes/Prancheta';

export type ContextoCoach = { tipo: 'partida' | 'time' | 'jogador'; id: string; rotulo: string; sugestoes?: { t: string; q: string }[] };
export type Mensagem = { id: string; papel: 'usuario' | 'coach'; texto: string; tools?: ToolChamada[]; erro?: ErroCoach; pendente?: boolean };

type Ctx = {
  aberto: boolean; abrir: (pergunta?: string) => void; fechar: () => void; alternar: () => void;
  mensagens: Mensagem[]; enviando: boolean; enviar: (texto: string) => void; novaConversa: () => void;
  contexto: ContextoCoach | null; definirContexto: (c: ContextoCoach | null) => void; usarContexto: boolean; setUsarContexto: (v: boolean) => void;
};
const Contexto = createContext<Ctx | null>(null);
const CHAVE = 'datropa:coach:v1';

const SUGESTOES_PADRAO = [
  { t: 'RESUMIR A PARTIDA', q: 'Me conta como foi o Split entre Macklogic Red e Wolf Gaming.' },
  { t: 'COMPARAR', q: 'Macklogic Red ou Azure Bears Golden: quem está melhor?' },
  { t: 'ECONOMIA', q: 'Como o Wolf Gaming se sai nos rounds de force?' },
  { t: 'PÓS-PLANT E RETAKE', q: 'Quem segura melhor depois de plantar a spike: Minerva Thunders ou UFMT Turuna?' },
];

function lerSessao(): Mensagem[] {
  try {
    const v = sessionStorage.getItem(CHAVE);
    return v ? (JSON.parse(v) as Mensagem[]).filter((m) => !m.pendente) : [];
  } catch {
    return [];
  }
}

export function CoachProvider({ children }: { children: ReactNode }) {
  const { caminho } = useLocal();
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>(lerSessao);
  const [enviando, setEnviando] = useState(false);
  const [contexto, setContexto] = useState<ContextoCoach | null>(null);
  const [usarContexto, setUsarContexto] = useState(true);
  const [pendente, setPendente] = useState<string | null>(null);
  const ref = useRef(mensagens);
  ref.current = mensagens;

  useEffect(() => {
    try { sessionStorage.setItem(CHAVE, JSON.stringify(mensagens.slice(-40))); } catch { /* sem storage */ }
  }, [mensagens]);

  const telaCheia = caminho === '/tropa-ai';
  const fechar = useCallback(() => setAberto(false), []);
  const abrir = useCallback((p?: string) => { if (p) setPendente(p); if (!telaCheia) setAberto(true); }, [telaCheia]);
  const alternar = useCallback(() => {
    if (telaCheia) { window.history.length > 1 ? window.history.back() : navegar('/'); return; }
    setAberto((a) => !a);
  }, [telaCheia]);

  useEffect(() => {
    const tecla = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); alternar(); }
      else if (e.key === 'Escape' && aberto) setAberto(false);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [alternar, aberto]);
  useEffect(() => { if (telaCheia) setAberto(false); }, [telaCheia]);

  const enviar = useCallback((texto: string) => {
    const pergunta = texto.trim().slice(0, LIMITE_PERGUNTA);
    if (!pergunta || enviando) return;
    const historico = ref.current.filter((m) => !m.erro && !m.pendente).map((m) => ({ papel: m.papel, texto: m.texto }));
    const ctx = usarContexto && contexto ? `[Contexto da tela: ${contexto.tipo} ${contexto.id} (${contexto.rotulo})] ` : '';
    const idU = crypto.randomUUID?.() ?? String(Date.now());
    const idC = idU + '-r';
    setMensagens((m) => [...m, { id: idU, papel: 'usuario', texto: pergunta }, { id: idC, papel: 'coach', texto: '', pendente: true }]);
    setEnviando(true);
    perguntar((ctx + pergunta).slice(0, LIMITE_PERGUNTA), historico)
      .then((r) => setMensagens((m) => m.map((x) => (x.id === idC ? { id: idC, papel: 'coach', texto: r.resposta, tools: r.tools } : x))))
      .catch((e: ErroCoach) => setMensagens((m) => m.map((x) => (x.id === idC ? { id: idC, papel: 'coach', texto: '', erro: e?.tipo ? e : { tipo: 'indisponivel', mensagem: 'Algo deu errado. Tente de novo.' } } : x))))
      .finally(() => setEnviando(false));
  }, [enviando, contexto, usarContexto]);

  useEffect(() => {
    if (pendente && !enviando) { enviar(pendente); setPendente(null); }
  }, [pendente, enviando, enviar]);

  const novaConversa = useCallback(() => setMensagens([]), []);
  const valor = useMemo(() => ({ aberto, abrir, fechar, alternar, mensagens, enviando, enviar, novaConversa, contexto, definirContexto: setContexto, usarContexto, setUsarContexto }),
    [aberto, abrir, fechar, alternar, mensagens, enviando, enviar, novaConversa, contexto, usarContexto]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCoach(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error('useCoach fora do CoachProvider');
  return c;
}

/** As páginas chamam para avisar o coach do que está na tela. */
export function useContextoCoach(c: ContextoCoach | null) {
  const { definirContexto } = useCoach();
  const chave = c ? `${c.tipo}:${c.id}:${c.rotulo}` : '';
  useEffect(() => {
    definirContexto(c);
    return () => definirContexto(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, definirContexto]);
}

// ------------------------------------------------------------ texto da resposta
/** Markdown mínimo e seguro: parágrafos, listas com "-" e **negrito**. Sem HTML injetado. */
export function TextoCoach({ texto }: { texto: string }) {
  const negrito = (linha: string) => linha.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : p));
  const blocos = texto.trim().split(/\n{2,}/);
  return (
    <div className="coach-texto">
      {blocos.map((b, i) => {
        const linhas = b.split('\n');
        if (linhas.every((l) => /^\s*[-•*]\s+/.test(l))) return <ul key={i}>{linhas.map((l, j) => <li key={j}>{negrito(l.replace(/^\s*[-•*]\s+/, ''))}</li>)}</ul>;
        return <p key={i}>{linhas.map((l, j) => <span key={j}>{j > 0 && <br />}{negrito(l)}</span>)}</p>;
      })}
    </div>
  );
}

// ------------------------------------------------------------ conversa (painel e tela cheia)
export function Conversa({ grande }: { grande?: boolean }) {
  const { mensagens, enviar } = useCoach();
  const { dados: cena } = useDados('panorama', () => dados.panorama());
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [mensagens.length, mensagens[mensagens.length - 1]?.pendente]);
  return (
    <div className={`conversa${grande ? ' conversa--grande' : ''}`} aria-live="polite">
      {mensagens.map((m) => m.papel === 'usuario' ? (
        <div key={m.id} className="balao-usuario">{m.texto}</div>
      ) : (
        <article key={m.id} className="resposta-coach">
          {m.pendente && <div className="coach-pensando"><span className="coach-pensando__orbe" aria-hidden="true" />Consultando a base…</div>}
          {m.erro && <ErroConversa erro={m.erro} />}
          {!m.pendente && !m.erro && <TextoCoach texto={m.texto} />}
          {m.tools && m.tools.length > 0 && <GraficosDasTools tools={m.tools} cena={cena ?? null} />}
          {m.tools && m.tools.length > 0 && (
            <span className="mono coach-fontes">CONSULTOU: {[...new Set(m.tools.map((t) => t.nome))].join(' · ')}</span>
          )}
        </article>
      ))}
      {mensagens.length > 0 && !mensagens[mensagens.length - 1].pendente && <Seguir onEscolher={enviar} />}
      <div ref={fim} />
    </div>
  );
}

function ErroConversa({ erro }: { erro: ErroCoach }) {
  const { entrar } = useAuth();
  return (
    <div className="coach-erro" role="alert">
      <span>{erro.mensagem}</span>
      {erro.tipo === 'login' && <button type="button" className="botao botao--ia botao--pequeno" onClick={entrar}>Entrar com Google</button>}
    </div>
  );
}

function Seguir({ onEscolher }: { onEscolher: (q: string) => void }) {
  const { contexto } = useCoach();
  const opcoes = contexto?.sugestoes?.slice(0, 3).map((s) => s.q) ?? ['E no Ascent?', 'Compare com a Azure Bears Golden', 'Quem decide nesse time?'];
  return (
    <div className="seguir">
      {opcoes.map((q) => <button key={q} type="button" className="pill" onClick={() => onEscolher(q)}>{q}</button>)}
    </div>
  );
}

export function Compositor({ grande, autoFoco }: { grande?: boolean; autoFoco?: boolean }) {
  const { enviar, enviando } = useCoach();
  const { usuario, pronto, entrar, disponivel, erro } = useAuth();
  const [texto, setTexto] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (autoFoco) area.current?.focus(); }, [autoFoco]);
  const submeter = (e?: FormEvent) => {
    e?.preventDefault();
    if (!texto.trim()) return;
    enviar(texto);
    setTexto('');
  };
  const tecla = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submeter(); }
  };
  if (pronto && !usuario) {
    return (
      <div className="compositor compositor--login">
        <span>{disponivel ? 'Entre com o Google para perguntar. As páginas de estatística continuam abertas para todo mundo.' : 'Login indisponível neste ambiente (sem config do Firebase).'}</span>
        {disponivel && <button type="button" className="botao botao--ia" onClick={entrar}>Entrar com Google</button>}
        {erro && <span className="cor-ia">{erro}</span>}
      </div>
    );
  }
  return (
    <form className={`compositor${grande ? ' compositor--grande' : ''}`} onSubmit={submeter}>
      <label className="compositor__campo">
        <span className="so-leitor">Pergunta para a Tropa AI</span>
        <textarea ref={area} rows={grande ? 1 : 2} maxLength={LIMITE_PERGUNTA} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={tecla}
          placeholder={grande ? 'Pergunte sobre qualquer time, jogador ou partida' : 'Ex.: por que o Wolf perdeu a prorrogação?'} />
      </label>
      <button type="submit" className={grande ? 'compositor__enviar' : 'botao botao--ia botao--pequeno'} disabled={enviando || !texto.trim()} aria-label="Enviar">
        {grande ? <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg> : 'Enviar ↵'}
      </button>
    </form>
  );
}

export function BoasVindas() {
  const { contexto, usarContexto, setUsarContexto, enviar } = useCoach();
  const sugestoes = contexto?.sugestoes?.length ? contexto.sugestoes : SUGESTOES_PADRAO;
  return (
    <div className="boas-vindas">
      <div className="boas-vindas__titulo">
        <span className="titulo-l" style={{ fontSize: 40 }}>E aí! Qual leitura vamos fazer hoje?</span>
        <span className="giz2">Pergunte do seu jeito, como perguntaria a alguém da comissão técnica. Eu respondo com os números da base e mostro de onde eles vieram.</span>
      </div>
      {contexto && (
        <div className="boas-vindas__contexto">
          <span className="rotulo">VOU CONSIDERAR</span>
          <button type="button" className={`chip${usarContexto ? ' chip--ia' : ''}`} aria-pressed={usarContexto} onClick={() => setUsarContexto(!usarContexto)}
            title={usarContexto ? 'Clique para perguntar sem o contexto da tela' : 'Clique para usar o contexto da tela'}>
            {contexto.rotulo}{usarContexto ? ' ✕' : ''}
          </button>
        </div>
      )}
      <div className="sugestoes">
        {sugestoes.slice(0, 4).map((s) => (
          <button key={s.q} type="button" className="sugestao" onClick={() => enviar(s.q)}>
            <span className="rotulo rotulo--vermelho">{s.t}</span><span>{s.q}</span>
          </button>
        ))}
      </div>
      <Link para={linkPrancheta()} className="dica-prancheta">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--menta)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v14H4z" /><path d="M10 9l5 3-5 3z" /></svg>
        <span>Peça “abre o round 29 na prancheta” e eu levo você direto para o replay 2D.</span>
      </Link>
      <div className="dicas-coach">
        <span className="rotulo">DICAS</span><span>Use nomes de time e jogador</span><span>· diga o mapa ou torneio</span><span>· peça o formato: “em tabela”</span><span>· continue: “e no 2º lado?”</span>
      </div>
    </div>
  );
}

export function PainelCoach() {
  const { aberto, fechar, mensagens, novaConversa } = useCoach();
  const painel = useRef<HTMLElement>(null);
  if (!aberto) return null;
  return (
    <>
      <div className="coach-veu" onClick={fechar} aria-hidden="true" />
      <section id="painel-coach" ref={painel} role="dialog" aria-modal="false" aria-label="Tropa AI" className="painel-coach">
        <span className="painel-coach__seta" aria-hidden="true" />
        <div className="painel-coach__topo">
          <span className="painel-coach__marca"><span className="logo__selo" style={{ width: 28, height: 28, fontSize: 12 }}>DT</span><b>Tropa AI</b><span className="rotulo">COACH</span></span>
          <span className="painel-coach__acoes">
            {mensagens.length > 0 && <button type="button" className="botao-quadrado" onClick={novaConversa} title="Nova conversa" aria-label="Nova conversa">+</button>}
            <Link para="/tropa-ai" className="botao-quadrado" title="Abrir em tela cheia" aria-label="Abrir em tela cheia" onClick={fechar}>⤢</Link>
            <button type="button" className="botao-quadrado" onClick={fechar} aria-label="Fechar">✕</button>
          </span>
        </div>
        <div className="painel-coach__corpo">
          {mensagens.length === 0 ? <BoasVindas /> : <Conversa />}
        </div>
        <div className="painel-coach__rodape">
          <Compositor autoFoco />
          <span className="mono painel-coach__aviso">AQUI NÃO TEM PERGUNTA BOBA · NADA DO QUE VOCÊ PERGUNTA ALTERA OS DADOS · ESC FECHA</span>
        </div>
      </section>
    </>
  );
}
