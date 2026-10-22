"""resumo_partida: placar, jogadores, rounds e destaques de uma partida (um mapa).

MVP e "rounds decisivos" não têm critério oficial na gold (OFICIALIZACAO_E_API.md):
mvp fica null. Os destaques aqui são fatos com critério explícito (maior ACS,
mais abates, mais first bloods, vitórias com compra inferior, placar no intervalo,
maior sequência), não uma eleição de MVP.
"""

from __future__ import annotations

from .. import catalogos
from ..bq import Consulta
from . import ErroTool, resolver_mapa, tool
from .ids import resolver_time

PARTIDA = Consulta(
    nome="resumo_partida.partida",
    tipos={"partida_id": "STRING"},
    exemplo={"partida_id": "exemplo"},
    sql=lambda t: f"""
SELECT partida_id, torneio_id, mapa_id, data_partida_utc, inicio, duracao_ms, rounds_jogados,
  time_a_id, time_a_nome, time_b_id, time_b_nome, placar_a, placar_b, vencedor_id, status_qualidade
FROM {t("partidas")}
WHERE partida_id = @partida_id
""",
)

BUSCAR = Consulta(
    nome="resumo_partida.buscar",
    tipos={"time_id": "STRING", "adversario_id": "STRING", "mapa_id": "STRING"},
    exemplo={"time_id": "exemplo", "adversario_id": None, "mapa_id": None},
    sql=lambda t: f"""
SELECT p.partida_id, p.torneio_id, p.mapa_id, p.data_partida_utc, adv.nome AS adversario,
  p.placar, p.placar_adversario, p.venceu
FROM {t("stats_time_partida")} p
LEFT JOIN {t("stats_time_partida")} adv ON adv.partida_id = p.partida_id AND adv.time_id = p.adversario_id
WHERE p.time_id = @time_id
  AND (@adversario_id IS NULL OR p.adversario_id = @adversario_id)
  AND (@mapa_id IS NULL OR p.mapa_id = @mapa_id)
ORDER BY p.inicio DESC NULLS LAST, p.partida_id DESC
LIMIT 6
""",
)

JOGADORES = Consulta(
    nome="resumo_partida.jogadores",
    tipos={"partida_id": "STRING"},
    exemplo={"partida_id": "exemplo"},
    sql=lambda t: f"""
SELECT jogador_id, nome, tag, time_id, agente_id, rounds, score, kills, deaths, assists, kd, adr, hs_pct,
  first_bloods, first_deaths
FROM {t("stats_jogador_partida")}
WHERE partida_id = @partida_id
ORDER BY time_id, score DESC, jogador_id
""",
)

ROUNDS = Consulta(
    nome="resumo_partida.rounds",
    tipos={"partida_id": "STRING"},
    exemplo={"partida_id": "exemplo"},
    sql=lambda t: f"""
SELECT r.`round`, r.vencedor_id, r.atacante_id, r.defensor_id, r.lado_vencedor, r.resultado,
  r.plant_site, r.round_atipico, ea.categoria AS compra_ataque, ed.categoria AS compra_defesa
FROM {t("rounds")} r
LEFT JOIN {t("economia_time_round")} ea ON ea.partida_id = r.partida_id
  AND ea.round_indice_origem = r.round_indice_origem AND ea.time_id = r.atacante_id
LEFT JOIN {t("economia_time_round")} ed ON ed.partida_id = r.partida_id
  AND ed.round_indice_origem = r.round_indice_origem AND ed.time_id = r.defensor_id
WHERE r.partida_id = @partida_id
ORDER BY r.`round`
""",
)

_NIVEL = {"eco": 0, "force": 1, "full": 2}


def nome_jogador(j: dict) -> str:
    return f"{j['nome']}#{j['tag']}" if j.get("tag") else j["nome"]


def _maior_sequencia(rounds: list[dict], time_id: str) -> int:
    melhor = atual = 0
    for r in rounds:
        atual = atual + 1 if r["vencedor_id"] == time_id else 0
        melhor = max(melhor, atual)
    return melhor


def _destaque(jogadores: list[dict], campo: str) -> dict | None:
    validos = [j for j in jogadores if j.get(campo) is not None]
    if not validos:
        return None
    j = max(validos, key=lambda j: (j[campo], j["kills"] or 0))
    return {"jogador": j["jogador"], "time": j["time"], campo: j[campo]}


