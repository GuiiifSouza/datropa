/** Peças visuais pequenas: agente, selo de time, estados de carregamento/erro/vazio, fonte dos dados. */
import { type ReactNode } from 'react';
import { ErroApi } from '../api/cliente';
import type { Meta } from '../api/tipos';
import { nomeTime, sigla, slugAgente } from '../util/formato';
import { useCatalogo } from './Catalogo';
import { Link } from '../rotas';
import { rostoAgente } from '../util/arteAgentes';

// Mesma arte já publicada para a prancheta; 0 permite desligá-la explicitamente.
const ARTE = import.meta.env.VITE_ARTE_RIOT !== '0';
const COR_CLASSE: Record<string, string> = { Duelista: '#FF4655', Iniciador: '#F9A23B', Controlador: '#9AA6B2', Sentinela: '#32E0C4' };

export function Agente({ id, tamanho = 'm', mostrarNome }: { id: string | null | undefined; tamanho?: 'p' | 'm' | 'g'; mostrarNome?: boolean }) {
  const { agente, classe } = useCatalogo();
  const nome = agente(id);
  const rosto = ARTE ? rostoAgente(slugAgente(nome)) : null;
  const cor = COR_CLASSE[classe(id) ?? ''] ?? 'var(--linha-forte)';
  const bolinha = (
    <span className={`agente agente--${tamanho}`} style={{ borderColor: cor, ...rosto }} title={nome} aria-label={mostrarNome ? undefined : nome} role={mostrarNome ? undefined : 'img'}>
      {!rosto && nome.slice(0, 2).toUpperCase()}
    </span>
  );
  if (!mostrarNome) return bolinha;
  return <span className="agente-nome">{bolinha}<span>{nome}</span></span>;
}

export function SeloTime({ nome, lado, grande }: { nome: string | null | undefined; lado?: 'a' | 'b' | 'neutro'; grande?: boolean }) {
  return (
    <span className={`selo-time${lado === 'b' ? ' selo-time--b' : lado === 'neutro' ? ' selo-time--neutro' : ''}${grande ? ' selo-time--g' : ''}`} aria-hidden="true">
      {sigla(nome)}
    </span>
  );
}

export function LinkTime({ id, nome, lado, className }: { id: string; nome: string; lado?: 'a' | 'b' | 'neutro'; className?: string }) {
  return (
    <Link para={`/times/${encodeURIComponent(id)}`} className={`link-time ${className ?? ''}`}>
      <SeloTime nome={nome} lado={lado} />
      <span>{nomeTime(nome)}</span>
    </Link>
  );
}

export function Carregando({ altura = 240, linhas = 1 }: { altura?: number; linhas?: number }) {
  return (
    <div className="grade" aria-busy="true" aria-live="polite">
      <span className="so-leitor">Carregando…</span>
      {Array.from({ length: linhas }, (_, i) => <div key={i} className="esqueleto" style={{ height: altura }} />)}
    </div>
  );
}

export function ErroDados({ erro, recarregar }: { erro: unknown; recarregar?: () => void }) {
  const e = erro instanceof ErroApi ? erro : null;
  const naoAchou = e?.status === 404;
  return (
    <div className="estado estado--erro" role="alert">
      <b className="titulo-s">{naoAchou ? 'Não encontramos isso na base' : 'Não deu para carregar'}</b>
      <span>{naoAchou ? 'Confira o link ou volte para a lista.' : e?.status === 429 ? `Muitas consultas seguidas. Tente de novo em ${e.retryAfter ?? 30} s.` : 'Tente de novo em instantes.'}</span>
      {naoAchou ? <Link para="/" className="botao botao--linha botao--pequeno">Ir para o Panorama</Link>
        : recarregar && <button type="button" className="botao botao--linha botao--pequeno" onClick={recarregar}>Tentar de novo</button>}
    </div>
  );
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return <div className="estado"><b className="titulo-s">{titulo}</b>{children && <span>{children}</span>}</div>;
}

export function FonteDados({ meta, extra }: { meta?: Meta; extra?: string }) {
  if (!meta) return null;
  const snap = meta.fonte === 'snapshot';
  return (
    <span className={`fonte-dados${snap ? ' fonte-dados--snapshot' : ''}`} title={snap ? 'Dados do snapshot gerado dos JSONs oficiais. Troca sozinho para a API quando a rota subir.' : 'Dados da API /api/stats'}>
      <i aria-hidden="true" />{snap ? 'SNAPSHOT DA BASE' : 'API AO VIVO'}{extra ? ` · ${extra}` : ''}
    </span>
  );
}
