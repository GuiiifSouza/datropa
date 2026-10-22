/** Catálogos (nomes de mapa, agente e torneio) carregados uma vez e expostos por contexto. */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { dados } from '../api/stats';
import type { Catalogos } from '../api/tipos';
import { useDados } from '../api/useDados';

type Ctx = {
  pronto: boolean;
  cat: Catalogos | undefined;
  mapa: (id: string | null | undefined) => string;
  agente: (id: string | null | undefined) => string;
  classe: (id: string | null | undefined) => string | null;
  torneio: (id: string | null | undefined) => string;
};
const Contexto = createContext<Ctx | null>(null);

export function CatalogoProvider({ children }: { children: ReactNode }) {
  const { dados: r } = useDados('catalogos', () => dados.catalogos());
  const valor = useMemo<Ctx>(() => {
    const cat = r?.data;
    const mapas = new Map(cat?.mapas.map((m) => [m.id, m.nome]));
    const agentes = new Map(cat?.agentes.map((a) => [a.id, a]));
    const torneios = new Map(cat?.torneios.map((t) => [t.id, t.nome]));
    return {
      pronto: !!cat, cat,
      mapa: (id) => (id ? mapas.get(id) ?? id.charAt(0).toUpperCase() + id.slice(1) : '—'),
      agente: (id) => (id ? agentes.get(id)?.nome ?? 'Agente' : '—'),
      classe: (id) => (id ? agentes.get(id)?.classe ?? null : null),
      torneio: (id) => (id ? torneios.get(id) ?? id : '—'),
    };
  }, [r]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCatalogo(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error('useCatalogo fora do CatalogoProvider');
  return c;
}
