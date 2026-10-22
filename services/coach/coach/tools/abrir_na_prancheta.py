"""abrir_na_prancheta: eventos de um round com posições e o link da prancheta.

Lê eventos_round (abates, plant e defuse, com o snapshot de posição dos jogadores
em cada evento), rounds, partidas e mapas (transformação de coordenada). Round
público começa em 1, como na gold.

O link segue o contrato de docs/api.md, seção 6, que o front adotou
(front/src/App.tsx, rota /prancheta):
    /prancheta?partida_id=<id>&round=<n>
A base do link absoluto vem de COACH_FRONT_URL.
"""

from __future__ import annotations

import json
from urllib.parse import urlencode

from .. import catalogos, config
from ..bq import Consulta
from . import ErroTool, tool
from .resumo_partida import JOGADORES, nome_jogador

_TIPOS = {"partida_id": "STRING", "round": "INT64"}
_EXEMPLO = {"partida_id": "exemplo", "round": 1}

ROUND = Consulta(
    nome="abrir_na_prancheta.round",
    tipos=_TIPOS,
    exemplo=_EXEMPLO,
    sql=lambda t: f"""
SELECT p.partida_id, p.mapa_id, p.rounds_jogados, p.time_a_id, p.time_a_nome, p.time_b_id, p.time_b_nome,
  r.`round`, r.vencedor_id, r.atacante_id, r.defensor_id, r.resultado, r.plant_site, r.round_atipico,
  -- JSON: o arredondamento do resultado (bq._limpar) zeraria coeficientes como 0.00007.
  TO_JSON_STRING(m.transformacao) AS transformacao_json, m.status_calibracao
FROM {t("partidas")} p
LEFT JOIN {t("rounds")} r ON r.partida_id = p.partida_id AND r.`round` = @round
LEFT JOIN {t("mapas")} m ON m.mapa_id = p.mapa_id
WHERE p.partida_id = @partida_id
""",
)

EVENTOS = Consulta(
    nome="abrir_na_prancheta.eventos",
    tipos=_TIPOS,
    exemplo=_EXEMPLO,
    sql=lambda t: f"""
SELECT id, ordem, tipo, tempo_ms, ator_id, vitima_id, assistente_ids, arma_id, dano_final_tipo, site,
  posicao, ARRAY(SELECT AS STRUCT j.jogador_id, j.posicao FROM UNNEST(jogadores) j) AS jogadores,
  self_kill, fogo_amigo, abate_adversario, status_qualidade
FROM {t("eventos_round")}
WHERE partida_id = @partida_id AND `round` = @round
ORDER BY ordem
""",
)

_AMBIENTE = {"Bomb": "morte pela spike", "Fall": "morte por queda"}


def link_prancheta(partida_id: str, round_: int) -> dict:
    caminho = "/prancheta?" + urlencode({"partida_id": partida_id, "round": round_})
    return {"url": caminho, "url_completa": f"{config.FRONT_URL}{caminho}",
            "contrato": "/prancheta?partida_id=&round= (docs/api.md, seção 6), rota do front"}


def _tempo(ms: int | None) -> str | None:
    if ms is None or ms < 0:
        return None
    s = ms // 1000
    return f"{s // 60}:{s % 60:02d}"


def _pos(p: dict | None) -> dict | None:
    if not p or p.get("x") is None or p.get("y") is None:
        return None
    return {"x": round(p["x"]), "y": round(p["y"])}


def _descricao(e: dict, rotulo) -> str:
    ator, vitima = rotulo(e["ator_id"]), rotulo(e["vitima_id"])
    if e["tipo"] == "plant":
        return f"{ator} plantou a spike no site {e['site']}"
    if e["tipo"] == "defuse":
        return f"{ator} desarmou a spike"
    if e["dano_final_tipo"] in _AMBIENTE:
        return f"{vitima}: {_AMBIENTE[e['dano_final_tipo']]}"
    if e["self_kill"]:
        return f"{vitima} morreu pelo próprio dano"
    texto = f"{ator} abateu {vitima}"
    if e["fogo_amigo"]:
        texto += " (fogo amigo)"
    if e["dano_final_tipo"] == "Ability":
        texto += " com habilidade"
    return texto


