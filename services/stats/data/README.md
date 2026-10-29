# Catálogos de tradução de UUID

Snapshot da API comunitária https://valorant-api.com, consultado em 20/10/2026 UTC (19/10 no Brasil), com language=pt-BR.

- agentes.json: /v1/agents?language=pt-BR&isPlayableCharacter=true; campos uuid, nome e classe (role.displayName).
- armas.json: /v1/weapons?language=pt-BR; campos uuid e nome. Inclui combate corpo a corpo, retornado como Confronto.
- armaduras.json: /v1/gear?language=pt-BR; campos uuid e nome.

São catálogos estáticos completos retornados na consulta, não dados de partida. Ainda não foram cruzados com os UUIDs da base oficial; entradas desconhecidas devem preservar o UUID, sem adivinhar o nome. UUID vazio ou ausência de equipamento não deve ser tratado como item destes catálogos.

A confirmação da organização para uso desta fonte externa continua pendente no contexto disponível. Este PR não liga os catálogos ao serviço nem os carrega no BigQuery. Não inclui imagens, credenciais ou arquivos de partidas.

Validação da extração: parse de JSON, sintaxe de UUID, unicidade por catálogo e classes limitadas a Iniciador, Duelista, Sentinela e Controlador.
