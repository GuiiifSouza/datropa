import { CORES_LOGO } from './coresTimes';

/** Logos fornecidas e autorizadas pela equipe. Aliases explícitos evitam confundir organizações. */
const LOGOS: Record<string, string> = {
  "a2e_uff": "a2e_uff",
  "axis_anteaters": "axis_anteaters",
  "azure_bears": "azure_bears",
  "caap_hellhounds": "caap_hellhounds",
  "caap_malditos": "caap_malditos",
  "ceub_octopus": "ceub_octopus",
  "fametro_berserkers": "fametro_berserkers",
  "fei_darkowls": "fei_darkowls",
  "fei_whiteowls": "fei_whiteowls",
  "furia": "furia",
  "green_owls": "green_owls",
  "inatel": "inatel",
  "inatel_legacy": "inatel_legacy",
  "incinera": "incinera",
  "macklogic_rainbow": "macklogic_rainbow",
  "macklogic_red": "macklogic_red",
  "macklogic_white": "macklogic_white",
  "maua_blue": "maua_blue",
  "milionaria_ufam": "milionaria_ufam",
  "octacore": "octacore",
  "poli_plague": "poli_plague",
  "pucc_cardinals": "pucc_cardinals",
  "pucgo_sistematica": "pucgo_sistematica",
  "rahnag": "rahnag",
  "tirana": "tirana",
  "totale_umc": "totale_umc",
  "ucb_dogs": "ucb_dogs",
  "ueg_hipertensa": "ueg_hipertensa",
  "uema_turbulencia": "uema_turbulencia",
  "uepa_imperadores": "uepa_imperadores",
  "ufg_eagles": "ufg_eagles",
  "ufma_naotemclutch": "ufma_naotemclutch",
  "ufmt_turuna": "ufmt_turuna",
  "ufpr_bbn": "ufpr_bbn",
  "ufrj_minerva": "ufrj_minerva",
  "ufs_bugados": "ufs_bugados",
  "ufu_saints": "ufu_saints",
  "umfa_acucarados": "umfa_acucarados",
  "undbala": "undbala",
  "unicamp_tritons": "unicamp_tritons",
  "unifacens_fodens": "unifacens_fodens",
  "uninassau_griffins": "uninassau_griffins",
  "unirio_krakens": "unirio_krakens",
  "uscs_hawks": "uscs_hawks",
  "usp_stars": "usp_stars",
  "wolf_gaming": "wolf_gaming",
  "azure_bears_black": "azure_bears",
  "azure_bears_golden": "azure_bears",
  "azure_bears_silver": "azure_bears",
  "azure_bears_white": "azure_bears",
  "ceub_octopus_vulgaris": "ceub_octopus",
  "furia_utfpr": "furia",
  "green_owls_jacurutu": "green_owls",
  "green_owls_noctua": "green_owls",
  "inatel_dois": "inatel",
  "inatel_gray": "inatel",
  "octacore_javascript": "octacore",
  "octacore_python": "octacore",
  "pucgo_sistematica_academy": "sistematica_academy",
  "ufg_eagles_blue": "ufg_eagles",
  "ufg_gc_eagles": "ufg_eagles",
  "ufu_saints_auryn": "ufu_saints",
  "ufu_saints_trigons": "ufu_saints",
  "unicamp_tritons_black": "unicamp_tritons",
  "unicamp_tritons_red": "unicamp_tritons",
  "usp_stars_gc": "usp_stars",
  // mesma organização, outro time: usa a logo da organização
  "axis_aura": "axis_anteaters",
  "caap_auroras": "caap_hellhounds",
  "caap_momentum": "caap_hellhounds",
  "minerva_thunders": "ufrj_minerva",
  "pucc_canaries": "pucc_cardinals",
  // logos recebidas depois (Logos Restantes)
  "brutal_esports": "brutal_esports",
  "fatec_pg": "fatec_pg",
  "gambiarra_ufg": "gambiarra_ufg",
  "gdu_ufpb": "gdu_ufpb",
  "homem_passaro": "homem_passaro",
  "ibmec_sharks": "ibmec_sharks",
  "ime_wolves_red": "ime_wolves_red",
  "liga_vulkanica": "liga_vulkanica",
  "nox_unievangelica": "nox_unievangelica",
  "panterao_gaming": "panterao_gaming",
  "sheriff_iff": "sheriff_iff",
  "sistematica_unievangelica": "sistematica_unievangelica",
  "tigre_branco": "tigre_branco",
  "ufmg_fenix_b": "ufmg_fenix_b",
  "unifesp_erex": "unifesp_erex"
};

const chave = (nome: string | null | undefined) =>
  (nome ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export function logoTime(nome: string | null | undefined): string | null {
  const logo = LOGOS[chave(nome)];
  return logo ? `/logos-times/${logo}.png` : null;
}

/** Tom estável derivado do nome, para times sem logo (sempre a mesma cor para o mesmo time). */
function corDoNome(nome: string): string {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 62% 64%)`;
}

/**
 * Cores do time: as da logo (scripts/cores_logos.py) ou, sem logo, um tom derivado do nome.
 * [principal, secundária]; a secundária repete a principal quando a logo só tem uma cor.
 */
export function coresTime(nome: string | null | undefined): [string, string] {
  const logo = LOGOS[chave(nome)];
  const cs = logo ? CORES_LOGO[logo] : undefined;
  if (cs?.length) return [cs[0], cs[1] ?? cs[0]];
  if (logo) return ['#C5CBD3', '#9AA6B2']; // logo monocromática
  const c = corDoNome(chave(nome) || 'time');
  return [c, c];
}