@tool(
    nome="abrir_na_prancheta",
    descricao=(
        "Abre um round real na prancheta tática: devolve o link da prancheta com o round "
        "carregado e a linha do tempo do round (cada abate, plant e defuse, com tempo, quem fez, "
        "posição e onde estavam os jogadores naquele instante). Use quando o usuário quiser ver, "
        "rever ou estudar um round. Precisa do partida_id (de resumo_partida, stats_time ou "
        "comparar_times) e do número do round (começa em 1)."
    ),
    parametros={
        "type": "object",
        "properties": {
            "partida_id": {"type": "string", "description": "id da partida."},
            "round": {"type": "integer", "description": "Número do round, começando em 1."},
        },
        "required": ["partida_id", "round"],
    },
)
def abrir_na_prancheta(partida_id: str, round: int) -> dict:  # noqa: A002 (nome do contrato)
    try:
        n = int(round)
    except (TypeError, ValueError):
        raise ErroTool("round precisa ser um número inteiro, começando em 1") from None
    if n < 1:
        raise ErroTool("round começa em 1")

    linhas = ROUND.rodar(partida_id=partida_id, round=n)
    if not linhas:
        raise ErroTool("partida não encontrada (use o partida_id devolvido por outra tool)")
    r = linhas[0]
    if r["round"] is None:
        raise ErroTool(f"a partida tem {r['rounds_jogados']} rounds; round {n} não existe")

    nomes_time = {r["time_a_id"]: r["time_a_nome"], r["time_b_id"]: r["time_b_nome"]}
    lado = {r["atacante_id"]: "ataque", r["defensor_id"]: "defesa"}
    elenco = {}
    for j in JOGADORES.rodar(partida_id=partida_id):
        elenco[j["jogador_id"]] = {
            "jogador_id": j["jogador_id"], "jogador": nome_jogador(j), "time": nomes_time.get(j["time_id"]),
            "lado": lado.get(j["time_id"]), "agente": catalogos.nome_agente(j["agente_id"]),
        }

    def rotulo(jogador_id: str | None) -> str:
        j = elenco.get(jogador_id or "")
        if not j:
            return "jogador desconhecido"
        return f"{j['jogador']} ({j['agente']}, {j['time']})"

    eventos = []
    for e in EVENTOS.rodar(partida_id=partida_id, round=n):
        eventos.append({
            "ordem": e["ordem"], "tipo": e["tipo"], "tempo": _tempo(e["tempo_ms"]), "tempo_ms": e["tempo_ms"],
            "descricao": _descricao(e, rotulo),
            "ator_id": e["ator_id"], "vitima_id": e["vitima_id"], "assistente_ids": e["assistente_ids"],
            "site": e["site"], "dano_final_tipo": e["dano_final_tipo"], "arma_id": e["arma_id"],
            "abate_adversario": e["abate_adversario"], "posicao": _pos(e["posicao"]),
            "jogadores": [{"jogador_id": j["jogador_id"], "posicao": _pos(j["posicao"])} for j in e["jogadores"]],
            "evento_id": e["id"], "status_qualidade": e["status_qualidade"],
        })

    return {
        "prancheta": link_prancheta(partida_id, n),
        "partida_id": partida_id,
        "round": n,
        "mapa": catalogos.nome_mapa(r["mapa_id"]),
        "ataque": nomes_time.get(r["atacante_id"]),
        "defesa": nomes_time.get(r["defensor_id"]),
        "vencedor": nomes_time.get(r["vencedor_id"]),
        "resultado": r["resultado"],
        "site_plant": r["plant_site"],
        "round_atipico": r["round_atipico"],
        "jogadores": list(elenco.values()),
        "eventos": eventos,
        "transformacao_mapa": json.loads(r["transformacao_json"]) if r["transformacao_json"] else None,
        "calibracao_mapa": r["status_calibracao"],
        "notas": "Mostre o link da prancheta (prancheta.url_completa) ao usuário. eventos em ordem; tempo "
                 "desde o início do round (m:ss). posicao = vítima no abate, spike no plant/defuse; "
                 "jogadores = posições registradas naquele instante (snapshot parcial, sem interpolar). "
                 "Coordenadas do jogo; u = x*u_x + y*u_y + u_offset, v = x*v_x + y*v_y + v_offset "
                 "levam ao minimapa.",
    }
