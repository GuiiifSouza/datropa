/** Peças visuais pequenas: agente, selo de time, estados de carregamento/erro/vazio, fonte dos dados. */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { ErroApi } from '../api/cliente';
import type { Meta } from '../api/tipos';
import { nomeTime, sigla, slugAgente } from '../util/formato';
import { useCatalogo } from './Catalogo';
import { Link } from '../rotas';
import { bustoAgente, COR_AGENTE, corpoAgente } from '../util/arteAgentes';
import { coresTime, logoTime } from '../util/logosTimes';

// Mesma arte já publicada para a prancheta; 0 permite desligá-la explicitamente.
const ARTE = import.meta.env.VITE_ARTE_RIOT !== '0';
const COR_CLASSE: Record<string, string> = { Duelista: '#FF4655', Iniciador: '#F9A23B', Controlador: '#9AA6B2', Sentinela: '#32E0C4' };

/**
 * Agente como na logo dos times: busto recortado, sem círculo, com sombra e brilho na cor da função.
 * Sem arte (ou VITE_ARTE_RIOT=0), cai na sigla dentro do círculo.
 */
export function Agente({ id, tamanho = 'm', mostrarNome }: { id: string | null | undefined; tamanho?: 'p' | 'm' | 'g'; mostrarNome?: boolean }) {
  const { agente, classe } = useCatalogo();
  const nome = agente(id);
  const busto = ARTE ? bustoAgente(slugAgente(nome)) : null;
  const [falhou, setFalhou] = useState(false);
  const cor = COR_CLASSE[classe(id) ?? ''] ?? 'var(--linha-forte)';
  const comArte = busto && !falhou;
  const bolinha = (
    <span className={`agente agente--${tamanho}${comArte ? ' agente--busto' : ''}`} style={{ '--cor-classe': cor, borderColor: comArte ? undefined : cor } as CSSProperties}
      title={nome} aria-label={mostrarNome ? undefined : nome} role={mostrarNome ? undefined : 'img'}>
      {comArte ? <img src={busto} alt="" decoding="async" onError={() => setFalhou(true)} /> : nome.slice(0, 2).toUpperCase()}
    </span>
  );
  if (!mostrarNome) return bolinha;
  return <span className="agente-nome">{bolinha}<span>{nome}</span></span>;
}

/** Variáveis CSS com as cores do time (--cor-time e --cor-time-2), para fundos e brilhos. */
export function estiloTime(nome: string | null | undefined): CSSProperties {
  const [c1, c2] = coresTime(nome);
  return { '--cor-time': c1, '--cor-time-2': c2 } as CSSProperties;
}

type TamanhoSelo = 'p' | 'm' | 'g' | 'xg';

/**
 * Logo do time sem moldura: a arte aparece inteira, com sombra e um brilho na cor do próprio time.
 * Time sem logo vira uma sigla com a cor derivada do nome. `lado` fica só por compatibilidade.
 */
export function SeloTime({ nome, grande, tamanho }: { nome: string | null | undefined; lado?: 'a' | 'b' | 'neutro'; grande?: boolean; tamanho?: TamanhoSelo }) {
  const logo = logoTime(nome);
  const [falhou, setFalhou] = useState<string | null>(null);
  const t = tamanho ?? (grande ? 'g' : 'm');
  const temLogo = logo && falhou !== logo;
  return (
    <span className={`selo-time selo-time--${t} ${temLogo ? 'selo-time--logo' : 'selo-time--sigla'}`} style={estiloTime(nome)} aria-hidden="true">
      {temLogo ? <img src={logo} alt="" loading="lazy" decoding="async" onError={() => setFalhou(logo)} /> : sigla(nome)}
    </span>
  );
}

/** Retrato de corpo inteiro do agente; não renderiza nada sem arte. */
export function CorpoAgente({ id, className, style }: { id: string | null | undefined; className?: string; style?: CSSProperties }) {
  const { agente } = useCatalogo();
  const slug = slugAgente(agente(id));
  const src = ARTE ? corpoAgente(slug) : null;
  if (!src) return null;
  // Sem loading="lazy": a arte fica atrás de máscaras e camadas, e em iframes (prévia) o lazy às vezes nunca dispara.
  return <img className={`corpo-agente ${className ?? ''}`} src={src} alt="" aria-hidden="true" decoding="async"
    onLoad={(e) => e.currentTarget.classList.add('corpo-agente--pronto')}
    onError={(e) => { e.currentTarget.style.display = 'none'; }}
    style={{ '--cor-agente': COR_AGENTE[slug], ...style } as CSSProperties} />;
}

/** Cor de destaque do agente (para fundos atrás do retrato). */
export function useCorAgente(id: string | null | undefined): string | undefined {
  const { agente } = useCatalogo();
  return COR_AGENTE[slugAgente(agente(id))];
}

export function LinkTime({ id, nome, lado, className }: { id: string; nome: string; lado?: 'a' | 'b' | 'neutro'; className?: string }) {
  return (
    <Link para={`/times/${encodeURIComponent(id)}`} className={`link-time ${className ?? ''}`}>
      <SeloTime nome={nome} lado={lado} tamanho="p" />
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
