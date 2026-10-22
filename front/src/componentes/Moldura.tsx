/** Header (logo, navegação, orbes, busca, conta), busca global e rodapé. */
import { useEffect, useRef, useState } from 'react';
import { Link, navegar, useAtivo } from '../rotas';
import { useAuth } from '../auth/Auth';
import { useCoach } from '../coach/Coach';
import { Hubs } from './Hubs';
import { dados } from '../api/stats';
import { nomeTime } from '../util/formato';
import { useDados } from '../api/useDados';

function ItemNav({ para, children }: { para: string; children: string }) {
  const ativo = useAtivo(para);
  return <Link para={para} aria-current={ativo ? 'page' : undefined}>{children}</Link>;
}

export function Header() {
  const { aberto, alternar } = useCoach();
  const [busca, setBusca] = useState(false);
  const telaCheia = useAtivo('/tropa-ai');
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); setBusca(true); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);
  return (
    <header className="topo">
      <div className="topo__barra">
        <div className="topo__esq">
          <Link para="/" className="logo" aria-label="Da Tropa, ir para o Panorama">
            <span className="logo__selo">DT</span><span className="logo__nome">DA TROPA</span>
          </Link>
          <nav className="nav" aria-label="Principal">
            <ItemNav para="/partidas">Partidas</ItemNav>
            <ItemNav para="/times">Times</ItemNav>
            <ItemNav para="/estatisticas">Estatísticas</ItemNav>
            <ItemNav para="/meta">Meta</ItemNav>
          </nav>
        </div>
        <Hubs coachAberto={aberto || telaCheia} alternarCoach={alternar} />
        <div className="topo__dir">
          <button type="button" className="botao-redondo" aria-label="Buscar times, jogadores e mapas (atalho /)" onClick={() => setBusca(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          </button>
          <Conta />
        </div>
      </div>
      {busca && <Busca fechar={() => setBusca(false)} />}
    </header>
  );
}

function Conta() {
  const { usuario, entrar, sair, disponivel } = useAuth();
  const [menu, setMenu] = useState(false);
  // Visitante anônimo (entrou sozinho pela Tropa AI) continua vendo o atalho do Google.
  if (!usuario || usuario.anonimo) {
    return (
      <button type="button" className="avatar" onClick={entrar} disabled={!disponivel} title={disponivel ? 'Entrar com Google' : 'Login indisponível'} aria-label="Entrar com Google">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>
      </button>
    );
  }
  return (
    <span style={{ position: 'relative' }}>
      <button type="button" className="avatar" aria-label={`Conta de ${usuario.nome}`} aria-expanded={menu} onClick={() => setMenu(!menu)}>
        {usuario.foto ? <img src={usuario.foto} alt="" referrerPolicy="no-referrer" /> : usuario.iniciais}
      </button>
      {menu && (
        <span className="menu-conta" role="menu">
          <span className="giz2" style={{ padding: '6px 10px', fontSize: 13 }}>{usuario.nome}</span>
          <button type="button" role="menuitem" onClick={() => { setMenu(false); sair(); }}>Sair</button>
        </span>
      )}
    </span>
  );
}

function Busca({ fechar }: { fechar: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const termo = q.trim();
  const { dados: r, carregando } = useDados(termo.length >= 2 ? `busca:${termo}` : null, () => dados.busca(termo));
  const itens = r?.data ?? [];
  useEffect(() => { campo.current?.focus(); }, []);
  useEffect(() => setSel(0), [termo]);
  const destino = (i: { tipo: string; id: string }) => (i.tipo === 'time' ? `/times/${encodeURIComponent(i.id)}` : i.tipo === 'jogador' ? `/jogadores/${encodeURIComponent(i.id)}` : `/meta?mapa=${encodeURIComponent(i.id)}`);
  const ir = (i: { tipo: string; id: string }) => { fechar(); navegar(destino(i)); };
  return (
    <div className="busca" onClick={fechar} onKeyDown={(e) => {
      if (e.key === 'Escape') fechar();
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, itens.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
      else if (e.key === 'Enter' && itens[sel]) ir(itens[sel]);
    }}>
      <div className="busca__caixa" role="dialog" aria-label="Buscar" onClick={(e) => e.stopPropagation()}>
        <input ref={campo} className="busca__campo" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Time, jogador ou mapa" aria-label="Buscar"
          role="combobox" aria-expanded={itens.length > 0} aria-controls="busca-lista" aria-activedescendant={itens[sel] ? `busca-${sel}` : undefined} />
        <div className="busca__lista" id="busca-lista" role="listbox">
          {termo.length < 2 && <span className="apagado" style={{ padding: 12 }}>Digite pelo menos 2 letras.</span>}
          {termo.length >= 2 && !carregando && itens.length === 0 && <span className="apagado" style={{ padding: 12 }}>Nada encontrado para “{termo}”.</span>}
          {itens.map((i, k) => (
            <Link key={`${i.tipo}-${i.id}`} id={`busca-${k}`} role="option" aria-selected={k === sel} para={destino(i)} className="busca__item" onClick={fechar}>
              <span className="rotulo" style={{ width: 64 }}>{i.tipo}</span>
              <b>{i.tipo === 'time' ? nomeTime(i.nome) : i.nome}</b>
              {i.extra && <span className="apagado mono" style={{ fontSize: 12 }}>{i.extra}</span>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Rodape() {
  const { dados: m } = useDados('manifesto', () => dados.manifesto());
  return (
    <footer className="rodape">
      <div className="rodape__dentro">
        <span><b style={{ color: 'var(--giz)' }}>Da Tropa</b> · Hackathon SEMCOMP/VALORANT · dados só da base oficial do campeonato, pós-partida.</span>
        <span className="mono" style={{ fontSize: 11 }}>{m ? `${m.partidas} MAPAS · SNAPSHOT ${m.gerado_em.slice(0, 10)}` : ''}</span>
        <span style={{ fontSize: 12 }}>Não é afiliado à Riot Games. VALORANT é marca da Riot Games, Inc.</span>
      </div>
    </footer>
  );
}
