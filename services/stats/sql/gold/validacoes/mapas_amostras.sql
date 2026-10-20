-- Tres plants por mapa. Coordenadas candidatas, NAO publicadas na API.
-- Nao limitar u/v a 0..1: isso esconderia erros de calibracao.
WITH candidatos AS (
  SELECT m.id AS mapa_id, m.nome, e.partida_id, e.`round`, e.id AS evento_id,
    e.site, e.posicao.x AS x_original, e.posicao.y AS y_original,
    m.status_calibracao,
    e.posicao.x * m.transformacao_candidata.u_x
      + e.posicao.y * m.transformacao_candidata.u_y
      + m.transformacao_candidata.u_offset AS u_candidato,
    e.posicao.x * m.transformacao_candidata.v_x
      + e.posicao.y * m.transformacao_candidata.v_y
      + m.transformacao_candidata.v_offset AS v_candidato
  FROM `datropa.valorant.chico_teste_eventos_round` e
  JOIN `datropa.valorant.chico_teste_mapas` m ON m.id = e.mapa_id
  WHERE e.tipo = 'plant' AND e.posicao IS NOT NULL
  QUALIFY ROW_NUMBER() OVER (PARTITION BY m.id ORDER BY e.partida_id, e.`round`, e.id) <= 3
)
SELECT *, u_candidato BETWEEN 0 AND 1 AND v_candidato BETWEEN 0 AND 1 AS dentro_imagem
FROM candidatos ORDER BY mapa_id, partida_id, `round`;
