"""economia_time: resultado do time por tipo de compra (pistol, eco, force, full).

Lê economia_time_round (uma linha por time/round). Regra da gold
equipamento_time_10000_20000_pistol_v2 (services/stats/sql/gold/ECONOMIA.md):
rounds 1 e 13 são pistol; nos demais, soma do equipamento dos cinco:
eco < 10000, force < 20000, full >= 20000. Categoria NULL é economia incompleta
e não entra nas taxas (vai para rounds_sem_classificacao).
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from contextvars import copy_context

from .. import catalogos
from ..bq import Consulta
from . import ErroTool, resolver_mapa, taxa, tool
from .ids import resolver_time

_TIPOS = {"time_id": "STRING", "mapa_id": "STRING"}
_EXEMPLO = {"time_id": "exemplo", "mapa_id": None}
_FILTRO = "time_id = @time_id AND (@mapa_id IS NULL OR mapa_id = @mapa_id)"
ORDEM_CATEGORIAS = ["pistol", "eco", "force", "full"]

POR_CATEGORIA = Consulta(
    nome="economia_time.por_categoria",
    tipos=_TIPOS,
    exemplo=_EXEMPLO,
    sql=lambda t: f"""
SELECT categoria, lado,
  GROUPING(categoria) = 1 AS total, GROUPING(lado) = 1 AS todos_lados,
  COUNT(*) AS rounds, COUNTIF(venceu) AS vitorias,
  COUNT(DISTINCT partida_id) AS partidas,
  COUNTIF(status_qualidade != 'ok') AS rounds_com_alerta,
  ANY_VALUE(classificacao_versao) AS classificacao_versao
FROM {t("economia_time_round")}
WHERE {_FILTRO}
GROUP BY GROUPING SETS ((), (categoria), (categoria, lado))
""",
)

CONTRA_ADVERSARIO = Consulta(
    nome="economia_time.contra_adversario",
    tipos=_TIPOS,
    exemplo=_EXEMPLO,
    sql=lambda t: f"""
SELECT e.categoria, adv.categoria AS categoria_adversario,
  COUNT(*) AS rounds, COUNTIF(e.venceu) AS vitorias
FROM {t("economia_time_round")} e
JOIN {t("economia_time_round")} adv
  ON adv.partida_id = e.partida_id AND adv.round_indice_origem = e.round_indice_origem
  AND adv.time_id = e.adversario_id
WHERE e.time_id = @time_id AND (@mapa_id IS NULL OR e.mapa_id = @mapa_id)
  AND e.categoria IS NOT NULL AND adv.categoria IS NOT NULL AND e.categoria != 'pistol'
GROUP BY 1, 2
""",
)

POS_PISTOL = Consulta(
    nome="economia_time.pos_pistol",
    tipos=_TIPOS,
    exemplo=_EXEMPLO,
    sql=lambda t: f"""
SELECT p.venceu AS venceu_pistol, COUNT(*) AS rounds, COUNTIF(s.venceu) AS vitorias
FROM {t("economia_time_round")} p
JOIN {t("economia_time_round")} s
  ON s.partida_id = p.partida_id AND s.time_id = p.time_id AND s.`round` = p.`round` + 1
WHERE p.time_id = @time_id AND (@mapa_id IS NULL OR p.mapa_id = @mapa_id) AND p.pistol
  AND p.venceu IS NOT NULL
