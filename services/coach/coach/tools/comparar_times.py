"""comparar_times: dois times lado a lado e os confrontos diretos entre eles.

Filtra as tabelas por partida antes de agregar e recalcula as razões pelos
totais (OFICIALIZACAO_E_API.md). Taxa fica null quando o recorte tem registro
com alerta de qualidade, como em stats_time.
"""

from __future__ import annotations

from .. import catalogos
from ..bq import Consulta
from . import ErroTool, resolver_mapa, taxa, tool

_TIPOS = {"time_a_id": "STRING", "time_b_id": "STRING", "mapa_id": "STRING"}
_EXEMPLO = {"time_a_id": "exemplo_a", "time_b_id": "exemplo_b", "mapa_id": None}
_FILTRO = "time_id IN (@time_a_id, @time_b_id) AND (@mapa_id IS NULL OR mapa_id = @mapa_id)"

INDICADORES = Consulta(
    nome="comparar_times.indicadores",
    tipos=_TIPOS,
    exemplo=_EXEMPLO,
    sql=lambda t: f"""
WITH tp AS (
  SELECT time_id, ANY_VALUE(nome) AS nome,
    COUNT(DISTINCT partida_id) AS partidas, COUNTIF(venceu) AS vitorias, COUNTIF(perdeu) AS derrotas,
    COUNTIF(empate) AS empates,
    SUM(rounds_jogados) AS rounds_jogados, SUM(rounds_ganhos) AS rounds_ganhos,
    SUM(rounds_ataque) AS rounds_ataque, SUM(vitorias_ataque) AS vitorias_ataque,
    SUM(rounds_defesa) AS rounds_defesa, SUM(vitorias_defesa) AS vitorias_defesa,
    COUNTIF(status_qualidade != 'ok') AS alertas_time
  FROM {t("stats_time_partida")}
  WHERE {_FILTRO}
  GROUP BY time_id
), pp AS (
  SELECT time_id,
    SUM(pos_plant_oportunidades) AS pos_plant_oportunidades, SUM(pos_plant_vitorias) AS pos_plant_vitorias,
    SUM(retake_oportunidades) AS retake_oportunidades, SUM(retake_vitorias) AS retake_vitorias,
    COUNTIF(status_qualidade != 'ok') AS alertas_pos_plant
  FROM {t("pos_plant_retake_partida")}
  WHERE {_FILTRO}
  GROUP BY time_id
), jg AS (
  SELECT time_id,
    SUM(kills) AS kills, SUM(deaths) AS deaths, SUM(first_bloods) AS first_bloods,
    SUM(first_deaths) AS first_deaths, SUM(dano_total) AS dano_total, SUM(rounds) AS rounds_jogador,
    COUNTIF(status_qualidade != 'ok') AS alertas_jogador
  FROM {t("stats_jogador_partida")}
  WHERE {_FILTRO}
  GROUP BY time_id
), ec AS (
  SELECT time_id,
    COUNTIF(categoria = 'pistol') AS pistols, COUNTIF(categoria = 'pistol' AND venceu) AS pistols_vencidos,
    COUNTIF(categoria = 'eco') AS ecos, COUNTIF(categoria = 'eco' AND venceu) AS ecos_vencidos,
    COUNTIF(categoria = 'force') AS forces, COUNTIF(categoria = 'force' AND venceu) AS forces_vencidos,
    COUNTIF(categoria = 'full') AS fulls, COUNTIF(categoria = 'full' AND venceu) AS fulls_vencidos
  FROM {t("economia_time_round")}
  WHERE {_FILTRO}
  GROUP BY time_id
)
SELECT *
FROM tp
LEFT JOIN pp USING (time_id)
LEFT JOIN jg USING (time_id)
LEFT JOIN ec USING (time_id)
""",
)

