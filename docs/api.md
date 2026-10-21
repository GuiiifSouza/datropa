# Contrato da API — proposta v0.1

**Responsável:** gugu. **Estado:** rascunho para revisão; não descreve endpoints já implementados.
Os nomes de campos e rotas abaixo são propostas. Chico valida os dados e métricas; RhuanK e Lhobregat validam o consumo; Guilherme valida as tools do coach.
Exemplos inteiramente fictícios. Não são resultados da base.

## 1. Regras gerais

- Base: `/api/stats`. Todos os endpoints abaixo são GET, somente leitura.
- Todo endpoint de dados valida `Authorization: Bearer <ID token do Firebase>` no próprio serviço.
- JSON UTF-8. Datas de partida: ISO 8601 UTC, quando disponíveis.
- IDs são strings opacas e estáveis, não nomes de exibição. Jogador deriva do puuid; partida é um mapa jogado, não uma série. Chico confirma o mapeamento final de IDs de time, mapa e agente.
- Time não é identificado por Red/Blue. Não juntar equipes por prefixo do nome.
- Filtros: `torneio_id`, `mapa_id`, `data_inicio`, `data_fim` (datas YYYY-MM-DD, inclusivas em UTC). Só se aplicam onde indicados.
- Coleções usam `page` (padrão 1) e `page_size` (padrão 20, máximo 100); inteiros positivos. Ordem estável, com ID como desempate.
- Percentuais em 0–100; taxas e razões sem unidade adicional. Dano em pontos; tempos de evento em milissegundos desde o início do round.
- Valor indisponível ou divisão por zero: `null`, nunca zero inventado. Campo obrigatório permanece presente mesmo quando null.
- Lista sem resultados: 200 com `data: []`. Entidade inexistente: 404.
- Filtro desconhecido, inválido, repetido ou não suportado: 400; não ignorar silenciosamente.
- Ordenações aceitas em listas: especificadas em cada rota; não interpolar campos de ordenação diretamente no SQL.
- Até a validação do contrato, alterações são propostas; depois, mudar formato exige atualização deste documento e aviso ao front.

### Envelope

Objeto: `{"data": {...}, "meta": {"atualizado_em": null}}`.

Lista: `{"data": [], "pagination": {"page": 1, "page_size": 20, "total": 0}, "meta": {"atualizado_em": null}}`.

`total` é o total após filtros, antes da paginação. `atualizado_em` é a atualização dos dados de origem em UTC, não o horário da requisição; null se desconhecido.

### Erros

Formato: `{"error": {"code": "INVALID_ARGUMENT", "message": "page_size deve estar entre 1 e 100", "details": {"field": "page_size"}}}`.

| HTTP | code | Quando |
|---|---|---|
| 400 | INVALID_ARGUMENT | Parâmetro ou combinação inválida |
| 401 | UNAUTHENTICATED | Token ausente, inválido ou expirado |
| 403 | FORBIDDEN | Usuário autenticado sem autorização |
| 404 | NOT_FOUND | Entidade ou round inexistente |
| 429 | RATE_LIMITED | Limite de requisições; informar Retry-After |
| 503 | DATA_UNAVAILABLE | Gold indisponível, recurso ainda não publicado ou limite de consulta atingido |
| 500 | INTERNAL | Falha inesperada |

Não devolver SQL, credenciais ou detalhes internos de infraestrutura. Dado ainda não carregado não vira lista vazia nem estatística zerada.

## 2. Catálogos e busca

### GET /catalogos