@tool(
    nome="resumo_partida",
    descricao=(
        "Resumo de uma partida (um mapa jogado): placar, placar no intervalo, números de cada "
        "jogador (ACS, K/D/A, ADR, HS%, first bloods), round a round com vencedor, lado, como "
        "terminou, site do plant e tipo de compra dos dois times, e destaques (maior ACS, mais "
        "abates, vitórias com compra inferior, maior sequência). Passe partida_id (vem de "
        "stats_time, comparar_times ou de outra chamada desta tool) ou, sem ele, time_id e "
        "opcionalmente adversario_id e mapa para pegar a partida mais recente que bate."
    ),
    parametros={
        "type": "object",
        "properties": {
            "partida_id": {"type": "string", "description": "id da partida. Opcional se passar time_id."},
            "time_id": {"type": "string", "description": "id de um dos times (buscar_entidade). Opcional."},
            "adversario_id": {"type": "string", "description": "id do adversário (buscar_entidade). Opcional."},
            "mapa": {"type": "string", "description": "Nome do mapa, ex.: Lotus. Opcional."},
        },
    },
)
def resumo_partida(partida_id: str | None = None, time_id: str | None = None,
                   adversario_id: str | None = None, mapa: str | None = None) -> dict:
    outras: list[dict] = []
    if not partida_id:
        if not time_id:
            raise ErroTool("passe partida_id ou time_id")
        m = resolver_mapa(mapa)
        time_id = resolver_time(time_id)
        adversario_id = resolver_time(adversario_id) if adversario_id else None
        candidatas = BUSCAR.rodar(time_id=time_id, adversario_id=adversario_id, mapa_id=m)
        if not candidatas:
            raise ErroTool("nenhuma partida desse time nesse recorte (confira os ids com buscar_entidade)")
        partida_id = candidatas[0]["partida_id"]
        for c in candidatas[1:]:
            c["mapa"] = catalogos.nome_mapa(c.pop("mapa_id"))
            outras.append(c)

    linhas = PARTIDA.rodar(partida_id=partida_id)
    if not linhas:
        raise ErroTool("partida não encontrada (use o partida_id devolvido por outra tool)")
    p = linhas[0]
    nomes = {p["time_a_id"]: p["time_a_nome"], p["time_b_id"]: p["time_b_nome"]}

    jogadores = []
    for j in JOGADORES.rodar(partida_id=partida_id):
        rounds = j.pop("rounds")
        score = j.pop("score")
        uuid = j.pop("agente_id")
        jogadores.append({
            "jogador": nome_jogador(j), "time": nomes.get(j["time_id"]),
            "agente": catalogos.nome_agente(uuid), "classe": catalogos.classe_agente(uuid),
            "acs": round(score / rounds, 1) if score is not None and rounds else None,
            **{k: j[k] for k in ("kills", "deaths", "assists", "kd", "adr", "hs_pct", "first_bloods", "first_deaths")},
        })

    rounds = ROUNDS.rodar(partida_id=partida_id)
    lista_rounds, compra_inferior = [], []
    for r in rounds:
        compras = {nomes.get(r["atacante_id"]): r["compra_ataque"], nomes.get(r["defensor_id"]): r["compra_defesa"]}
        item = {"round": r["round"], "vencedor": nomes.get(r["vencedor_id"]), "lado_vencedor": r["lado_vencedor"],
                "resultado": r["resultado"], "site_plant": r["plant_site"], "compras": compras}
        if r["round_atipico"]:
            item["atipico"] = True
        lista_rounds.append(item)
        venc = r["vencedor_id"]
        if venc in (r["atacante_id"], r["defensor_id"]):
            cv = r["compra_ataque"] if venc == r["atacante_id"] else r["compra_defesa"]
            cp = r["compra_defesa"] if venc == r["atacante_id"] else r["compra_ataque"]
            if cv in _NIVEL and cp in _NIVEL and _NIVEL[cv] < _NIVEL[cp]:
                compra_inferior.append({"round": r["round"], "vencedor": nomes.get(venc),
                                        "compra_vencedor": cv, "compra_perdedor": cp})

    intervalo = {nomes[t]: sum(1 for r in rounds if r["round"] <= 12 and r["vencedor_id"] == t)
                 for t in (p["time_a_id"], p["time_b_id"]) if t in nomes}
    sequencia = {nomes[t]: _maior_sequencia(rounds, t) for t in (p["time_a_id"], p["time_b_id"]) if t in nomes}

    return {
        "partida_id": p["partida_id"],
        "torneio_id": p["torneio_id"],
        "torneio": catalogos.nome_torneio(p["torneio_id"]),
        "mapa": catalogos.nome_mapa(p["mapa_id"]),
        "data": p["data_partida_utc"],
        "duracao_min": round(p["duracao_ms"] / 60000, 1) if p["duracao_ms"] else None,
        "placar": {p["time_a_nome"]: p["placar_a"], p["time_b_nome"]: p["placar_b"]},
        "vencedor": nomes.get(p["vencedor_id"]),
        "placar_no_intervalo": intervalo,
        "maior_sequencia_de_rounds": sequencia,
        "jogadores": jogadores,
        "destaques": {
            "maior_acs": _destaque(jogadores, "acs"),
            "mais_abates": _destaque(jogadores, "kills"),
            "mais_first_bloods": _destaque(jogadores, "first_bloods"),
            "vitorias_com_compra_inferior": compra_inferior,
        },
        "mvp": None,
        "rounds": lista_rounds,
        "outras_partidas": outras,
        "status_qualidade": p["status_qualidade"],
        "notas": "mvp = null: a base não tem critério oficial de MVP; use os destaques dizendo o "
                 "critério (ex.: maior ACS). acs = score / rounds. vitorias_com_compra_inferior = rounds "
                 "vencidos com compra menor que a do adversário (eco < force < full, sem pistol). "
                 "placar_no_intervalo = rounds 1 a 12. outras_partidas = outras que batem com a busca "
                 "por time (passe o partida_id para resumir uma delas).",
    }