GROUP BY 1
""",
)


def _ordem(cat: str | None) -> int:
    return ORDEM_CATEGORIAS.index(cat) if cat in ORDEM_CATEGORIAS else len(ORDEM_CATEGORIAS)


def resumo_categorias(linhas: list[dict]) -> dict:
    """Separa as linhas de POR_CATEGORIA em total, por categoria e por lado."""
    total = next((l for l in linhas if l["total"]), None)
    if total is None or not total["rounds"]:
        return {}
    por_categoria, por_lado = [], []
    sem_classificacao = 0
    for l in linhas:
        if l["total"]:
            continue
        if l["categoria"] is None:
            if l["todos_lados"]:
                sem_classificacao = l["rounds"]
            continue
        item = {"categoria": l["categoria"], "rounds": l["rounds"], "vitorias": l["vitorias"],
                "taxa_vitoria_pct": taxa(l["vitorias"], l["rounds"])}
        if l["todos_lados"]:
            item["pct_dos_rounds"] = taxa(l["rounds"], total["rounds"])
            por_categoria.append(item)
        else:
            por_lado.append({"lado": l["lado"], **item})
    por_categoria.sort(key=lambda i: _ordem(i["categoria"]))
    por_lado.sort(key=lambda i: (i["lado"] or "", _ordem(i["categoria"])))
    return {
        "partidas": total["partidas"],
        "rounds": total["rounds"],
        "rounds_sem_classificacao": sem_classificacao,
        "rounds_com_alerta": total["rounds_com_alerta"],
        "classificacao_versao": total["classificacao_versao"],
        "por_categoria": por_categoria,
        "por_lado": por_lado,
    }


@tool(
    nome="economia_time",
    descricao=(
        "Economia de um time: quantos rounds jogou e quanto venceu em cada tipo de compra "
        "(pistol, eco, force, full), separado por ataque e defesa; desempenho contra cada tipo "
        "de compra do adversário (ex.: força contra full, full contra eco); e a conversão do "
        "round seguinte ao pistol (ganhou ou perdeu o pistol). Filtro opcional de mapa. "
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
def economia_time(time_id: str, mapa: str | None = None) -> dict:
    m = resolver_mapa(mapa)
    time_id = resolver_time(time_id)
    resumo = resumo_categorias(POR_CATEGORIA.rodar(time_id=time_id, mapa_id=m))
    if not resumo:
        raise ErroTool("nenhum round desse time nesse recorte (confira o id com buscar_entidade)")

    # Validar rounds antes de gastar com detalhes. Contexto separado por worker.
    with ThreadPoolExecutor(max_workers=2, thread_name_prefix="coach-economia") as executor:
        futuro_contra = executor.submit(
            copy_context().run, CONTRA_ADVERSARIO.rodar, time_id=time_id, mapa_id=m
        )
        futuro_pistol = executor.submit(
            copy_context().run, POS_PISTOL.rodar, time_id=time_id, mapa_id=m
        )
        linhas_contra = futuro_contra.result()
        linhas_pistol = futuro_pistol.result()

    contra = [
        {"compra_time": l["categoria"], "compra_adversario": l["categoria_adversario"],
         "rounds": l["rounds"], "vitorias": l["vitorias"],
         "taxa_vitoria_pct": taxa(l["vitorias"], l["rounds"])}
        for l in linhas_contra
    ]
    contra.sort(key=lambda i: (_ordem(i["compra_time"]), _ordem(i["compra_adversario"])))

    pos_pistol = {}
    for l in linhas_pistol:
        chave = "apos_vencer_pistol" if l["venceu_pistol"] else "apos_perder_pistol"
        pos_pistol[chave] = {"rounds": l["rounds"], "vitorias": l["vitorias"],
                             "taxa_vitoria_pct": taxa(l["vitorias"], l["rounds"])}

    return {
        "filtros": {"mapa": catalogos.nome_mapa(m)},
        **resumo,
        "contra_compra_adversario": contra,
        "round_apos_pistol": pos_pistol,
        "notas": "Classificação pelo equipamento somado dos cinco no round (não prova intenção de "
                 "compra): pistol = rounds 1 e 13; eco < 10000; force 10000 a 19999; full >= 20000. "
                 "taxa_vitoria_pct = % de rounds vencidos naquela compra (0-100). pct_dos_rounds = "
                 "quanto dos rounds do time caiu naquela categoria. round_apos_pistol = rounds 2 e 14. "
                 "contra_compra_adversario exclui pistol.",
    }