Sem paginação; retorna os catálogos pequenos usados nos filtros e a tradução de UUID.
Exemplo de `data`:
```json
{
  "torneios": [{"id":"torneio-demo","nome":"Torneio Exemplo"}],
  "mapas": [{"id":"mapa-demo","nome":"Mapa Exemplo","minimapa_url":null,"transformacao":{"u_x":0.0,"u_y":0.00007,"u_offset":0.81,"v_x":-0.00007,"v_y":0.0,"v_offset":0.57}}],
  "agentes": [{"id":"agente-demo","uuid":"uuid-demo","nome":"Agente Exemplo","icone_url":null}],
  "armas": [{"id":"arma-demo","uuid":"uuid-arma-demo","nome":"Arma Exemplo","icone_url":null}],
  "armaduras": [{"id":"armadura-demo","uuid":"uuid-armadura-demo","nome":"Armadura Exemplo"}]
}
```
IDs desconhecidos preservam o UUID e usam nome/ícone null. Ícones, minimapas e fontes externas dependem de autorização/licença; não são requisito para responder.

### GET /busca?q=exemplo&tipo=time

`q`: obrigatório, 2–100 caracteres após trim. `tipo`: opcional, time/jogador/mapa. Usa paginação; ordena por relevância e ID.
Exemplo de item: `{"tipo":"time","id":"time-demo","nome":"Time Exemplo"}`.
Busca tolerante a caixa e acentos; correspondências ambíguas retornam todos os candidatos, sem escolher silenciosamente.

## 3. Estatísticas principais

### GET /ranking

Filtros gerais + `agente_id`, `time_id`, paginação. `ordem`: kills_desc (padrão), kd_desc ou adr_desc; nulos no fim.
Exemplo completo:
```json
{
  "data": [{
    "jogador_id":"jogador-demo",
    "nome":"Jogador Exemplo",
    "time_id":"time-demo",
    "partidas":5,
    "rounds":100,
    "kills":90,
    "deaths":60,
    "assists":25,
    "kd":1.5,
    "adr":140.0,
    "hs_pct":25.0,
    "first_bloods":12
  }],
  "pagination":{"page":1,"page_size":20,"total":1},
  "meta":{"atualizado_em":null}
}
```
`time_id` só é preenchido quando o recorte contém um único time para o jogador; caso contrário null. Não atribuir todo o histórico ao último time.

### GET /jogadores/{jogador_id}

Filtros gerais + `agente_id`. Objeto em data:
```json
{
  "id":"jogador-demo",
  "nome":"Jogador Exemplo",
  "times":[{"id":"time-demo","nome":"Time Exemplo"}],
  "resumo":{"partidas":5,"rounds":100,"kills":90,"deaths":60,"assists":25,"kd":1.5,"adr":140.0,"hs_pct":25.0,"first_bloods":12},
  "agentes":[{"agente_id":"agente-demo","partidas":5,"vitorias":3,"taxa_vitoria_pct":60.0}],
  "mapas":[{"mapa_id":"mapa-demo","partidas":5,"vitorias":3,"taxa_vitoria_pct":60.0}]
}
```
Times representam o recorte filtrado. Um jogador conhecido sem partidas no recorte retorna resumo com contagens zero e taxas null.

### GET /times

Filtros gerais, paginação. Ordena nome crescente e ID.
Item: `{"id":"time-demo","nome":"Time Exemplo","partidas":5,"vitorias":3,"derrotas":2,"empates":0,"taxa_vitoria_pct":60.0}`.

### GET /times/{time_id}

Filtros gerais. Objeto:
```json
{
  "id":"time-demo",
  "nome":"Time Exemplo",
  "resumo":{"partidas":5,"vitorias":3,"derrotas":2,"empates":0,"taxa_vitoria_pct":60.0,"rounds_jogados":100,"rounds_ganhos":55},
  "lados":[{"lado":"ataque","rounds_jogados":50,"rounds_ganhos":30,"taxa_vitoria_pct":60.0},{"lado":"defesa","rounds_jogados":50,"rounds_ganhos":25,"taxa_vitoria_pct":50.0}],
  "mapas":[{"mapa_id":"mapa-demo","partidas":5,"vitorias":3,"taxa_vitoria_pct":60.0}]
}
```
Elenco histórico não significa elenco atual; se necessário, consultar os jogadores de cada partida.