POR_MAPA = Consulta(
    nome="comparar_times.por_mapa",
    tipos=_TIPOS,
    exemplo=_EXEMPLO,
    sql=lambda t: f"""
SELECT time_id, mapa_id, COUNT(DISTINCT partida_id) AS partidas, COUNTIF(venceu) AS vitorias,
  SUM(rounds_jogados) AS rounds_jogados, SUM(rounds_ganhos) AS rounds_ganhos
FROM {t("stats_time_partida")}
WHERE {_FILTRO}
GROUP BY time_id, mapa_id
""",
)

CONFRONTOS = Consulta(
    nome="comparar_times.confrontos",
    tipos=_TIPOS,
    exemplo=_EXEMPLO,
    sql=lambda t: f"""
SELECT partida_id, torneio_id, mapa_id, data_partida_utc, placar, placar_adversario, venceu, empate,
  COUNT(*) OVER () AS total, COUNTIF(venceu) OVER () AS vitorias_a,
  COUNTIF(perdeu) OVER () AS vitorias_b, COUNTIF(empate) OVER () AS empates
FROM {t("stats_time_partida")}
WHERE time_id = @time_a_id AND adversario_id = @time_b_id
  AND (@mapa_id IS NULL OR mapa_id = @mapa_id)
ORDER BY inicio DESC NULLS LAST, partida_id DESC
LIMIT 10
""",
)


def _indicadores(l: dict) -> dict:
    ok_time = l["alertas_time"] == 0
    ok_pp = (l["alertas_pos_plant"] or 0) == 0
    ok_jg = (l["alertas_jogador"] or 0) == 0

    def t(v, total, ok=True):
        return taxa(v, total) if ok else None

    return {
        "time": l["nome"],
        "partidas": l["partidas"], "vitorias": l["vitorias"], "derrotas": l["derrotas"], "empates": l["empates"],
        "taxa_vitoria_pct": t(l["vitorias"], l["partidas"], ok_time),
        "rounds_jogados": l["rounds_jogados"], "rounds_ganhos": l["rounds_ganhos"],
        "taxa_rounds_pct": t(l["rounds_ganhos"], l["rounds_jogados"], ok_time),
        "taxa_ataque_pct": t(l["vitorias_ataque"], l["rounds_ataque"], ok_time),
        "taxa_defesa_pct": t(l["vitorias_defesa"], l["rounds_defesa"], ok_time),
        "kd_time": round(l["kills"] / l["deaths"], 2) if l["kills"] is not None and l["deaths"] else None,
        "adr_medio_jogador": round(l["dano_total"] / l["rounds_jogador"], 2)
        if ok_jg and l["rounds_jogador"] else None,
        "first_bloods": l["first_bloods"], "first_deaths": l["first_deaths"],
        "taxa_first_blood_pct": t(l["first_bloods"], l["rounds_jogados"], ok_jg),
        "pos_plant_taxa_pct": t(l["pos_plant_vitorias"], l["pos_plant_oportunidades"], ok_pp),
        "pos_plant_oportunidades": l["pos_plant_oportunidades"],
        "retake_taxa_pct": t(l["retake_vitorias"], l["retake_oportunidades"], ok_pp),
        "retake_oportunidades": l["retake_oportunidades"],
        "pistol_taxa_pct": taxa(l["pistols_vencidos"], l["pistols"]),
        "eco_taxa_pct": taxa(l["ecos_vencidos"], l["ecos"]),
        "force_taxa_pct": taxa(l["forces_vencidos"], l["forces"]),
        "full_taxa_pct": taxa(l["fulls_vencidos"], l["fulls"]),
    }


