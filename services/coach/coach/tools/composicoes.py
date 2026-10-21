"""composicoes: composições de agentes (os cinco do time no mapa) e taxa de vitória.

Lê composicao_time_partida (uma linha por time/partida). Regra
cinco_agentes_ordenados_por_mapa_v1 (services/stats/sql/gold/COMPOSICOES.md):
só entra composicao_valida; composicao_id inclui o mapa, não o time.
"""

from __future__ import annotations

from collections import Counter

from .. import catalogos
from ..bq import Consulta
from . import ErroTool, resolver_mapa, tool
from .ids import resolver_time

LIMITE = 10

AGREGADO = Consulta(
    nome="composicoes.agregado",
    tipos={"time_id": "STRING", "mapa_id": "STRING"},
    exemplo={"time_id": None, "mapa_id": None},
    sql=lambda t: f"""
SELECT mapa_id, composicao_id, ANY_VALUE(agente_ids) AS agente_ids,
  COUNT(*) AS aparicoes, COUNTIF(venceu) AS vitorias, COUNTIF(perdeu) AS derrotas,
  100.0 * SAFE_DIVIDE(COUNTIF(venceu), COUNT(*)) AS taxa_vitoria_pct,
  COUNT(DISTINCT time_id) AS times,
  SUM(COUNT(*)) OVER () AS aparicoes_no_recorte,
  COUNT(*) OVER () AS composicoes_distintas
FROM {t("composicao_time_partida")}
WHERE composicao_valida
  AND (@time_id IS NULL OR time_id = @time_id)
  AND (@mapa_id IS NULL OR mapa_id = @mapa_id)
GROUP BY mapa_id, composicao_id
ORDER BY aparicoes DESC, vitorias DESC, composicao_id
LIMIT {LIMITE * 3}
""",
)


def formatar(linha: dict) -> dict:
    """Linha de AGREGADO -> composição com nomes e classes dos agentes."""
    uuids = linha["agente_ids"] or []
    agentes = sorted(
        ({"agente": catalogos.nome_agente(u), "classe": catalogos.classe_agente(u)} for u in uuids),
        key=lambda a: (a["classe"] or "~", a["agente"] or ""),
    )
    classes = Counter(a["classe"] or "desconhecida" for a in agentes)
    return {
        "mapa": catalogos.nome_mapa(linha["mapa_id"]),
        "agentes": [a["agente"] for a in agentes],
        "estrutura": dict(sorted(classes.items())),
        "aparicoes": linha["aparicoes"],
        "vitorias": linha["vitorias"],
        "derrotas": linha["derrotas"],
        "taxa_vitoria_pct": linha["taxa_vitoria_pct"],
        "times_que_usaram": linha["times"],
        "composicao_id": linha["composicao_id"],
    }


@tool(
    nome="composicoes",
    descricao=(
        "Composições de agentes (os cinco agentes de um time num mapa) mais usadas e a taxa de "
        "vitória de cada uma, com a função de cada agente. Sem time: as composições de todos os "
        "times (meta do campeonato). Com time: as do time. Filtro opcional de mapa. Para time, "
        "use antes buscar_entidade para obter o time_id."
    ),
    parametros={
        "type": "object",
        "properties": {
            "time_id": {"type": "string", "description": "id do time (campo id de buscar_entidade). Opcional."},
            "mapa": {"type": "string", "description": "Nome do mapa, ex.: Lotus, Ascent. Opcional."},
        },
    },
)
def composicoes(time_id: str | None = None, mapa: str | None = None) -> dict:
    m = resolver_mapa(mapa)
    if time_id:
        time_id = resolver_time(time_id)
    linhas = AGREGADO.rodar(time_id=time_id, mapa_id=m)
    if not linhas:
        raise ErroTool("nenhuma composição nesse recorte" + (" (confira o id com buscar_entidade)" if time_id else ""))

    return {
        "filtros": {"time_id": time_id, "mapa": catalogos.nome_mapa(m)},
        "aparicoes_no_recorte": linhas[0]["aparicoes_no_recorte"],
        "composicoes_distintas": linhas[0]["composicoes_distintas"],
        "composicoes": [formatar(l) for l in linhas[:LIMITE]],
        "notas": "aparicao = um time jogando um mapa com aquela composição (não conta jogadores). "
                 "taxa_vitoria_pct em 0-100. Composição é por mapa: a mesma lista em mapas "
                 "diferentes conta separado. Lista mostra as 10 mais usadas. Função do agente só pelo "
                 "campo estrutura/classe.",
    }