### GET /mapas e GET /agentes

Filtros gerais, paginação; ordem nome e ID.
Item de mapa: `{"id":"mapa-demo","nome":"Mapa Exemplo","partidas":5}`.
Item de agente: `{"id":"agente-demo","nome":"Agente Exemplo","aparicoes":10,"vitorias":5,"taxa_vitoria_pct":50.0}`.
Aparição de agente corresponde a jogador por mapa. Chico confirma a deduplicação e o denominador final.

### GET /partidas

Filtros gerais + `time_id`, `jogador_id`; paginação. Ordem inicio_desc, ID como desempate; início desconhecido no fim.
Item:
```json
{"id":"partida-demo","torneio_id":"torneio-demo","mapa_id":"mapa-demo","inicio":null,"times":[{"id":"time-demo","nome":"Time Exemplo","rounds_ganhos":13},{"id":"time-b-demo","nome":"Time B Exemplo","rounds_ganhos":8}],"vencedor_id":"time-demo"}
```

### GET /partidas/{partida_id}

Sem filtros. Objeto:
```json
{
  "id":"partida-demo","torneio_id":"torneio-demo","mapa_id":"mapa-demo","inicio":null,
  "times":[{"id":"time-demo","nome":"Time Exemplo","rounds_ganhos":13},{"id":"time-b-demo","nome":"Time B Exemplo","rounds_ganhos":8}],
  "vencedor_id":"time-demo",
  "jogadores":[{"jogador_id":"jogador-demo","nome":"Jogador Exemplo","time_id":"time-demo","agente_id":"agente-demo","kills":20,"deaths":12,"assists":5,"adr":140.0,"hs_pct":25.0,"first_bloods":3}],
  "rounds":[{"round":1,"vencedor_id":"time-demo","lado_vencedor":"ataque","resultado":"eliminacao"}],
  "mvp_jogador_id":null,
  "rounds_decisivos":[]
}
```
Resultados normalizados: eliminacao, detonacao, desarme, tempo ou outro. Preservar null quando desconhecido. MVP e rounds decisivos só preenchidos após critério acordado; não inventar classificação.

## 4. Análise coletiva

Todas as rotas de time abaixo aceitam filtros gerais; retornam objeto em data.

### GET /times/{time_id}/economia

```json
{"time_id":"time-demo","categorias":[{"tipo":"pistol","rounds":4,"vitorias":2,"taxa_vitoria_pct":50.0},{"tipo":"eco","rounds":10,"vitorias":2,"taxa_vitoria_pct":20.0},{"tipo":"force","rounds":20,"vitorias":8,"taxa_vitoria_pct":40.0},{"tipo":"full","rounds":70,"vitorias":45,"taxa_vitoria_pct":64.2857}],"classificacao_versao":"equipamento_time_10000_20000_pistol_v2","rounds_sem_classificacao":0}
```
Regra da gold (`economia_time_round`, ver `services/stats/sql/gold/ECONOMIA.md`): rounds 1 e 13 são `pistol`; nos demais, soma do equipamento dos cinco: eco < 10000, force < 20000, full ≥ 20000. Rounds com economia incompleta não entram nas taxas e devem ser contabilizados em `rounds_sem_classificacao` (inteiro, obrigatório, 0 no exemplo).

### GET /times/{time_id}/pos-plant-retake

```json
{"time_id":"time-demo","pos_plant":{"oportunidades":20,"vitorias":15,"taxa_sucesso_pct":75.0},"retake":{"oportunidades":10,"vitorias":4,"taxa_sucesso_pct":40.0}}
```
Proposta: pós-plant = ataque venceu entre rounds em que plantou; retake = defesa venceu entre rounds em que sofreu plant. Esta é uma medida de resultado após plant, não prova de tentativa de retake. Validar com chico/front e mostrar rótulo adequado.

### GET /composicoes

