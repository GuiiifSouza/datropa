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
