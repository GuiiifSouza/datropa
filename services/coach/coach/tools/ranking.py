"""ranking_jogadores e ranking_times: quem lidera um critério num recorte do campeonato.

Respondem "quem foi o melhor jogador da fase de grupos" e "qual time converte
melhor depois de plantar". O critério é sempre explícito (o modelo escolhe por
enum e a resposta devolve qual foi). Mesmas regras da gold que as outras tools:
filtro antes de agregar, razões recalculadas pelos totais, ADR, HS% e taxas de
pós-plant/retake null quando o recorte tem registro com alerta, e mínimo de
partidas para não premiar amostra pequena.
"""

from __future__ import annotations

from .. import catalogos
from ..bq import Consulta
from . import ErroTool, resolver_mapa, tool
from .ids import resolver_time

MIN_PARTIDAS_PADRAO = 3
LIMITE_PADRAO = 5
LIMITE_MAX = 10
# Taxa de pós-plant/retake com menos oportunidades que isso não entra no ranking.
MIN_OPORTUNIDADES = 10

ORDENS_JOGADOR = ("acs", "kd", "adr", "hs_pct", "kills", "first_bloods")
ORDENS_TIME = ("taxa_vitoria", "taxa_rounds", "ataque", "defesa", "pos_plant", "retake")

_FILTRO_TORNEIO_MAPA = """(@torneio_re IS NULL OR REGEXP_CONTAINS(torneio_id, @torneio_re))
    AND (@mapa_id IS NULL OR mapa_id = @mapa_id)"""

JOGADORES = Consulta(
    nome="ranking.jogadores",
    tipos={"torneio_re": "STRING", "mapa_id": "STRING", "agentes": "STRING", "time_id": "STRING",
           "min_partidas": "INT64", "ordem": "STRING", "limite": "INT64"},
    exemplo={"torneio_re": r"^UNIVAVA_G$", "mapa_id": None, "agentes": "", "time_id": None,
             "min_partidas": 3, "ordem": "acs", "limite": 5},
    sql=lambda t: f"""
WITH base AS (
  SELECT *
  FROM {t("stats_jogador_partida")}
  WHERE {_FILTRO_TORNEIO_MAPA}
    AND (@agentes = '' OR agente_id IN UNNEST(SPLIT(@agentes, ',')))
    AND (@time_id IS NULL OR time_id = @time_id)
), agregado AS (
  SELECT jogador_id,
    (ARRAY_AGG(STRUCT(nome, tag, time_nome) ORDER BY inicio DESC, partida_id DESC LIMIT 1))[OFFSET(0)] AS identidade,
    COUNT(DISTINCT partida_id) AS partidas,
    COUNTIF(venceu) AS vitorias,
    SUM(rounds) AS rounds, SUM(kills) AS kills, SUM(deaths) AS deaths, SUM(assists) AS assists,
    SAFE_DIVIDE(SUM(score), SUM(rounds)) AS acs,
    SAFE_DIVIDE(SUM(kills), SUM(deaths)) AS kd,
    IF(COUNTIF(status_qualidade != 'ok') = 0, SAFE_DIVIDE(SUM(dano_total), SUM(rounds)), NULL) AS adr,
    IF(COUNTIF(status_qualidade != 'ok') = 0,
      100.0 * SAFE_DIVIDE(SUM(headshots), SUM(headshots) + SUM(bodyshots) + SUM(legshots)), NULL) AS hs_pct,
    SUM(first_bloods) AS first_bloods, SUM(first_deaths) AS first_deaths
  FROM base
  GROUP BY jogador_id
)
SELECT *, COUNT(*) OVER () AS jogadores_no_recorte
FROM agregado
WHERE partidas >= @min_partidas
ORDER BY CASE @ordem
    WHEN 'acs' THEN acs WHEN 'kd' THEN kd WHEN 'adr' THEN adr WHEN 'hs_pct' THEN hs_pct
    WHEN 'kills' THEN kills WHEN 'first_bloods' THEN first_bloods END DESC NULLS LAST,
  rounds DESC, jogador_id
LIMIT @limite
""",
)

