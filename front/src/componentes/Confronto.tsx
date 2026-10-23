/**
 * Histórico do confronto, dentro da partida: as outras séries entre os dois times e, sempre,
 * a comparação das campanhas (vitória por mapa e lado forte). Sem jogo anterior, vira "Primeiro encontro".
 */
import type { CSSProperties } from 'react';
import { dados } from '../api/stats';
import { useDados } from '../api/useDados';
import type { TimeDetalhe } from '../api/tipos';
import { Link } from '../rotas';
import { coresTime } from '../util/logosTimes';
import { nomeTime, pct } from '../util/formato';
import { useCatalogo } from './Catalogo';
import { CartaoSerie } from './Series';
import { Carregando, SeloTime } from './Visuais';

type TimeRef = { id: string; nome: string };

export function Confronto({ A, B, partidaId }: { A: TimeRef; B: TimeRef; partidaId: string }) {
  const sa = useDados(`series:time:${A.id}`, () => dados.series({ time_id: A.id }));
  const ta = useDados(`time:${A.id}:`, () => dados.time(A.id));
  const tb = useDados(`time:${B.id}:`, () => dados.time(B.id));
  const entre = (sa.dados ?? []).filter((s) => (s.time_a.id === B.id || s.time_b.id === B.id));
  const anteriores = entre.filter((s) => !s.mapas.some((m) => m.partida_id === partidaId));
  // placar somado de séries, do ponto de vista do A desta página
  const tot = entre.reduce((acc, s) => {
    const souA = s.time_a.id === A.id;
    const meu = souA ? s.vitorias_a : s.vitorias_b, deles = souA ? s.vitorias_b : s.vitorias_a;
    return { a: acc.a + (meu > deles ? 1 : 0), b: acc.b + (deles > meu ? 1 : 0), ma: acc.ma + meu, mb: acc.mb + deles };
  }, { a: 0, b: 0, ma: 0, mb: 0 });
  const primeiro = sa.dados && anteriores.length === 0;

  return (
    <section className="confronto-h2h" style={{ '--c-a': coresTime(A.nome)[0], '--c-b': coresTime(B.nome)[0] } as CSSProperties}>
      <div className="confronto-h2h__topo">
        <SeloTime nome={A.nome} tamanho="g" />
        <div className="cabeca" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="rotulo rotulo--ambar">{primeiro ? 'PRIMEIRO ENCONTRO NA BASE' : 'HISTÓRICO DO CONFRONTO'}</span>
          {sa.dados && !primeiro ? (
            <>
              <b className="num confronto-h2h__placar"><span className="cor-a">{tot.a}</span><span className="apagado-2">–</span><span className="cor-b">{tot.b}</span></b>
              <span className="mono apagado" style={{ fontSize: 11 }}>EM SÉRIES · MAPAS {tot.ma}–{tot.mb}</span>
            </>
          ) : <b className="titulo-m">{nomeTime(A.nome)} × {nomeTime(B.nome)}</b>}
        </div>
        <SeloTime nome={B.nome} tamanho="g" />
      </div>

      {!sa.dados ? <Carregando altura={80} /> : anteriores.length > 0 && (
        <div className="confronto-h2h__series">
          <span className="rotulo">OUTRAS SÉRIES ENTRE ELES</span>
          {anteriores.slice(0, 4).map((s) => <CartaoSerie key={s.id} s={s} mostrarTorneio />)}
        </div>
      )}

      {ta.dados && tb.dados ? <Campanhas A={ta.dados.data} B={tb.dados.data} primeiro={!!primeiro} /> : <Carregando altura={160} />}
    </section>
  );
}

function Campanhas({ A, B, primeiro }: { A: TimeDetalhe; B: TimeDetalhe; primeiro: boolean }) {
  const { mapa } = useCatalogo();
  const ids = [...new Set([...A.mapas.map((m) => m.mapa_id), ...B.mapas.map((m) => m.mapa_id)])];
  const de = (t: TimeDetalhe, id: string) => t.mapas.find((m) => m.mapa_id === id);
  const linhas = ids.map((id) => ({ id, a: de(A, id), b: de(B, id) }))
    .filter((l) => l.a || l.b)
    .sort((x, y) => Math.abs((y.a?.taxa_vitoria_pct ?? 50) - (y.b?.taxa_vitoria_pct ?? 50)) - Math.abs((x.a?.taxa_vitoria_pct ?? 50) - (x.b?.taxa_vitoria_pct ?? 50)))
    .slice(0, 6);
  const maiorDif = linhas.find((l) => l.a && l.b);
  const lado = (t: TimeDetalhe, l: 'ataque' | 'defesa') => t.lados.find((x) => x.lado === l)?.taxa_vitoria_pct ?? null;
  return (
    <div className="grade grade-2">
      <div className="cartao">
        <div className="secao-topo"><span className="titulo-s">Vitória por mapa</span><span className="apagado mono" style={{ fontSize: 10 }}>CAMPANHA TODA DE CADA UM</span></div>
        {linhas.map((l) => (
          <div key={l.id} className="espelho-linha espelho-linha--compacta">
            <b className="num espelho-linha__v cor-a">{l.a ? pct(l.a.taxa_vitoria_pct, 0) : '—'}</b>
            <span className="espelho-linha__trilho espelho-linha__trilho--a"><span style={{ width: `${l.a?.taxa_vitoria_pct ?? 0}%` }} /></span>
            <Link para={`/mapas/${encodeURIComponent(l.id)}`} className="espelho-linha__nome"><b>{mapa(l.id)}</b><span className="mono apagado">{l.a?.partidas ?? 0} × {l.b?.partidas ?? 0} MAPAS</span></Link>
            <span className="espelho-linha__trilho espelho-linha__trilho--b"><span style={{ width: `${l.b?.taxa_vitoria_pct ?? 0}%` }} /></span>
            <b className="num espelho-linha__v espelho-linha__v--b cor-b">{l.b ? pct(l.b.taxa_vitoria_pct, 0) : '—'}</b>
          </div>
        ))}
        {maiorDif && <span className="apagado" style={{ fontSize: 12, textAlign: 'center' }}>{mapa(maiorDif.id)} é o mapa que mais separa os dois{primeiro ? ': bom lugar para o veto.' : '.'}</span>}
      </div>
      <div className="cartao">
        <span className="titulo-s">Lado forte</span>
        {[A, B].map((t, i) => (
          <div key={t.id} className="lado-forte">
            <span className="lado-forte__time"><SeloTime nome={t.nome} tamanho="p" /><b>{nomeTime(t.nome)}</b></span>
            <span className="lado-forte__caixa lado-forte__caixa--atk"><span className="rotulo">ATAQUE</span><b className="num">{pct(lado(t, 'ataque'), 0)}</b></span>
            <span className="lado-forte__caixa lado-forte__caixa--def"><span className="rotulo">DEFESA</span><b className="num">{pct(lado(t, 'defesa'), 0)}</b></span>
            <span className={`mono lado-forte__selo ${i === 0 ? 'cor-a' : 'cor-b'}`}>{(lado(t, 'ataque') ?? 0) >= (lado(t, 'defesa') ?? 0) ? 'ATACA MELHOR' : 'DEFENDE MELHOR'}</span>
          </div>
        ))}
        <span className="apagado" style={{ fontSize: 12 }}>Rounds vencidos em cada lado, somando a campanha toda.</span>
      </div>
    </div>
  );
}