Filtros gerais + `time_id`, paginação; ordem aparicoes_desc e composição_id.
Item: `{"composicao_id":"composicao-demo","mapa_id":"mapa-demo","agente_ids":["agente-demo"],"aparicoes":5,"vitorias":3,"taxa_vitoria_pct":60.0}`.
O exemplo abrevia agentes; composição válida representa os cinco slots da equipe por mapa, ordenados para agrupamento. Definir com chico tratamento de composição incompleta.

### GET /comparacoes/times?time_a_id=time-demo&time_b_id=time-b-demo

Dois IDs distintos obrigatórios + filtros gerais. Objeto:
```json
{"time_a":{"id":"time-demo","partidas":5,"vitorias":3,"taxa_vitoria_pct":60.0},"time_b":{"id":"time-b-demo","partidas":5,"vitorias":2,"taxa_vitoria_pct":40.0},"confrontos_diretos":{"partidas":1,"vitorias_a":1,"vitorias_b":0,"empates":0}}
```
Estatísticas gerais usam o mesmo recorte; confrontos diretos são calculados separadamente dentro dele.

## 5. Prancheta e mapa de calor

### GET /partidas/{partida_id}/rounds/{round}/eventos

`round` público começa em 1. A gold já guarda `round` em base 1 (roundNum de origem + 1); não somar 1 de novo.
Sem paginação: retorna todos os eventos do round, ordenados por tempo_ms e ordem.
```json
{
  "data":{
    "partida_id":"partida-demo","mapa_id":"mapa-demo","round":1,
    "eventos":[{
      "id":"evento-demo","ordem":1,"tipo":"abate","tempo_ms":25000,
      "ator_id":"jogador-demo","vitima_id":"jogador-b-demo","assistente_ids":[],
      "arma_id":null,"site":null,
      "posicao":{"x":120.0,"y":-50.0},
      "jogadores":[{"jogador_id":"jogador-demo","time_id":"time-demo","agente_id":"agente-demo","posicao":{"x":110.0,"y":-40.0}}]
    }]
  },
  "meta":{"atualizado_em":null}
}
```
Tipos: abate, plant, defuse. Campos não aplicáveis ficam null; listas desconhecidas ficam vazias. `posicao` é a vítima no abate, a bomba no plant/defuse. Snapshot contém somente posições disponíveis naquele evento; não supor os dez jogadores nem interpolar movimento. Coordenadas são originais do jogo; transformação vem de /catalogos. Sem evento disponível em round existente: eventos vazio.

Transformação de mapa (gold `mapas.transformacao`): `{"u_x":0.0,"u_y":0.00007,"u_offset":0.81,"v_x":-0.00007,"v_y":0.0,"v_offset":0.57}`; `u=x*u_x+y*u_y+u_offset`, `v=x*v_x+y*v_y+v_offset`. u/v são coordenadas normalizadas na imagem inteira do minimapa, origem superior esquerda. Seis campos porque nos mapas do VALORANT os eixos se trocam (u depende de y e v de x); o esquema antigo de quatro campos não representa isso. Números ilustrativos; os reais estão na gold. u/v fora de [0,1] ou não finitos: não desenhar no minimapa, manter o evento na timeline. Transformação desconhecida é null.

### GET /mapas/{mapa_id}/calor

Filtros gerais (mapa dado pelo path) + `time_id`, `jogador_id`, `tipo` obrigatório (abate/plant), paginação.
Item: `{"partida_id":"partida-demo","round":1,"evento_id":"evento-demo","x":120.0,"y":-50.0,"peso":1}`.
Abate representa a posição da vítima, filtrado pelo autor quando jogador_id/time_id forem informados; plant, posição da bomba, filtrado pelo planter/time atacante. Coordenadas originais, sem agregação nesta versão. Front deve percorrer páginas para o recorte completo, sem apresentar página parcial como total.

## 6. Tools do coach — proposta para Guilherme

Estas são funções internas do coach, não novas rotas HTTP. Cada tool consulta gold com SQL pronto e parametrizado. O coach valida seu próprio JWT.

