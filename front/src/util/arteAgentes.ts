/** Ordem dos retratos em arte/prancheta/agentes.png: 6 colunas, 5 linhas. */
const AGENTES = [
  'astra', 'breach', 'brimstone', 'chamber', 'clove', 'cypher',
  'deadlock', 'fade', 'gekko', 'harbor', 'iso', 'jett',
  'kayo', 'killjoy', 'miks', 'neon', 'omen', 'phoenix',
  'raze', 'reyna', 'sage', 'skye', 'sova', 'tejo',
  'veto', 'viper', 'vyse', 'waylay', 'yoru',
];

export function rostoAgente(slug: string) {
  const i = AGENTES.indexOf(slug);
  if (i < 0) return null; // Não atribuir o rosto de outro agente a um valor desconhecido.
  return {
    backgroundImage: 'url(/arte/prancheta/agentes.png)',
    backgroundSize: '600% 500%',
    backgroundPosition: `${(i % 6) / 5 * 100}% ${Math.floor(i / 6) / 4 * 100}%`,
    backgroundRepeat: 'no-repeat',
  };
}

/** Cor de destaque de cada agente (gradiente oficial clareado para o fundo escuro). */
export const COR_AGENTE: Record<string, string> = {"astra": "#4A29CC", "breach": "#CC5129", "brimstone": "#7086CC", "chamber": "#4896CC", "clove": "#782ECC", "cypher": "#5088CC", "deadlock": "#5A73CC", "fade": "#5575CC", "gekko": "#7A3ECC", "harbor": "#62CCB0", "iso": "#595FCC", "jett": "#3EA1CC", "kayo": "#3652CC", "killjoy": "#AB45CC", "miks": "#7A4BCC", "neon": "#705ACC", "omen": "#7253CC", "phoenix": "#CC5831", "raze": "#CC5135", "reyna": "#CC5AC4", "sage": "#4ECCB5", "skye": "#70CC91", "sova": "#517ECC", "tejo": "#CC6E2B", "veto": "#35BCCC", "viper": "#38CC96", "vyse": "#7436CC", "waylay": "#9761CC", "yoru": "#4355CC"};

/** Retrato de corpo inteiro em public/arte/agentes/corpo (793×720, fundo transparente). */
export function corpoAgente(slug: string): string | null {
  return AGENTES.includes(slug) ? `/arte/agentes/corpo/${slug}.webp` : null;
}

/** Busto recortado (cabeça e ombros, fundo transparente) em public/arte/agentes/busto. */
export function bustoAgente(slug: string): string | null {
  return AGENTES.includes(slug) ? `/arte/agentes/busto/${slug}.webp` : null;
}