TIMES = Consulta(
    nome="ranking.times",
    tipos={"torneio_re": "STRING", "mapa_id": "STRING", "min_partidas": "INT64",
           "min_oportunidades": "INT64", "ordem": "STRING", "limite": "INT64"},
    exemplo={"torneio_re": None, "mapa_id": None, "min_partidas": 3, "min_oportunidades": 10,
             "ordem": "pos_plant", "limite": 5},
    sql=lambda t: f"""
WITH resultado AS (
  SELECT time_id,
    (ARRAY_AGG(nome ORDER BY inicio DESC, partida_id DESC LIMIT 1))[OFFSET(0)] AS nome,
    COUNT(DISTINCT partida_id) AS partidas,
    COUNTIF(venceu) AS vitorias,
    SUM(rounds_jogados) AS rounds_jogados, SUM(rounds_ganhos) AS rounds_ganhos,
    SUM(rounds_ataque) AS rounds_ataque, SUM(vitorias_ataque) AS vitorias_ataque,
    SUM(rounds_defesa) AS rounds_defesa, SUM(vitorias_defesa) AS vitorias_defesa
  FROM {t("stats_time_partida")}
  WHERE {_FILTRO_TORNEIO_MAPA}
  GROUP BY time_id
), plant AS (
  SELECT time_id,
    SUM(pos_plant_oportunidades) AS pos_plant_oportunidades, SUM(pos_plant_vitorias) AS pos_plant_vitorias,
    SUM(retake_oportunidades) AS retake_oportunidades, SUM(retake_vitorias) AS retake_vitorias,
    COUNTIF(status_qualidade != 'ok') AS alertas_plant
  FROM {t("pos_plant_retake_partida")}
  WHERE {_FILTRO_TORNEIO_MAPA}
  GROUP BY time_id
), juntos AS (
  SELECT r.*, p.pos_plant_oportunidades, p.pos_plant_vitorias, p.retake_oportunidades, p.retake_vitorias,
    100.0 * SAFE_DIVIDE(r.vitorias, r.partidas) AS taxa_vitoria_pct,
    100.0 * SAFE_DIVIDE(r.rounds_ganhos, r.rounds_jogados) AS taxa_rounds_pct,
    100.0 * SAFE_DIVIDE(r.vitorias_ataque, r.rounds_ataque) AS taxa_ataque_pct,
    100.0 * SAFE_DIVIDE(r.vitorias_defesa, r.rounds_defesa) AS taxa_defesa_pct,
    IF(p.alertas_plant = 0, 100.0 * SAFE_DIVIDE(p.pos_plant_vitorias, p.pos_plant_oportunidades), NULL)
      AS pos_plant_taxa_sucesso_pct,
    IF(p.alertas_plant = 0, 100.0 * SAFE_DIVIDE(p.retake_vitorias, p.retake_oportunidades), NULL)
      AS retake_taxa_sucesso_pct
  FROM resultado r
  LEFT JOIN plant p USING (time_id)
  WHERE r.partidas >= @min_partidas
    AND CASE @ordem
      WHEN 'pos_plant' THEN COALESCE(p.pos_plant_oportunidades, 0) >= @min_oportunidades
      WHEN 'retake' THEN COALESCE(p.retake_oportunidades, 0) >= @min_oportunidades
      ELSE TRUE END
)
SELECT *, COUNT(*) OVER () AS times_no_recorte
FROM juntos
ORDER BY CASE @ordem
    WHEN 'taxa_vitoria' THEN taxa_vitoria_pct WHEN 'taxa_rounds' THEN taxa_rounds_pct
    WHEN 'ataque' THEN taxa_ataque_pct WHEN 'defesa' THEN taxa_defesa_pct
    WHEN 'pos_plant' THEN pos_plant_taxa_sucesso_pct WHEN 'retake' THEN retake_taxa_sucesso_pct END DESC NULLS LAST,
  CASE @ordem
    WHEN 'pos_plant' THEN pos_plant_oportunidades WHEN 'retake' THEN retake_oportunidades
    WHEN 'ataque' THEN rounds_ataque WHEN 'defesa' THEN rounds_defesa ELSE rounds_jogados END DESC,
  time_id
LIMIT @limite
""",
)

_TORNEIO_PARAM = {
    "type": "string",
    "enum": list(catalogos.TORNEIOS),
    "description": "Torneio ou fase. Opcional; sem ele, a base inteira. "
                   + "; ".join(f"{k} = {v[0]}" for k, v in catalogos.TORNEIOS.items()) + ".",
}
_LIMITE_PARAM = {"type": "integer", "description": f"Quantos devolver, de 1 a {LIMITE_MAX}. Padrão {LIMITE_PADRAO}."}
_MIN_PARTIDAS_PARAM = {"type": "integer",
                       "description": "Mínimo de partidas (mapas) no recorte para entrar. "
                                      f"Padrão {MIN_PARTIDAS_PADRAO}."}


