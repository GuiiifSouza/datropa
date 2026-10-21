"""stats_time: resumo de um time, mapas fortes e fracos, elenco e últimas partidas.

stats_time tem escopo 'geral' e 'mapa' na mesma tabela; as linhas não se somam.
"""

from __future__ import annotations

from .. import catalogos
from ..bq import Consulta
from . import ErroTool, tool

_TIPOS = {"time_id": "STRING", "mapa_id": "STRING"}
_EXEMPLO = {"time_id": "exemplo", "mapa_id": None}

RESUMO = Consulta(
    nome="stats_time.resumo",
    tipos=_TIPOS,
    exemplo=_EXEMPLO,
    sql=lambda t: f"""
SELECT escopo, nome, mapa_id, partidas, vitorias, derrotas, empates,
  rounds_jogados, rounds_ganhos, rounds_ataque, vitorias_ataque, rounds_defesa, vitorias_defesa,
  taxa_vitoria_pct, taxa_rounds_pct, taxa_ataque_pct, taxa_defesa_pct, registros_com_alerta
FROM {t("stats_time")}
WHERE time_id = @time_id
  AND (escopo = 'geral' OR @mapa_id IS NULL OR mapa_id = @mapa_id)
ORDER BY escopo, partidas DESC, mapa_id
""",
)

ELENCO = Consulta(
    nome="stats_time.elenco",
    tipos=_TIPOS,
    exemplo=_EXEMPLO,
    sql=lambda t: f"""
SELECT jogador_id,
  (ARRAY_AGG(STRUCT(nome, tag) ORDER BY inicio DESC, partida_id DESC LIMIT 1))[OFFSET(0)] AS identidade,
  COUNT(DISTINCT partida_id) AS partidas,
  SUM(rounds) AS rounds, SUM(kills) AS kills, SUM(deaths) AS deaths, SUM(assists) AS assists,
  SAFE_DIVIDE(SUM(kills), SUM(deaths)) AS kd,
  IF(COUNTIF(status_qualidade != 'ok') = 0, SAFE_DIVIDE(SUM(dano_total), SUM(rounds)), NULL) AS adr,
  IF(COUNTIF(status_qualidade != 'ok') = 0,
    100.0 * SAFE_DIVIDE(SUM(headshots), SUM(headshots) + SUM(bodyshots) + SUM(legshots)), NULL) AS hs_pct,
  SUM(first_bloods) AS first_bloods, SUM(first_deaths) AS first_deaths,
  APPROX_TOP_COUNT(agente_id, 1)[OFFSET(0)].value AS agente_principal_id
FROM {t("stats_jogador_partida")}
WHERE time_id = @time_id AND (@mapa_id IS NULL OR mapa_id = @mapa_id)
GROUP BY jogador_id
ORDER BY partidas DESC, kd DESC, jogador_id
LIMIT 10
""",
)

ULTIMAS = Consulta(
    nome="stats_time.ultimas_partidas",
    tipos=_TIPOS,
    exemplo=_EXEMPLO,
    sql=lambda t: f"""
SELECT p.partida_id, p.torneio_id, p.mapa_id, p.data_partida_utc, adv.nome AS adversario,
  p.placar, p.placar_adversario, p.venceu
FROM {t("stats_time_partida")} p
LEFT JOIN {t("stats_time")} adv ON adv.time_id = p.adversario_id AND adv.escopo = 'geral'
WHERE p.time_id = @time_id AND (@mapa_id IS NULL OR p.mapa_id = @mapa_id)
ORDER BY p.inicio DESC NULLS LAST, p.partida_id DESC
LIMIT 5
""",
)


@tool(
    nome="stats_time",
    descricao=(
        "Estatísticas de um time na base oficial: partidas, vitórias, % de rounds, desempenho no "
        "ataque e na defesa, resultado por mapa (mapas fortes e fracos), elenco com K/D, ADR, HS% "
        "e first bloods de cada jogador, e as últimas 5 partidas. Filtro opcional de mapa. "
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
def stats_time(time_id: str, mapa: str | None = None) -> dict:
    m = catalogos.mapa_id(mapa)
    if mapa and not m:
        raise ErroTool(f"mapa desconhecido: {mapa}. Mapas: {', '.join(catalogos.MAPAS.values())}")

    linhas = RESUMO.rodar(time_id=time_id, mapa_id=m)
    geral = next((l for l in linhas if l["escopo"] == "geral"), None)
    if geral is None:
        raise ErroTool("time não encontrado (confira o id com buscar_entidade)")
    mapas = [l for l in linhas if l["escopo"] == "mapa"]
    if m and not mapas:
        raise ErroTool(f"o time não jogou {catalogos.nome_mapa(m)} na base")
    for linha in [geral, *mapas]:
        linha.pop("escopo")
        linha["mapa"] = catalogos.nome_mapa(linha.pop("mapa_id"))
    nome = geral.pop("nome")
    geral.pop("mapa")
    for linha in mapas:
        linha.pop("nome")

    elenco = ELENCO.rodar(time_id=time_id, mapa_id=m)
    for j in elenco:
        ident = j.pop("identidade")
        j["jogador"] = f"{ident['nome']}#{ident['tag']}" if ident["tag"] else ident["nome"]
        uuid = j.pop("agente_principal_id")
        j["agente_principal"] = catalogos.nome_agente(uuid)
        j["agente_principal_classe"] = catalogos.classe_agente(uuid)

    ultimas = ULTIMAS.rodar(time_id=time_id, mapa_id=m)
    for p in ultimas:
        p["mapa"] = catalogos.nome_mapa(p.pop("mapa_id"))

    return {
        "time": nome,
        "filtros": {"mapa": catalogos.nome_mapa(m)},
        "geral": geral,
        "por_mapa": mapas,
        "elenco": elenco,
        "ultimas_partidas": ultimas,
        "notas": "geral é o total do time em todas as partidas (não muda com o filtro de mapa); "
                 "por_mapa, elenco e ultimas_partidas respeitam o filtro. taxa_*_pct em 0-100. "
                 "null = indisponível.",
    }
