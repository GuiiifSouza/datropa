/**
 * Tipos do contrato de docs/api.md (v0.2). Campos marcados "extra" ainda não estão no contrato:
 * o snapshot já entrega, e a API pode passar a entregar (pedidos em front/docs/pedidos.md).
 * Quando a API real não manda um extra, a tela mostra "—".
 */

export type Fonte = 'api' | 'snapshot';
export type Meta = { atualizado_em: string | null; fonte?: Fonte };
export type Paginacao = { page: number; page_size: number; total: number };
export type Lista<T> = { data: T[]; pagination: Paginacao; meta: Meta };
export type Objeto<T> = { data: T; meta: Meta };

export type Filtros = {
  torneio_id?: string;
  mapa_id?: string;
  data_inicio?: string;
  data_fim?: string;
};

// ---------- catálogos ----------
export type Transformacao = { u_x: number; u_y: number; u_offset: number; v_x: number; v_y: number; v_offset: number };
export type Catalogos = {
  torneios: { id: string; nome: string }[];
  mapas: { id: string; nome: string; minimapa_url?: string | null; transformacao: Transformacao | null }[];
  agentes: { id: string; uuid: string; nome: string | null; classe?: string | null; icone_url?: string | null }[];
  armas: { id: string; uuid: string; nome: string | null; icone_url?: string | null }[];
};

// ---------- ranking e jogador ----------
export type RankingItem = {
  jogador_id: string;
  nome: string;
  time_id: string | null;
  partidas: number;
  rounds: number;
  kills: number;
  deaths: number;
  assists: number;
  kd: number | null;
  adr: number | null;
  hs_pct: number | null;
  first_bloods: number;
  // extras
  acs?: number | null;
  kast_pct?: number | null;
  first_deaths?: number;
  vitorias?: number;
  taxa_vitoria_pct?: number | null;
  multikills?: { k3: number; k4: number; k5: number };
  agentes_top?: string[];
};
export type OrdemRanking = 'kills_desc' | 'kd_desc' | 'adr_desc' | 'acs_desc' | 'kast_desc' | 'fb_desc' | 'hs_desc';

export type ResumoJogador = Omit<RankingItem, 'jogador_id' | 'nome' | 'time_id' | 'agentes_top'>;
export type JogadorDetalhe = {
  id: string;
  nome: string;
  tag?: string | null;
  times: { id: string; nome: string }[];
  resumo: ResumoJogador;
  agentes: { agente_id: string; partidas: number; vitorias: number; taxa_vitoria_pct: number | null; kd?: number | null; acs?: number | null }[];
  mapas: { mapa_id: string; partidas: number; vitorias: number; taxa_vitoria_pct: number | null; acs?: number | null }[];
  // extra
  partidas_recentes?: {
    partida_id: string; mapa_id: string; inicio: string | null; time_id: string; adversario_id: string;
    agente_id: string; kills: number; deaths: number; assists: number; acs: number | null; venceu: boolean; placar: [number, number];
  }[];
};

// ---------- times ----------
export type TimeItem = { id: string; nome: string; partidas: number; vitorias: number; derrotas: number; empates: number; taxa_vitoria_pct: number | null };
export type Lado = { lado: 'ataque' | 'defesa'; rounds_jogados: number; rounds_ganhos: number; taxa_vitoria_pct: number | null };
export type TimeDetalhe = {
  id: string;
  nome: string;
  resumo: { partidas: number; vitorias: number; derrotas: number; empates: number; taxa_vitoria_pct: number | null; rounds_jogados: number; rounds_ganhos: number };
  lados: Lado[];
  mapas: { mapa_id: string; partidas: number; vitorias: number; taxa_vitoria_pct: number | null }[];
};
export type CompraTipo = 'pistol' | 'eco' | 'force' | 'full';
export type Economia = {
  time_id: string;
  categorias: { tipo: CompraTipo; rounds: number; vitorias: number; taxa_vitoria_pct: number | null }[];
  classificacao_versao: string;
  rounds_sem_classificacao: number;
};
export type PosPlant = {
  time_id: string;
  pos_plant: { oportunidades: number; vitorias: number; taxa_sucesso_pct: number | null };
  retake: { oportunidades: number; vitorias: number; taxa_sucesso_pct: number | null };
};
export type Composicao = { composicao_id: string; mapa_id: string; agente_ids: string[]; aparicoes: number; vitorias: number; taxa_vitoria_pct: number | null };
export type Comparacao = {
  time_a: { id: string; partidas: number; vitorias: number; taxa_vitoria_pct: number | null };
  time_b: { id: string; partidas: number; vitorias: number; taxa_vitoria_pct: number | null };
  confrontos_diretos: { partidas: number; vitorias_a: number; vitorias_b: number; empates: number };
};