def _recorte(torneio: str | None, mapa: str | None, limite: int | None, min_partidas: int | None):
    if torneio and torneio not in catalogos.TORNEIOS:
        raise ErroTool(f"torneio desconhecido: {torneio}. Torneios: {', '.join(catalogos.TORNEIOS)}")
    m = resolver_mapa(mapa)
    limite = max(1, min(int(limite or LIMITE_PADRAO), LIMITE_MAX))
    min_partidas = max(1, int(min_partidas or MIN_PARTIDAS_PADRAO))
    regex = catalogos.TORNEIOS[torneio][1] if torneio else None
    filtros = {"torneio": catalogos.TORNEIOS[torneio][0] if torneio else None,
               "mapa": catalogos.nome_mapa(m), "min_partidas": min_partidas}
    return regex, m, limite, min_partidas, filtros


@tool(
    nome="ranking_jogadores",
    descricao=(
        "Ranking de jogadores num recorte: quem lidera em ACS, K/D, ADR, HS%, abates ou first "
        "bloods, com filtro opcional de torneio/fase, mapa, agente, função (classe) e time. Use "
        "para 'melhor jogador do campeonato/da fase/do mapa', 'quem mais abate', 'melhores "
        "duelistas'. Sem critério dito pelo usuário, use acs e diga que o critério foi ACS. Só "
        "entra quem tem o mínimo de partidas no recorte."
    ),
    parametros={
        "type": "object",
        "properties": {
            "ordenar_por": {"type": "string", "enum": list(ORDENS_JOGADOR),
                            "description": "Critério. acs = score por round (padrão para 'melhor')."},
            "torneio": _TORNEIO_PARAM,
            "mapa": {"type": "string", "description": "Nome do mapa, ex.: Lotus. Opcional."},
            "agente": {"type": "string", "description": "Nome do agente, ex.: Jett. Opcional."},
            "classe": {"type": "string", "enum": list(catalogos.CLASSES),
                       "description": "Função do agente jogado. Conta só as partidas com agente "
                                      "dessa classe. Opcional."},
            "time_id": {"type": "string", "description": "Só jogadores deste time (id de buscar_entidade). Opcional."},
            "min_partidas": _MIN_PARTIDAS_PARAM,
            "limite": _LIMITE_PARAM,
        },
        "required": ["ordenar_por"],
    },
)
def ranking_jogadores(ordenar_por: str, torneio: str | None = None, mapa: str | None = None,
                      agente: str | None = None, classe: str | None = None, time_id: str | None = None,
                      min_partidas: int | None = None, limite: int | None = None) -> dict:
    if ordenar_por not in ORDENS_JOGADOR:
        raise ErroTool(f"ordenar_por inválido: {ordenar_por}. Opções: {', '.join(ORDENS_JOGADOR)}")
    regex, m, limite, min_partidas, filtros = _recorte(torneio, mapa, limite, min_partidas)
    agentes: list[str] = []
    if agente:
        a = catalogos.agente_id(agente)
        if not a:
            raise ErroTool(f"agente desconhecido: {agente}")
        agentes = [a]
    if classe:
        da_classe = catalogos.agentes_da_classe(classe)
        if not da_classe:
            raise ErroTool(f"classe desconhecida: {classe}. Classes: {', '.join(catalogos.CLASSES)}")
        agentes = [a for a in agentes if a in da_classe] if agentes else da_classe
        if not agentes:
            raise ErroTool(f"o agente {agente} não é da classe {classe}")
    time_id = resolver_time(time_id) if time_id else None

    linhas = JOGADORES.rodar(torneio_re=regex, mapa_id=m, agentes=",".join(agentes), time_id=time_id,
                             min_partidas=min_partidas, ordem=ordenar_por, limite=limite)
    if not linhas:
        raise ErroTool(f"nenhum jogador com {min_partidas}+ partidas nesse recorte; tente min_partidas menor")

    total = linhas[0]["jogadores_no_recorte"]
    ranking = []
    for i, l in enumerate(linhas, 1):
        ident = l.pop("identidade")
        l.pop("jogadores_no_recorte")
        acs = l.pop("acs")
        ranking.append({
            "posicao": i,
            "jogador": f"{ident['nome']}#{ident['tag']}" if ident["tag"] else ident["nome"],
            "time": ident["time_nome"],
            "acs": round(acs, 1) if acs is not None else None,
            **l,
        })
    return {
        "criterio": ordenar_por,
        "filtros": {**filtros, "agente": catalogos.nome_agente(agentes[0]) if agente else None,
                    "classe": classe, "time_id": time_id},
        "jogadores_no_recorte": total,
        "ranking": ranking,
        "notas": "acs = score / rounds. kd = kills/deaths. adr = dano a adversários por round. hs_pct = % de "
                 "tiros na cabeça entre os acertos. jogadores_no_recorte = quantos têm o mínimo de partidas "
                 "no recorte. time = time na partida mais recente do recorte. null = indisponível.",
    }


