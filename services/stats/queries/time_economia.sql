WITH identidade AS (
  SELECT time_id
  FROM `datropa.valorant.stats_time_partida`
  WHERE time_id = @time_id
  GROUP BY time_id
),
recorte AS (
  SELECT categoria, venceu
  FROM `datropa.valorant.economia_time_round`
  WHERE time_id = @time_id
    AND (@mapa_id IS NULL OR mapa_id = @mapa_id)
    AND (@torneio_id IS NULL OR torneio_id = @torneio_id)
    AND (
      @data_inicio IS NULL
      OR data_partida_utc >= @data_inicio
    )
    AND (
      @data_fim IS NULL
      OR data_partida_utc <= @data_fim
    )
),
totais AS (
  SELECT
    categoria,
    COUNT(*) AS rounds,
    COUNTIF(venceu IS TRUE) AS vitorias,
    COUNTIF(venceu IS NULL) AS resultados_desconhecidos
  FROM recorte
  WHERE categoria IS NOT NULL
  GROUP BY categoria
),
categorias AS (
  SELECT
    tipo,
    ordem,
    COALESCE(t.rounds, 0) AS rounds,
    COALESCE(t.vitorias, 0) AS vitorias,
    IF(
      COALESCE(t.resultados_desconhecidos, 0) = 0,
      100.0 * SAFE_DIVIDE(t.vitorias, t.rounds),
      NULL
    ) AS taxa_vitoria_pct
  FROM UNNEST([
    STRUCT('pistol' AS tipo, 1 AS ordem),
    STRUCT('eco' AS tipo, 2 AS ordem),
    STRUCT('force' AS tipo, 3 AS ordem),
    STRUCT('full' AS tipo, 4 AS ordem)
  ]) c
  LEFT JOIN totais t ON t.categoria = c.tipo
),
lista AS (
  SELECT ARRAY_AGG(
    STRUCT(tipo, rounds, vitorias, taxa_vitoria_pct)
    ORDER BY ordem
  ) AS categorias
  FROM categorias
),
sem_classificacao AS (
  SELECT COUNTIF(categoria IS NULL) AS rounds_sem_classificacao
  FROM recorte
)
SELECT
  i.time_id,
  l.categorias,
  'equipamento_time_10000_20000_pistol_v2'
    AS classificacao_versao,
  s.rounds_sem_classificacao
FROM identidade i
CROSS JOIN lista l
CROSS JOIN sem_classificacao s;