"""scouting_time: tendências de um adversário num pacote só.

Junta, sem SQL novo, as consultas de stats_time, composicoes, economia_time e
pos_plant_retake: mapas (onde joga e onde vence), lado forte, composições por
mapa, economia, pós-plant/retake, sites preferidos e jogadores-chave. As
consultas rodam em paralelo para a resposta não demorar.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from .. import catalogos
from . import ErroTool, resolver_mapa, taxa, tool
from .composicoes import AGREGADO as COMPOSICOES
from .composicoes import formatar as formatar_composicao
from .economia_time import POR_CATEGORIA as ECONOMIA
from .economia_time import resumo_categorias
from .pos_plant_retake import POR_SITE, TOTAIS as POS_PLANT
from .pos_plant_retake import sites_por_mapa
from .stats_time import ELENCO, RESUMO

# Diferença mínima (pontos percentuais) entre ataque e defesa para chamar um lado de forte.
# Critério de apresentação, dito nas notas.
DIFERENCA_LADO_PP = 5.0


def _lado_forte(ataque: float | None, defesa: float | None) -> str | None:
    if ataque is None or defesa is None:
        return None
    if abs(ataque - defesa) < DIFERENCA_LADO_PP:
        return "equilibrado"
    return "ataque" if ataque > defesa else "defesa"


def _site_preferido(lados: dict, lado: str) -> dict | None:
    sites = (lados.get(lado) or {}).get("sites") or []
    if not sites:
        return None
    s = sites[0]
    total = sum(x["plants"] for x in sites)
    saida = {"site": s["site"], "plants": s["plants"], "pct_dos_plants": taxa(s["plants"], total)}
    empatados = [x["site"] for x in sites[1:] if x["plants"] == s["plants"]]
    if empatados:
        saida["empatado_com"] = empatados
    return saida


@tool(
    nome="scouting_time",
    descricao=(
        "Relatório de scouting de um time (para estudar um adversário): mapas que mais joga e onde "
        "vence ou perde, lado forte (ataque ou defesa) geral e por mapa, composição mais usada em "
        "cada mapa, economia (pistol, eco, force, full), pós-plant e retake, site onde mais planta, "
        "e jogadores-chave (K/D e first bloods). Filtro opcional de mapa. Use quando pedirem para "
        "analisar, estudar ou se preparar contra um time. Precisa do time_id de buscar_entidade."
    ),
    parametros={
        "type": "object",
        "properties": {
            "time_id": {"type": "string", "description": "id do time (campo id de buscar_entidade)."},
            "mapa": {"type": "string", "description": "Nome do mapa, ex.: Lotus, Ascent. Opcional."},
        },
        "required": ["time_id"],
    },
)
def scouting_time(time_id: str, mapa: str | None = None) -> dict:
    m = resolver_mapa(mapa)
    v = {"time_id": time_id, "mapa_id": m}
    with ThreadPoolExecutor(max_workers=6) as ex:
        f_resumo = ex.submit(RESUMO.rodar, **v)
        f_elenco = ex.submit(ELENCO.rodar, **v)
        f_comp = ex.submit(COMPOSICOES.rodar, **v)
        f_eco = ex.submit(ECONOMIA.rodar, **v)
        f_pp = ex.submit(POS_PLANT.rodar, **v)
        f_site = ex.submit(POR_SITE.rodar, **v)
        resumo, elenco, comps = f_resumo.result(), f_elenco.result(), f_comp.result()
        eco, pp, sites = f_eco.result(), f_pp.result(), sites_por_mapa(f_site.result())

    geral = next((l for l in resumo if l["escopo"] == "geral"), None)
    if geral is None:
        raise ErroTool("time não encontrado (confira o id com buscar_entidade)")
    mapas_resumo = [l for l in resumo if l["escopo"] == "mapa"]
    if m and not mapas_resumo:
        raise ErroTool(f"o time não jogou {catalogos.nome_mapa(m)} na base")

    pp_mapa = {l["mapa_id"]: l for l in pp if not l["geral"]}
    pp_geral = next((l for l in pp if l["geral"]), None)
    comps_mapa: dict[str, list] = {}
    for c in comps:
        comps_mapa.setdefault(c["mapa_id"], []).append(c)

    mapas = []
    for l in mapas_resumo:
        mid = l["mapa_id"]
        p = pp_mapa.get(mid)
        top = comps_mapa.get(mid, [])
        mapas.append({
            "mapa": catalogos.nome_mapa(mid),
            "partidas": l["partidas"], "vitorias": l["vitorias"], "derrotas": l["derrotas"],
            "taxa_vitoria_pct": l["taxa_vitoria_pct"], "taxa_rounds_pct": l["taxa_rounds_pct"],
            "taxa_ataque_pct": l["taxa_ataque_pct"], "taxa_defesa_pct": l["taxa_defesa_pct"],
            "lado_forte": _lado_forte(l["taxa_ataque_pct"], l["taxa_defesa_pct"]),
            "composicao_mais_usada": formatar_composicao(top[0]) if top else None,
            "outras_composicoes": len(top) - 1 if top else 0,
            "pos_plant_taxa_pct": taxa(p["pos_plant_vitorias"], p["pos_plant_oportunidades"]) if p else None,
            "retake_taxa_pct": taxa(p["retake_vitorias"], p["retake_oportunidades"]) if p else None,
            "site_preferido_ataque": _site_preferido(sites.get(mid, {}), "ataque"),
            "pct_rounds_ataque_com_plant": (sites.get(mid, {}).get("ataque") or {}).get("pct_rounds_com_plant"),
        })

    for j in elenco:
        ident = j.pop("identidade")
        j["jogador"] = f"{ident['nome']}#{ident['tag']}" if ident["tag"] else ident["nome"]
        uuid = j.pop("agente_principal_id")
        j["agente_principal"] = catalogos.nome_agente(uuid)
        j["agente_principal_classe"] = catalogos.classe_agente(uuid)
    chave = [
        {k: j[k] for k in ("jogador", "partidas", "kd", "adr", "first_bloods", "first_deaths",
                           "agente_principal", "agente_principal_classe")}
        for j in elenco
    ]

    economia = resumo_categorias(eco)
    return {
        "time": geral["nome"],
        "filtros": {"mapa": catalogos.nome_mapa(m)},
        "geral": {
            "partidas": geral["partidas"], "vitorias": geral["vitorias"], "derrotas": geral["derrotas"],
            "taxa_vitoria_pct": geral["taxa_vitoria_pct"], "taxa_rounds_pct": geral["taxa_rounds_pct"],
            "taxa_ataque_pct": geral["taxa_ataque_pct"], "taxa_defesa_pct": geral["taxa_defesa_pct"],
            "lado_forte": _lado_forte(geral["taxa_ataque_pct"], geral["taxa_defesa_pct"]),
        },
        "mapas": mapas,
        "economia": {k: economia.get(k) for k in ("rounds", "rounds_sem_classificacao", "por_categoria")},
        "pos_plant_retake": {
            "pos_plant_oportunidades": pp_geral["pos_plant_oportunidades"] if pp_geral else None,
            "pos_plant_taxa_pct": taxa(pp_geral["pos_plant_vitorias"], pp_geral["pos_plant_oportunidades"])
            if pp_geral else None,
            "retake_oportunidades": pp_geral["retake_oportunidades"] if pp_geral else None,
            "retake_taxa_pct": taxa(pp_geral["retake_vitorias"], pp_geral["retake_oportunidades"])
            if pp_geral else None,
        },
        "jogadores": chave,
        "amostra_pequena": geral["partidas"] < 3,
        "notas": "geral é o total do time em todas as partidas (não muda com o filtro de mapa); o resto "
                 "respeita o filtro. lado_forte = lado com taxa de rounds pelo menos 5 pontos maior; "
                 "abaixo disso, equilibrado. composicao_mais_usada = a mais frequente do time no mapa. "
                 "site_preferido_ataque = onde o time mais plantou. jogadores = elenco ordenado por "
                 "partidas. Taxas em 0-100; null = indisponível. Para detalhes, use economia_time, "
                 "pos_plant_retake ou composicoes.",
    }
