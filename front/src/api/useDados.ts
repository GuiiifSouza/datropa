/** Hook de dados com cache em memória (5 min) e deduplicação de chamadas iguais. */
import { useCallback, useEffect, useState } from 'react';

type Entrada = { quando: number; promessa: Promise<unknown>; valor?: unknown; erro?: unknown };
const cache = new Map<string, Entrada>();
const TTL_MS = 5 * 60 * 1000;

function buscar<T>(chave: string, fn: () => Promise<T>, forcar = false): Entrada {
  const atual = cache.get(chave);
  if (atual && !forcar && Date.now() - atual.quando < TTL_MS && !atual.erro) return atual;
  const e: Entrada = { quando: Date.now(), promessa: Promise.resolve() };
  e.promessa = fn().then((v) => { e.valor = v; return v; }, (err) => { e.erro = err; throw err; });
  e.promessa.catch(() => undefined);
  cache.set(chave, e);
  return e;
}

export type Estado<T> = { dados: T | undefined; erro: unknown; carregando: boolean; recarregar: () => void };

/** `chave` null pausa a busca (ex.: falta um parâmetro). */
export function useDados<T>(chave: string | null, fn: () => Promise<T>): Estado<T> {
  const inicial = chave ? cache.get(chave) : undefined;
  const [estado, setEstado] = useState<{ dados?: T; erro?: unknown; chave: string | null }>({
    dados: inicial?.valor as T | undefined, erro: undefined, chave,
  });
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!chave) return;
    let vivo = true;
    const e = buscar(chave, fn, versao > 0);
    if (e.valor !== undefined) setEstado({ dados: e.valor as T, chave });
    else setEstado((s) => ({ dados: s.chave === chave ? s.dados : undefined, chave }));
    e.promessa.then(
      (v) => vivo && setEstado({ dados: v as T, chave }),
      (err) => vivo && setEstado({ erro: err, chave }),
    );
    return () => { vivo = false; };
    // fn muda a cada render; a chave identifica a busca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  const atual = estado.chave === chave;
  return {
    dados: atual ? estado.dados : undefined,
    erro: atual ? estado.erro : undefined,
    carregando: !!chave && (!atual || (estado.dados === undefined && estado.erro === undefined)),
    recarregar,
  };
}

/** Chave estável a partir de partes (objetos viram JSON ordenado). */
export function chave(...partes: unknown[]): string {
  return partes.map((p) => (p && typeof p === 'object' ? JSON.stringify(p, Object.keys(p as object).sort()) : String(p))).join('::');
}