| Tool | Parâmetros propostos | Resposta de referência |
|---|---|---|
| buscar_entidade | texto obrigatório, tipo opcional | lista de candidatos de /busca |
| stats_jogador | jogador_id, mapa_id?, agente_id? | /jogadores/{id} |
| stats_time | time_id, mapa_id? | /times/{id} |
| comparar_times | time_a_id, time_b_id, mapa_id? | /comparacoes/times |
| economia_time | time_id, mapa_id? | /times/{id}/economia |
| pos_plant_retake | time_id, mapa_id? | /times/{id}/pos-plant-retake |
| composicoes | time_id?, mapa_id?, page?, page_size? | /composicoes |
| resumo_partida | partida_id | /partidas/{id} |
| abrir_na_prancheta | partida_id, round (base 1) | exemplo abaixo |

Saída proposta de abrir_na_prancheta: `{"partida_id":"partida-demo","round":1,"url":"/prancheta?partida_id=partida-demo&round=1"}`.
O caminho do front depende de validação por Lhobregat. O coach só gera link após verificar existência da partida e do round.
Busca ambígua exige desambiguação antes das tools por ID.
`consulta_livre` não faz parte deste contrato; permanece desligada por padrão.

## 7. Métricas para validar com chico

- K/D = kills/deaths; deaths zero produz null.
- ADR = dano total a adversários / rounds jogados; confirmar exclusão de dano aliado e observadores.
- HS% proposto = headshots / (headshots + bodyshots + legshots) * 100, pelos registros de dano; não confundir com percentual de abates de headshot.
- First blood = primeiro abate válido por round; confirmar desempate e exclusão de eventos inválidos.
- Taxa de vitória = vitórias/oportunidades * 100. Sem oportunidades: null.
- Agregações recalculam razões pelos totais; nunca média simples das porcentagens de partidas.
- Observadores excluídos; lado real por round, inclusive overtime, sem inferir ataque/defesa por Red/Blue.
- Não disponibilizar elo: competitiveTier é zero na base.
- Não prometer posições contínuas nem habilidades por round: a base fornece snapshots e contagens de habilidade por partida.
- MVP e rounds decisivos continuam pendentes. Classificação econômica e transformação de mapa estão definidas na gold (seções 4 e 5).

## 8. Implementação e cache

- Consultas somente na gold, parametrizadas e com maximum_bytes_billed.
- Cache no Firestore após validar autenticação. Chave inclui rota, filtros normalizados, paginação, versão do contrato e versão da carga gold.
- TTL proposto: 5 minutos. Cache vencido não deve ser servido como atual; invalidar ao atualizar a gold.
- Não guardar tokens no cache. Se houver escopo por usuário no futuro, incluir esse escopo na chave.
- Linguagem/framework ainda a escolher por gugu e registrar no README de services/stats.
- Container no Cloud Run; permissões, secrets, deploy e configurações ficam com Guilherme.
- Sem SQL neste documento: nenhum dry run ou chamada paga foi executado.

## 9. Validação antes de chamar de definitivo

| Pessoa | Confirmar |
|---|---|
| chico | Tabelas/colunas gold, IDs estáveis, filtros, métricas, timezone da origem, eventos e transformação |
| RhuanK | Campos de ranking, jogador, time, partida, gráficos e estados sem dados |
| Lhobregat | Snapshots, coordenadas, paginação de calor, round base 1 e URL da prancheta |
| Guilherme | Assinaturas das tools, política de autenticação/cache e disponibilização do serviço |
| gugu | Implementação, exemplos consistentes e erros conforme contrato |

Critérios de verificação após implementar: token ausente/inválido; paginação e filtros; entidade inexistente versus recorte vazio; divisões por zero; jogador em vários times; round 1 correspondendo ao índice 0; transformação conferida em três plants por mapa; cache após nova carga.
Nenhuma rota foi implementada ou testada por este documento.