@tool(
    nome="comparar_times",
    descricao=(
        "Compara dois times lado a lado: vitórias, % de rounds, ataque e defesa, K/D do time, "
        "ADR médio, first bloods, pós-plant, retake e taxa de vitória por tipo de compra (pistol, "
        "eco, force, full); resultado de cada um por mapa; e o histórico de confrontos diretos "
        "entre eles. Filtro opcional de mapa. Use para prever ou analisar um confronto. Precisa "
        "dos dois time_id devolvidos por buscar_entidade."
    ),
    parametros={
        "type": "object",
        "properties": {
            "time_a_id": {"type": "string", "description": "id do primeiro time (buscar_entidade)."},
            "time_b_id": {"type": "string", "description": "id do segundo time (buscar_entidade)."},
            "mapa": {"type": "string", "description": "Nome do mapa, ex.: Lotus, Ascent. Opcional."},
        },
        "required": ["time_a_id", "time_b_id"],
    },
)
def comparar_times(time_a_id: str, time_b_id: str, mapa: str | None = None) -> dict:
    if time_a_id == time_b_id:
        raise ErroTool("os dois times são o mesmo; passe dois time_id diferentes")
    m = resolver_mapa(mapa)
    valores = {"time_a_id": time_a_id, "time_b_id": time_b_id, "mapa_id": m}

    linhas = {l["time_id"]: l for l in INDICADORES.rodar(**valores)}
    faltando = [i for i in (time_a_id, time_b_id) if i not in linhas]
    if faltando:
        quem = " e ".join("time_a" if i == time_a_id else "time_b" for i in faltando)
        raise ErroTool(f"sem partidas para {quem} nesse recorte (confira o id com buscar_entidade)")
    a, b = _indicadores(linhas[time_a_id]), _indicadores(linhas[time_b_id])

    mapas: dict[str, dict] = {}
    for l in POR_MAPA.rodar(**valores):
        lado = "time_a" if l["time_id"] == time_a_id else "time_b"
        mapas.setdefault(l["mapa_id"], {"mapa": catalogos.nome_mapa(l["mapa_id"]), "time_a": None, "time_b": None})
        mapas[l["mapa_id"]][lado] = {
            "partidas": l["partidas"], "vitorias": l["vitorias"],
            "taxa_vitoria_pct": taxa(l["vitorias"], l["partidas"]),
            "taxa_rounds_pct": taxa(l["rounds_ganhos"], l["rounds_jogados"]),
        }
    por_mapa = sorted(mapas.values(), key=lambda x: (
        -((x["time_a"] or {}).get("partidas", 0) + (x["time_b"] or {}).get("partidas", 0)), x["mapa"]))

    confrontos = CONFRONTOS.rodar(**valores)
    diretos = {"partidas": 0, "vitorias_time_a": 0, "vitorias_time_b": 0, "empates": 0, "ultimas": []}
    if confrontos:
        c0 = confrontos[0]
        diretos.update(partidas=c0["total"], vitorias_time_a=c0["vitorias_a"],
                       vitorias_time_b=c0["vitorias_b"], empates=c0["empates"])
        diretos["ultimas"] = [
            {"partida_id": c["partida_id"], "torneio_id": c["torneio_id"], "mapa": catalogos.nome_mapa(c["mapa_id"]),
             "data": c["data_partida_utc"], "placar_time_a": c["placar"], "placar_time_b": c["placar_adversario"],
             "vencedor": a["time"] if c["venceu"] else (None if c["empate"] else b["time"])}
            for c in confrontos
        ]

    return {
        "filtros": {"mapa": catalogos.nome_mapa(m)},
        "time_a": a,
        "time_b": b,
        "por_mapa": por_mapa,
        "confrontos_diretos": diretos,
        "notas": "Todos os números no mesmo recorte. kd_time = kills/deaths somados do time. "
                 "adr_medio_jogador = dano a adversários / rounds, na média dos jogadores. "
                 "taxa_first_blood_pct = % dos rounds em que o time fez o primeiro abate. "
                 "pos_plant = ataque convertendo depois do plant; retake = defesa vencendo depois de "
                 "sofrer plant. Taxas em 0-100; null = indisponível ou sem base. por_mapa com time null "
                 "= aquele time não jogou o mapa.",
    }
