/** Lista de times com campanha, filtro por torneio e busca. */
import { useMemo, useState } from 'react';
import { dados } from '../api/stats';
import { useDados } from '../api/useDados';
import { useCatalogo } from '../componentes/Catalogo';
import { Carregando, ErroDados, estiloTime, FonteDados, SeloTime, Vazio } from '../componentes/Visuais';
import { Link, useParametro } from '../rotas';
import { nomeTime, pct } from '../util/formato';

export function Times() {
  const [torneioSel, setTorneio] = useParametro('torneio');
  const [q, setQ] = useState('');
  const [ordem, setOrdem] = useState<'partidas' | 'vitoria' | 'nome'>('partidas');
  const { cat, torneio } = useCatalogo();
  const r = useDados(`times:100:${torneioSel ?? ''}`, () => dados.times({ page_size: 100, torneio_id: torneioSel ?? undefined }));
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    const xs = (r.dados?.data ?? []).filter((x) => !t || nomeTime(x.nome).toLowerCase().includes(t));
    return [...xs].sort((a, b) => ordem === 'nome' ? nomeTime(a.nome).localeCompare(nomeTime(b.nome))
      : ordem === 'vitoria' ? (b.taxa_vitoria_pct ?? -1) - (a.taxa_vitoria_pct ?? -1) || b.partidas - a.partidas
      : b.partidas - a.partidas || (b.taxa_vitoria_pct ?? 0) - (a.taxa_vitoria_pct ?? 0));
  }, [r.dados, q, ordem]);

  return (
    <main className="pagina">
      <div className="cabeca">
        <span className="rotulo rotulo--vermelho">{r.dados ? `${r.dados.pagination.total} TIMES` : 'TIMES'}{torneioSel ? ` · ${torneio(torneioSel).toUpperCase()}` : ''}</span>
        <h1 className="titulo-xl">Times</h1>
      </div>
      <div className="pills" role="toolbar" aria-label="Filtrar por torneio">
        <button type="button" className="pill" aria-pressed={!torneioSel} onClick={() => setTorneio(null)}>Todos</button>
        {cat?.torneios.map((t) => <button key={t.id} type="button" className="pill" aria-pressed={torneioSel === t.id} onClick={() => setTorneio(t.id)}>{t.nome}</button>)}
      </div>
      <div className="barra-ferramentas">
        <label className="campo-busca"><span className="so-leitor">Buscar time</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar time" />
        </label>
        <span className="segmentado" role="group" aria-label="Ordenar">
          {([['partidas', 'Mais mapas'], ['vitoria', 'Mais vitórias'], ['nome', 'A–Z']] as const).map(([k, t]) => (
            <button key={k} type="button" aria-pressed={ordem === k} onClick={() => setOrdem(k)}>{t}</button>
          ))}
        </span>
      </div>
      {r.erro ? <ErroDados erro={r.erro} recarregar={r.recarregar} /> : !r.dados ? <Carregando altura={120} linhas={3} /> : lista.length === 0 ? <Vazio titulo="Nenhum time encontrado" /> : (
        <div className="grade grade-4">
          {lista.map((t) => (
            <Link key={t.id} para={`/times/${encodeURIComponent(t.id)}`} className="cartao cartao--link cartao-time" style={estiloTime(t.nome)}>
              <div className="cartao-time__topo">
                <SeloTime nome={t.nome} tamanho="g" />
                <span className="cartao-time__nome"><b>{nomeTime(t.nome)}</b><span className="apagado mono">{t.partidas} MAPAS</span></span>
              </div>
              <div className="cartao-time__numeros">
                <span><b className="num">{t.vitorias}</b><span className="rotulo">V</span></span>
                <span><b className="num">{t.derrotas}</b><span className="rotulo">D</span></span>
                <span><b className="num cor-time">{pct(t.taxa_vitoria_pct, 0)}</b><span className="rotulo">VITÓRIAS</span></span>
              </div>
              <span className="barra barra--time"><span style={{ width: `${t.taxa_vitoria_pct ?? 0}%` }} /></span>
            </Link>
          ))}
        </div>
      )}
      <FonteDados meta={r.dados?.meta} />
    </main>
  );
}
