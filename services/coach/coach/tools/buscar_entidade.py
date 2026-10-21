"""buscar_entidade: acha time, jogador, mapa ou agente pelo nome, com busca aproximada."""

from __future__ import annotations

from .. import catalogos
from ..bq import Consulta
from . import ErroTool, tool

# Normalização igual à de catalogos.normalizar, feita no BigQuery.
_NORM = r"""TRIM(REGEXP_REPLACE(LOWER(REGEXP_REPLACE(NORMALIZE({col}, NFD), r'\p{{M}}', '')), r'[_\s]+', ' '))"""

BUSCA = Consulta(
    nome="buscar_entidade",
    tipos={"q": "STRING", "tipo": "STRING"},
    exemplo={"q": "tritons", "tipo": None},
    sql=lambda t: f"""
WITH entidades AS (
  SELECT 'time' AS tipo, time_id AS id, nome, CAST(NULL AS STRING) AS tag,
    CAST(NULL AS STRING) AS time_nome, partidas
  FROM {t("stats_time")}
  WHERE escopo = 'geral'
  UNION ALL
  SELECT 'jogador', r.jogador_id, r.nome, r.tag, tm.nome, r.partidas
  FROM {t("ranking_jogador")} r
  LEFT JOIN {t("stats_time")} tm ON tm.time_id = r.time_id AND tm.escopo = 'geral'
), normalizadas AS (
  SELECT *, {_NORM.format(col="nome")} AS n,
    {_NORM.format(col="CONCAT(nome, '#', COALESCE(tag, ''))")} AS n_tag
  FROM entidades
  WHERE @tipo IS NULL OR tipo = @tipo
), pontuadas AS (
  SELECT *,
    CASE WHEN n = @q OR n_tag = @q THEN 0
      WHEN STARTS_WITH(n, @q) THEN 1
      WHEN STRPOS(n, @q) > 0 OR STRPOS(n_tag, @q) > 0 THEN 2
      ELSE 3 END AS faixa,
    LEAST(EDIT_DISTANCE(n, @q),
      (SELECT MIN(EDIT_DISTANCE(tok, @q)) FROM UNNEST(SPLIT(n, ' ')) tok)) AS distancia
  FROM normalizadas
)
SELECT tipo, id, nome, tag, time_nome, partidas, faixa, distancia
FROM pontuadas
WHERE faixa < 3 OR distancia <= GREATEST(1, DIV(LENGTH(@q), 4))
ORDER BY faixa, distancia, partidas DESC, id
LIMIT 8
""",
)


@tool(
    nome="buscar_entidade",
    descricao=(
        "Acha time, jogador, mapa ou agente pelo nome, tolerando erro de digitação e "
        "grafia diferente. Use SEMPRE antes de stats_jogador ou stats_time para obter o id. "
        "Devolve candidatos ordenados do mais parecido para o menos."
    ),
    parametros={
        "type": "object",
        "properties": {
            "texto": {"type": "string", "description": "Nome ou parte do nome, como o usuário escreveu."},
            "tipo": {
                "type": "string",
                "enum": ["time", "jogador", "mapa", "agente"],
                "description": "Restringe a busca a um tipo. Omita se não souber.",
            },
        },
        "required": ["texto"],
    },
)
def buscar_entidade(texto: str, tipo: str | None = None) -> dict:
    q = catalogos.normalizar(texto)
    if len(q) < 2:
        raise ErroTool("texto curto demais para buscar")

    candidatos: list[dict] = []
    if tipo in (None, "mapa") and (m := catalogos.mapa_id(q)):
        candidatos.append({"tipo": "mapa", "id": m, "nome": catalogos.nome_mapa(m)})
    if tipo in (None, "agente") and (a := catalogos.agente_id(q)):
        candidatos.append({"tipo": "agente", "id": a, "nome": catalogos.nome_agente(a),
                           "classe": catalogos.classe_agente(a)})

    if tipo in (None, "time", "jogador"):
        for linha in BUSCA.rodar(q=q, tipo=tipo):
            exato = linha.pop("faixa") == 0
            linha.pop("distancia")
            linha["correspondencia_exata"] = exato
            if linha["tipo"] == "time":
                linha.pop("tag"), linha.pop("time_nome")
            candidatos.append(linha)

    return {
        "texto_buscado": texto,
        "candidatos": candidatos,
        "observacao": (
            "Nenhum candidato. Peça outra grafia ao usuário." if not candidatos
            else "Se houver mais de um candidato plausível, confirme com o usuário antes de seguir."
        ),
    }
