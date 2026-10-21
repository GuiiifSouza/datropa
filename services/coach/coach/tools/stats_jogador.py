"""stats_jogador: números de um jogador, com filtro opcional de mapa e agente.

Filtra stats_jogador_partida antes de agregar e recalcula as razões pelos
totais, como pede a gold (OFICIALIZACAO_E_API.md). ADR e HS% ficam null se
algum registro do recorte tiver alerta de qualidade.
"""

from __future__ import annotations

from .. import catalogos
from ..bq import Consulta
from . import ErroTool, tool
from .ids import resolver_jogador

_FILTRO = """jogador_id = @jogador_id
    AND (@mapa_id IS NULL OR mapa_id = @mapa_id)
    AND (@agente_id IS NULL OR agente_id = @agente_id)"""

_TIPOS = {"jogador_id": "STRING", "mapa_id": "STRING", "agente_id": "STRING"}
_EXEMPLO = {"jogador_id": "exemplo", "mapa_id": None, "agente_id": None}

_METRICAS = """
    COUNT(DISTINCT partida_id) AS partidas,
    COUNTIF(venceu) AS vitorias,
    SUM(rounds) AS rounds, SUM(kills) AS kills, SUM(deaths) AS deaths, SUM(assists) AS assists,
    SAFE_DIVIDE(SUM(kills), SUM(deaths)) AS kd,
    IF(COUNTIF(status_qualidade != 'ok') = 0, SAFE_DIVIDE(SUM(dano_total), SUM(rounds)), NULL) AS adr,
    IF(COUNTIF(status_qualidade != 'ok') = 0,
      100.0 * SAFE_DIVIDE(SUM(headshots), SUM(headshots) + SUM(bodyshots) + SUM(legshots)), NULL) AS hs_pct,
    SUM(first_bloods) AS first_bloods, SUM(first_deaths) AS first_deaths"""

RESUMO = Consulta(
    nome="stats_jogador.resumo",
    tipos=_TIPOS,
    exemplo=_EXEMPLO,
    sql=lambda t: f"""
SELECT
  (ARRAY_AGG(STRUCT(nome, tag) ORDER BY inicio DESC, partida_id DESC LIMIT 1))[OFFSET(0)] AS identidade,
  {_METRICAS},
  100.0 * SAFE_DIVIDE(COUNTIF(venceu), COUNT(DISTINCT partida_id)) AS taxa_vitoria_pct,
  COUNTIF(status_qualidade != 'ok') AS registros_com_alerta,
  ARRAY_AGG(DISTINCT time_nome IGNORE NULLS) AS times
FROM {t("stats_jogador_partida")}
WHERE {_FILTRO}
""",
)

POR_AGENTE = Consulta(
    nome="stats_jogador.por_agente",
    tipos=_TIPOS,
    exemplo=_EXEMPLO,
    sql=lambda t: f"""
SELECT agente_id, {_METRICAS}
FROM {t("stats_jogador_partida")}
WHERE {_FILTRO}
GROUP BY agente_id
ORDER BY partidas DESC, kills DESC, agente_id
LIMIT 5
""",
)

POR_MAPA = Consulta(
    nome="stats_jogador.por_mapa",
    tipos=_TIPOS,
    exemplo=_EXEMPLO,
    sql=lambda t: f"""
SELECT mapa_id, {_METRICAS}
FROM {t("stats_jogador_partida")}
WHERE {_FILTRO}
GROUP BY mapa_id
ORDER BY partidas DESC, mapa_id
""",
)


@tool(
    nome="stats_jogador",
    descricao=(
        "Estatísticas de um jogador na base oficial: partidas, vitórias, K/D/A, K/D, ADR, HS%, "
        "first bloods e first deaths, mais a quebra por agente e por mapa. Filtros opcionais "
        "de mapa e agente. Precisa do jogador_id devolvido por buscar_entidade."
    ),
    parametros={
        "type": "object",
        "properties": {
            "jogador_id": {"type": "string", "description": "id do jogador (campo id de buscar_entidade)."},
            "mapa": {"type": "string", "description": "Nome do mapa, ex.: Lotus, Ascent. Opcional."},
            "agente": {"type": "string", "description": "Nome do agente, ex.: Jett, Omen. Opcional."},
        },
        "required": ["jogador_id"],
    },
)
def stats_jogador(jogador_id: str, mapa: str | None = None, agente: str | None = None) -> dict:
    m = catalogos.mapa_id(mapa)
    if mapa and not m:
        raise ErroTool(f"mapa desconhecido: {mapa}. Mapas: {', '.join(catalogos.MAPAS.values())}")
    a = catalogos.agente_id(agente)
    if agente and not a:
        raise ErroTool(f"agente desconhecido: {agente}")
    jogador_id = resolver_jogador(jogador_id)

    valores = {"jogador_id": jogador_id, "mapa_id": m, "agente_id": a}
    resumo = RESUMO.rodar(**valores)[0]
    if not resumo["partidas"]:
        raise ErroTool("nenhuma partida para esse jogador nesse recorte (confira o id com buscar_entidade)")

    identidade = resumo.pop("identidade")
    agentes = POR_AGENTE.rodar(**valores)
    for linha in agentes:
        uuid = linha.pop("agente_id")
        linha["agente"] = catalogos.nome_agente(uuid)
        linha["classe"] = catalogos.classe_agente(uuid)
    mapas = POR_MAPA.rodar(**valores)
    for linha in mapas:
        linha["mapa"] = catalogos.nome_mapa(linha.pop("mapa_id"))

    return {
        "jogador": f"{identidade['nome']}#{identidade['tag']}" if identidade["tag"] else identidade["nome"],
        "filtros": {"mapa": catalogos.nome_mapa(m), "agente": catalogos.nome_agente(a)},
        "resumo": resumo,
        "agentes_mais_usados": agentes,
        "por_mapa": mapas,
        "notas": "kd = kills/deaths. adr = dano a adversários por round. hs_pct = % de tiros na cabeça "
                 "entre os acertos (não % de abates). null = indisponível.",
    }