// ---------- partidas ----------
export type TimePlacar = { id: string; nome: string; rounds_ganhos: number };
export type PartidaItem = {
  id: string;
  torneio_id: string;
  mapa_id: string;
  inicio: string | null;
  times: [TimePlacar, TimePlacar];
  vencedor_id: string | null;
  // extras
  rounds?: number;
  duracao_ms?: number | null;
};
export type ResultadoRound = 'eliminacao' | 'detonacao' | 'desarme' | 'tempo' | 'outro';
export type RoundDetalhe = {
  round: number;
  vencedor_id: string | null;
  lado_vencedor: 'ataque' | 'defesa' | null;
  resultado: ResultadoRound | null;
  // extras
  atacante_id?: string | null;
  plant_site?: string | null;
  compras?: Record<string, CompraTipo>;
  equipamento?: Record<string, number>;
  placar?: Record<string, number>;
  first_blood_time_id?: string | null;
};
export type JogadorPartida = {
  jogador_id: string;
  nome: string;
  time_id: string;
  agente_id: string;
  kills: number;
  deaths: number;
  assists: number;
  adr: number | null;
  hs_pct: number | null;
  first_bloods: number;
  // extras
  acs?: number | null;
  kast_pct?: number | null;
  first_deaths?: number;
  multikills?: { k3: number; k4: number; k5: number };
};
export type PosicaoEvento = { x: number; y: number };
export type EventoRound = {
  id: string;
  ordem: number;
  tipo: 'abate' | 'plant' | 'defuse';
  tempo_ms: number | null;
  ator_id: string | null;
  vitima_id: string | null;
  site: string | null;
  ator_time_id: string | null;
  vitima_time_id: string | null;
  posicao: PosicaoEvento | null;
  jogadores: { jogador_id: string; time_id: string | null; agente_id: string | null; posicao: PosicaoEvento | null }[];
};
export type EventosRound = { partida_id: string; mapa_id: string; round: number; eventos: EventoRound[] };
export type PartidaDetalhe = Omit<PartidaItem, 'rounds'> & {
  jogadores: JogadorPartida[];
  rounds: RoundDetalhe[];
  mvp_jogador_id: string | null;
  rounds_decisivos: number[];
  versao?: string | null;
};

// ---------- extras só do front (snapshot) ----------
export type Serie = {
  id: string;
  torneio_id: string;
  dia: string | null;
  time_a: { id: string; nome: string };
  time_b: { id: string; nome: string };
  vitorias_a: number;
  vitorias_b: number;
  mapas: { partida_id: string; mapa_id: string; placar_a: number; placar_b: number; inicio: string | null; prorrogacao: boolean }[];
};
export type AgenteMeta = { agente_id: string; aparicoes: number; vitorias: number; taxa_vitoria_pct: number | null; pick_pct: number | null; kd: number | null; acs: number | null };
export type MapaMeta = {
  mapa_id: string; partidas: number; prorrogacoes: number; rounds: number;
  ataque_pct: number | null; plants: Record<string, number>; agentes_top: { agente_id: string; aparicoes: number }[];
};
export type Panorama = {
  partidas: number; times: number; jogadores: number; rounds: number; kills: number; torneios: number;
  prorrogacoes: number; duracao_media_min: number | null; ataque_pct: number | null; fb_conversao_pct: number | null;
  plant_pct: number | null; periodo: [string | null, string | null];
  economia: { tipo: CompraTipo; rounds: number; vitorias: number; taxa_vitoria_pct: number | null }[];
  resultados: { resultado: ResultadoRound; rounds: number }[];
  por_torneio: { torneio_id: string; partidas: number; dia_inicio: string | null; dia_fim: string | null }[];
};
export type MetaCena = {
  agentes: AgenteMeta[];
  mapas: MapaMeta[];
  armas: { arma_id: string; nome: string; kills: number }[];
  economia: Panorama['economia'];
  composicoes: Composicao[];
};