@tool(
    nome="ranking_times",
    descricao=(
        "Ranking de times num recorte: quem lidera em taxa de vitória, % de rounds ganhos, "
        "rounds de ataque, rounds de defesa, conversão pós-plant ou retake, com filtro opcional "
        "de torneio/fase e mapa. Use para 'qual time converte melhor depois de plantar', 'melhor "
        "defesa do campeonato', 'quem mais ganha na fase de grupos'. Só entra time com o mínimo "
        "de partidas (e, em pos_plant/retake, com 10+ oportunidades)."
    ),
    parametros={
        "type": "object",
        "properties": {
            "ordenar_por": {"type": "string", "enum": list(ORDENS_TIME),
                            "description": "Critério. taxa_vitoria = % de partidas vencidas; taxa_rounds = % de "
                                           "rounds; ataque/defesa = % de rounds ganhos no lado; pos_plant = % "
                                           "de rounds de ataque com plant vencidos; retake = % de rounds de "
                                           "defesa com plant adversário vencidos."},
            "torneio": _TORNEIO_PARAM,
            "mapa": {"type": "string", "description": "Nome do mapa, ex.: Lotus. Opcional."},
            "min_partidas": _MIN_PARTIDAS_PARAM,
            "limite": _LIMITE_PARAM,
        },
        "required": ["ordenar_por"],
    },
)
def ranking_times(ordenar_por: str, torneio: str | None = None, mapa: str | None = None,
                  min_partidas: int | None = None, limite: int | None = None) -> dict:
    if ordenar_por not in ORDENS_TIME:
        raise ErroTool(f"ordenar_por inválido: {ordenar_por}. Opções: {', '.join(ORDENS_TIME)}")
    regex, m, limite, min_partidas, filtros = _recorte(torneio, mapa, limite, min_partidas)

    linhas = TIMES.rodar(torneio_re=regex, mapa_id=m, min_partidas=min_partidas,
                         min_oportunidades=MIN_OPORTUNIDADES, ordem=ordenar_por, limite=limite)
    if not linhas:
        raise ErroTool(f"nenhum time com {min_partidas}+ partidas nesse recorte; tente min_partidas menor")

    total = linhas[0]["times_no_recorte"]
    ranking = []
    for i, l in enumerate(linhas, 1):
        ranking.append({
            "posicao": i, "time": l["nome"], "time_id": l["time_id"],
            "partidas": l["partidas"], "vitorias": l["vitorias"], "taxa_vitoria_pct": l["taxa_vitoria_pct"],
            "rounds_jogados": l["rounds_jogados"], "taxa_rounds_pct": l["taxa_rounds_pct"],
            "ataque": {"rounds": l["rounds_ataque"], "vitorias": l["vitorias_ataque"],
                       "taxa_pct": l["taxa_ataque_pct"]},
            "defesa": {"rounds": l["rounds_defesa"], "vitorias": l["vitorias_defesa"],
                       "taxa_pct": l["taxa_defesa_pct"]},
            "pos_plant": {"oportunidades": l["pos_plant_oportunidades"], "vitorias": l["pos_plant_vitorias"],
                          "taxa_sucesso_pct": l["pos_plant_taxa_sucesso_pct"]},
            "retake": {"oportunidades": l["retake_oportunidades"], "vitorias": l["retake_vitorias"],
                       "taxa_sucesso_pct": l["retake_taxa_sucesso_pct"]},
        })
    return {
        "criterio": ordenar_por,
        "filtros": {**filtros, "min_oportunidades_plant": MIN_OPORTUNIDADES
                    if ordenar_por in ("pos_plant", "retake") else None},
        "times_no_recorte": total,
        "ranking": ranking,
        "notas": "Taxas em 0-100, recalculadas pelos totais do recorte. pos_plant = rounds de ataque com "
                 "plant; vitória = o ataque venceu. retake = rounds de defesa com plant do adversário; "
                 "vitória = a defesa venceu mesmo assim (mede o resultado, não prova tentativa de retake). "
                 "times_no_recorte = quantos passaram nos mínimos. null = indisponível.",
    }
