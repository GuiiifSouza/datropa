"""pos_plant_retake: conversão depois do plant, no ataque e na defesa.

Regra resultado_apos_plant_v1 (services/stats/sql/gold/POS_PLANT_RETAKE.md):
- pós-plant: rounds em que o time atacava e plantou; vitória = ataque venceu;
- retake: rounds em que o time defendia e sofreu plant; vitória = defesa venceu
  (por desarme ou por tempo). Mede resultado, não prova tentativa de retake.
Somas por time/partida e taxas recalculadas pelos totais, nunca média de taxas.
"""

from __future__ import annotations

from .. import catalogos
from ..bq import Consulta
from . import ErroTool, resolver_mapa, taxa, tool

_TIPOS = {"time_id": "STRING", "mapa_id": "STRING"}
_EXEMPLO = {"time_id": "exemplo", "mapa_id": None}

TOTAIS = Consulta(
    nome="pos_plant_retake.totais",
    tipos=_TIPOS,
    exemplo=_EXEMPLO,
    sql=lambda t: f"""
SELECT mapa_id, GROUPING(mapa_id) = 1 AS geral,
  COUNT(DISTINCT partida_id) AS partidas,
  SUM(pos_plant_oportunidades) AS pos_plant_oportunidades,
  SUM(pos_plant_vitorias) AS pos_plant_vitorias,
  SUM(retake_oportunidades) AS retake_oportunidades,
  SUM(retake_vitorias) AS retake_vitorias,
  SUM(desarmes) AS desarmes,
  SUM(vitorias_defesa_pos_plant_por_tempo) AS vitorias_defesa_pos_plant_por_tempo,
  COUNTIF(status_qualidade != 'ok') AS registros_com_alerta
FROM {t("pos_plant_retake_partida")}
WHERE time_id = @time_id AND (@mapa_id IS NULL OR mapa_id = @mapa_id)
GROUP BY GROUPING SETS ((), (mapa_id))
""",
)

# Rounds do time por mapa, lado e site do plant (site NULL = round sem plant).
POR_SITE = Consulta(
    nome="pos_plant_retake.por_site",
    tipos=_TIPOS,
    exemplo=_EXEMPLO,
    sql=lambda t: f"""
SELECT mapa_id, IF(atacante_id = @time_id, 'ataque', 'defesa') AS lado, plant_site AS site,
  COUNT(*) AS rounds, COUNTIF(vencedor_id = @time_id) AS vitorias
FROM {t("rounds")}
WHERE @time_id IN (atacante_id, defensor_id) AND (@mapa_id IS NULL OR mapa_id = @mapa_id)
GROUP BY 1, 2, 3
""",
)


def _bloco(l: dict) -> dict:
    alerta = l["registros_com_alerta"] > 0
    return {
        "partidas": l["partidas"],
        "pos_plant": {
            "oportunidades": l["pos_plant_oportunidades"], "vitorias": l["pos_plant_vitorias"],
            "taxa_sucesso_pct": None if alerta else taxa(l["pos_plant_vitorias"], l["pos_plant_oportunidades"]),
        },
        "retake": {
            "oportunidades": l["retake_oportunidades"], "vitorias": l["retake_vitorias"],
            "taxa_sucesso_pct": None if alerta else taxa(l["retake_vitorias"], l["retake_oportunidades"]),
            "desarmes": l["desarmes"],
            "vitorias_por_tempo": l["vitorias_defesa_pos_plant_por_tempo"],
        },
        "registros_com_alerta": l["registros_com_alerta"],
    }


def sites_por_mapa(linhas: list[dict]) -> dict[str, dict]:
    """mapa_id -> {ataque: {...}, defesa: {...}} com plants por site e taxa de plant."""
    saida: dict[str, dict] = {}
    for l in linhas:
        lado = saida.setdefault(l["mapa_id"], {}).setdefault(
            l["lado"], {"rounds": 0, "rounds_com_plant": 0, "sites": []})
        lado["rounds"] += l["rounds"]
        if l["site"]:
            lado["rounds_com_plant"] += l["rounds"]
            lado["sites"].append({"site": l["site"], "plants": l["rounds"], "vitorias": l["vitorias"],
                                  "taxa_vitoria_pct": taxa(l["vitorias"], l["rounds"])})
    for lados in saida.values():
        for lado in lados.values():
            lado["pct_rounds_com_plant"] = taxa(lado["rounds_com_plant"], lado["rounds"])
            lado["sites"].sort(key=lambda s: (-s["plants"], s["site"]))
    return saida


@tool(
    nome="pos_plant_retake",
    descricao=(
        "Pós-plant e retake de um time: no ataque, quantas vezes plantou e quanto converteu "
        "depois do plant; na defesa, quantas vezes sofreu plant e quanto venceu mesmo assim "
        "(desarme ou tempo). Traz também, por mapa, a frequência de plant e os sites onde o "
        "time mais planta (ataque) e mais sofre plant (defesa). Filtro opcional de mapa. "
        "Precisa do time_id devolvido por buscar_entidade."
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
def pos_plant_retake(time_id: str, mapa: str | None = None) -> dict:
    m = resolver_mapa(mapa)
    linhas = TOTAIS.rodar(time_id=time_id, mapa_id=m)
    geral = next((l for l in linhas if l["geral"]), None)
    if geral is None or not geral["partidas"]:
        raise ErroTool("nenhuma partida desse time nesse recorte (confira o id com buscar_entidade)")

    sites = sites_por_mapa(POR_SITE.rodar(time_id=time_id, mapa_id=m))
    por_mapa = []
    for l in sorted((l for l in linhas if not l["geral"]), key=lambda l: (-l["partidas"], l["mapa_id"] or "")):
        por_mapa.append({"mapa": catalogos.nome_mapa(l["mapa_id"]), **_bloco(l),
                         "plants_por_site": sites.get(l["mapa_id"], {})})

    return {
        "filtros": {"mapa": catalogos.nome_mapa(m)},
        "geral": _bloco(geral),
        "por_mapa": por_mapa,
        "notas": "pos_plant = rounds de ataque com plant; vitória = o ataque venceu. retake = rounds de "
                 "defesa com plant do adversário; vitória = a defesa venceu mesmo assim (desarme ou "
                 "tempo). Mede o resultado depois do plant, não prova tentativa de retake. "
                 "plants_por_site: ataque = onde o time plantou; defesa = onde sofreu plant. "
                 "Os sites são do mapa (A no Ascent não é o A no Haven). Taxas em 0-100; null = indisponível.",
    }
