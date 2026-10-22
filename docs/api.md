# Contrato da API — v0.2 em desenvolvimento

Responsável: Gugu.

Estado: as rotas descritas neste contrato foram implementadas no backend.
As funcionalidades foram verificadas por chamadas manuais no Cloud Shell;
a cobertura automatizada varia por rota. A revisão final de aderência ao
contrato, integração com o frontend e deploy ainda estão pendentes.

Chico prepara e valida consultas SQL; RhuanK e Lhobregat validam o
consumo pelo frontend; Guilherme valida as tools e a política do coach.

Os exemplos JSON abaixo são fictícios, não resultados da base.

## 1. Regras gerais

- Base: `/api/stats`.
- Rotas de estatísticas públicas, GET e somente leitura.
- Não exigem cadastro, login ou token Firebase.
- Essa decisão não altera a política de acesso do coach, as regras
  da prancheta ou a hospedagem do frontend.
- Credenciais do Google Cloud ficam exclusivamente no backend.
- Consultas somente na Gold; nunca consultar Bronze pelas rotas.
- JSON UTF-8.
- Datas e filtros em UTC.
- IDs são strings opacas; não confundir identificadores com nomes.
- Jogador deriva do puuid; partida representa um mapa jogado.
- `nome` de jogador é sempre o nick da partida mais recente do jogador
  no histórico inteiro, com ou sem filtro (ranking, busca, detalhe do
  jogador e detalhe da partida). O nick usado numa partida específica
  aparece só em `jogadores[].nome_partida` do detalhe da partida.
- Times usam IDs da Gold, não Red/Blue; não juntar por prefixo do nome.
- Filtros gerais: `torneio_id`, `mapa_id`, `data_inicio` e `data_fim`.
- Datas de filtro usam YYYY-MM-DD, inclusivas.
- Início desconhecido permanece null; filtros de data excluem
  registros sem data conhecida.
- Coleções usam `page`, padrão 1, e `page_size`, padrão 20, máximo 100.
- Paginação exige inteiros positivos.
- Ordem estável, usando ID como desempate.
- Percentuais em 0–100.
- Tempos de evento em milissegundos desde o início do round.
- Indisponibilidade ou divisão por zero produz null, nunca zero inventado.
- Lista sem resultados: HTTP 200 com `data: []`.
- Entidade inexistente: HTTP 404, nas rotas de detalhe.
- Parâmetro desconhecido, inválido, repetido ou não suportado: HTTP 400.
- Ordenação selecionada por lista fixa de expressões SQL.
- Mudanças de formato exigem atualização deste contrato e alinhamento
  com o frontend.

### Envelope

Objeto:

```json
{
  "data": {},
  "meta": {"atualizado_em": null}
}
```

Lista:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 0
  },
  "meta": {"atualizado_em": null}
}
```

`total` representa o total após os filtros, antes da paginação.

`atualizado_em` é o instante da carga de origem em UTC, não o horário
da requisição. Permanece null enquanto esse instante não estiver disponível.

### Erros

```json
{
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "Valor inválido para page_size.",
    "details": {"field": "page_size"}
  }
}
```

| HTTP | code | Situação |
|---|---|---|
| 400 | INVALID_ARGUMENT | Parâmetro ou combinação inválida |
| 404 | NOT_FOUND | Entidade ou round inexistente |
| 429 | RATE_LIMITED | Limite de requisições; informar Retry-After |
| 503 | DATA_UNAVAILABLE | Dados indisponíveis, falha de consulta ou falta de vaga de execução |
| 500 | INTERNAL | Falha inesperada |

O tratamento uniforme de 404 e 500 e o limite de requisições com
resposta 429 ainda estão pendentes.

A falta de vaga de execução de consultas retorna 503.

Não devolver SQL, credenciais ou detalhes internos de infraestrutura.
Falha de consulta não deve virar lista vazia nem estatística zerada.

## 2. Rotas implementadas

### GET /status

Verifica se o servidor responde. Não consulta nem verifica o BigQuery.

```json
{
  "data": {"status": "ok"},
  "meta": {"atualizado_em": null}
}
```

### GET /ranking

Filtros gerais mais `agente_id` e `time_id`, com paginação.

| Parâmetro | Regra |
|---|---|
| page | Inteiro positivo; padrão 1 |
| page_size | De 1 a 100; padrão 20 |
| ordem | kills_desc, kd_desc ou adr_desc |
| mapa_id | ID do mapa |
| agente_id | ID do agente |
| time_id | ID do time |
| torneio_id | ID do torneio |
| data_inicio | YYYY-MM-DD |
| data_fim | YYYY-MM-DD |

Ordenação padrão: `kills_desc`. Nulos ficam no fim; jogador_id
é usado como desempate. Não há mínimo de partidas para classificação.

Identificadores vazios, com espaços nas extremidades ou com mais
de 256 caracteres são rejeitados.

`data_inicio` não pode ser posterior a `data_fim`.

```json
{
  "data": [
    {
      "jogador_id": "jogador-demo",
      "nome": "Jogador Exemplo",
      "time_id": "time-demo",
      "partidas": 5,
      "rounds": 100,
      "kills": 90,
      "deaths": 60,
      "assists": 25,
      "kd": 1.5,
      "adr": 140.0,
      "hs_pct": 25.0,
      "first_bloods": 12
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "meta": {"atualizado_em": null}
}
```

Sem filtros, usa `ranking_jogador`.

Com filtros, usa `stats_jogador_partida`, aplicando os filtros antes
de agregar e recalculando razões pelos totais.

`time_id` só é preenchido quando há um único time no recorte do jogador.
Não atribuir todo o histórico ao último time.

`nome` é o nick mais recente do jogador no histórico inteiro, mesmo
com filtros. Filtrar por torneio antigo não traz o nick antigo.

ADR e HS% ficam null quando houver alertas de qualidade, conforme
o SQL oficial da Gold.

Uma página além do fim retorna `data: []`, preservando o total do recorte.

## 3. Catálogos e busca

### GET /catalogos

Sem paginação. Retorna catálogos pequenos usados nos filtros.

Exemplo de `data`:

```json
{
  "torneios": [
    {"id": "torneio-demo", "nome": "Torneio Exemplo"}
  ],
  "mapas": [
    {
      "id": "mapa-demo",
      "nome": "Mapa Exemplo",
      "minimapa_url": null,
      "transformacao": {
        "u_x": 0.0,
        "u_y": 0.00007,
        "u_offset": 0.81,
        "v_x": -0.00007,
        "v_y": 0.0,
        "v_offset": 0.57
      }
    }
  ],
  "agentes": [
    {
      "id": "agente-demo",
      "uuid": "uuid-demo",
      "nome": "Agente Exemplo",
      "classe": "Iniciador",
      "icone_url": null
    }
  ],
  "armas": [
    {
      "id": "arma-demo",
      "uuid": "uuid-arma-demo",
      "nome": "Arma Exemplo",
      "icone_url": null
    }
  ],
  "armaduras": [
    {
      "id": "armadura-demo",
      "uuid": "uuid-armadura-demo",
      "nome": "Armadura Exemplo"
    }
  ]
}
```

`torneios[].nome` vem do catálogo local `app/catalogos/torneios.json`
(ex.: `UNIVAVA_G` → "Univavá · Fase de grupos"). Torneio presente
na Gold e ausente do catálogo usa o próprio ID como nome.
`mapas[].nome` vem da Gold (`mapas`) e `agentes[].nome` do catálogo
local de agentes.

IDs desconhecidos preservam o identificador original e usam nome,
classe ou ícone null quando indisponíveis.

Imagens e fontes externas dependem das autorizações e licenças aplicáveis.
Usar as transformações reais da Gold, não os números ilustrativos acima.

### GET /busca?q=exemplo&tipo=time

- `q`: obrigatório, de 2 a 100 caracteres após trim.
- `tipo`: opcional; time, jogador ou mapa.
- Usa paginação.
- Ordena por relevância e ID.
- Busca tolerante a caixa e acentos.
- Ambiguidade retorna candidatos, sem escolher silenciosamente.

Item:

```json
{"tipo": "time", "id": "time-demo", "nome": "Time Exemplo"}
```

## 4. Demais estatísticas

### GET /jogadores/{jogador_id}

Filtros gerais mais `agente_id`.

Objeto em `data`:

```json
{
  "id": "jogador-demo",
  "nome": "Jogador Exemplo",
  "times": [{"id": "time-demo", "nome": "Time Exemplo"}],
  "resumo": {
    "partidas": 5,
    "rounds": 100,
    "kills": 90,
    "deaths": 60,
    "assists": 25,
    "kd": 1.5,
    "adr": 140.0,
    "hs_pct": 25.0,
    "first_bloods": 12
  },
  "agentes": [
    {
      "agente_id": "agente-demo",
      "partidas": 5,
      "vitorias": 3,
      "taxa_vitoria_pct": 60.0,
      "nome": "Agente Exemplo"
    }
  ],
  "mapas": [
    {
      "mapa_id": "mapa-demo",
      "partidas": 5,
      "vitorias": 3,
      "taxa_vitoria_pct": 60.0,
      "nome": "Mapa Exemplo"
    }
  ]
}
```

Times representam o recorte filtrado.

`agentes` e `mapas` vêm ordenados por `partidas` decrescente, depois
`vitorias` decrescente, `nome` crescente (null no fim) e ID.
`nome` é o nome amigável do agente (catálogo local) ou do mapa (Gold);
null quando o ID não está no catálogo.

Jogador inexistente: 404.

Jogador conhecido sem partidas no recorte: 200, contagens zero,
taxas null e coleções do recorte vazias.

### GET /times

Filtros gerais e paginação. Ordem nome crescente e ID.

Item:

```json
{
  "id": "time-demo",
  "nome": "Time Exemplo",
  "partidas": 5,
  "vitorias": 3,
  "derrotas": 2,
  "empates": 0,
  "taxa_vitoria_pct": 60.0
}
```

### GET /times/{time_id}

Filtros gerais.

Objeto em `data`:

```json
{
  "id": "time-demo",
  "nome": "Time Exemplo",
  "resumo": {
    "partidas": 5,
    "vitorias": 3,
    "derrotas": 2,
    "empates": 0,
    "taxa_vitoria_pct": 60.0,
    "rounds_jogados": 100,
    "rounds_ganhos": 55
  },
  "lados": [
    {
      "lado": "ataque",
      "rounds_jogados": 50,
      "rounds_ganhos": 30,
      "taxa_vitoria_pct": 60.0
    },
    {
      "lado": "defesa",
      "rounds_jogados": 50,
      "rounds_ganhos": 25,
      "taxa_vitoria_pct": 50.0
    }
  ],
  "mapas": [
    {
      "mapa_id": "mapa-demo",
      "partidas": 5,
      "vitorias": 3,
      "taxa_vitoria_pct": 60.0,
      "nome": "Mapa Exemplo"
    }
  ]
}
```

`mapas` segue a mesma ordem do detalhe de jogador: `partidas`
decrescente, `vitorias` decrescente, `nome` (null no fim) e `mapa_id`.
`nome` é o nome amigável do mapa na Gold.

Não somar os escopos geral e por mapa de `stats_time`.
Elenco histórico não significa elenco atual.

### GET /mapas e GET /agentes

Filtros gerais e paginação. Ordem nome e ID.

Item de mapa:

```json
{"id": "mapa-demo", "nome": "Mapa Exemplo", "partidas": 5}
```

Item de agente:

```json
{
  "id": "agente-demo",
  "nome": "Agente Exemplo",
  "aparicoes": 10,
  "vitorias": 5,
  "taxa_vitoria_pct": 50.0
}
```

Aparição corresponde a jogador por mapa.

### GET /partidas

Filtros gerais mais `time_id` e `jogador_id`; paginação.

Ordem: início decrescente, desconhecido no fim, ID como desempate.

Item:

```json
{
  "id": "partida-demo",
  "torneio_id": "torneio-demo",
  "mapa_id": "mapa-demo",
  "inicio": null,
  "times": [
    {"id": "time-demo", "nome": "Time Exemplo", "rounds_ganhos": 13},
    {"id": "time-b-demo", "nome": "Time B Exemplo", "rounds_ganhos": 8}
  ],
  "vencedor_id": "time-demo"
}
```

### GET /partidas/{partida_id}

Sem filtros.

Objeto em `data`:

```json
{
  "id": "partida-demo",
  "torneio_id": "torneio-demo",
  "mapa_id": "mapa-demo",
  "inicio": null,
  "times": [
    {"id": "time-demo", "nome": "Time Exemplo", "rounds_ganhos": 13},
    {"id": "time-b-demo", "nome": "Time B Exemplo", "rounds_ganhos": 8}
  ],
  "vencedor_id": "time-demo",
  "jogadores": [
    {
      "jogador_id": "jogador-demo",
      "nome": "Jogador Exemplo",
      "nome_partida": "Nick Antigo",
      "time_id": "time-demo",
      "agente_id": "agente-demo",
      "kills": 20,
      "deaths": 12,
      "assists": 5,
      "adr": 140.0,
      "hs_pct": 25.0,
      "first_bloods": 3
    }
  ],
  "rounds": [
    {
      "round": 1,
      "vencedor_id": "time-demo",
      "lado_vencedor": "ataque",
      "resultado": "eliminacao"
    }
  ],
  "mvp_jogador_id": null,
  "rounds_decisivos": []
}
```

Em `jogadores`, `nome` é o nick mais recente do jogador (o mesmo do
ranking e da página do jogador) e `nome_partida` é o nick que ele usava
nesta partida. Mostrar `nome` mantém o mesmo jogador com o mesmo nome
em todas as telas; `nome_partida` serve para indicar o nick da época.

Resultados: eliminacao, detonacao, desarme, tempo ou outro.
Desconhecido permanece null.

Sem critério definido, MVP permanece null e rounds decisivos,
lista vazia.

## 5. Análise coletiva

Rotas de time aceitam filtros gerais e retornam objeto em `data`.

### GET /times/{time_id}/economia

```json
{
  "time_id": "time-demo",
  "categorias": [
    {"tipo": "pistol", "rounds": 4, "vitorias": 2, "taxa_vitoria_pct": 50.0},
    {"tipo": "eco", "rounds": 10, "vitorias": 2, "taxa_vitoria_pct": 20.0},
    {"tipo": "force", "rounds": 20, "vitorias": 8, "taxa_vitoria_pct": 40.0},
    {"tipo": "full", "rounds": 70, "vitorias": 45, "taxa_vitoria_pct": 64.2857}
  ],
  "classificacao_versao": "equipamento_time_10000_20000_pistol_v2",
  "rounds_sem_classificacao": 0
}
```

Regra da Gold:

- Rounds 1 e 13: pistol.
- Demais rounds: soma do equipamento dos cinco jogadores.
- Eco: abaixo de 10000.
- Force: de 10000 a menos de 20000.
- Full: a partir de 20000.
- Economia incompleta: classificação null, contabilizada em
  `rounds_sem_classificacao` e excluída das taxas por categoria.

A categoria mede equipamento, não intenção de compra.

### GET /times/{time_id}/pos-plant-retake

```json
{
  "time_id": "time-demo",
  "pos_plant": {
    "oportunidades": 20,
    "vitorias": 15,
    "taxa_sucesso_pct": 75.0
  },
  "retake": {
    "oportunidades": 10,
    "vitorias": 4,
    "taxa_sucesso_pct": 40.0
  }
}
```

Pós-plant: vitória do ataque após plant.
Retake: vitória da defesa após plant, inclusive por tempo.
Mede resultado, não tentativa de retake.

### GET /composicoes

Filtros gerais mais `time_id`; paginação.
Ordem: aparições decrescentes e composicao_id.

Item:

```json
{
  "composicao_id": "composicao-demo",
  "mapa_id": "mapa-demo",
  "agente_ids": ["agente-demo"],
  "aparicoes": 5,
  "vitorias": 3,
  "taxa_vitoria_pct": 60.0
}
```

O exemplo abrevia agentes. Agregar somente composições com cinco
slots ordenados e `composicao_valida = true`.

### GET /comparacoes/times

Parâmetros obrigatórios: `time_a_id` e `time_b_id`, distintos.
Aceita filtros gerais.

```json
{
  "time_a": {
    "id": "time-demo",
    "partidas": 5,
    "vitorias": 3,
    "taxa_vitoria_pct": 60.0
  },
  "time_b": {
    "id": "time-b-demo",
    "partidas": 5,
    "vitorias": 2,
    "taxa_vitoria_pct": 40.0
  },
  "confrontos_diretos": {
    "partidas": 1,
    "vitorias_a": 1,
    "vitorias_b": 0,
    "empates": 0
  }
}
```

Confrontos diretos são calculados separadamente, dentro do mesmo recorte.

## 6. Prancheta e calor

### GET /partidas/{partida_id}/rounds/{round}/eventos

Round público começa em 1. Usar o round da Gold sem somar novamente.

Sem paginação. Retornar todos os eventos do round, ordenados por
tempo_ms e ordem.

Exemplo:

```json
{
  "data": {
    "partida_id": "partida-demo",
    "mapa_id": "mapa-demo",
    "round": 1,
    "eventos": [
      {
        "id": "evento-demo",
        "ordem": 1,
        "tipo": "abate",
        "tempo_ms": 25000,
        "ator_id": "jogador-demo",
        "vitima_id": "jogador-b-demo",
        "assistente_ids": [],
        "arma_id": null,
        "site": null,
        "dano_final_tipo": null,
        "self_kill": false,
        "fogo_amigo": false,
        "abate_adversario": true,
        "ator_time_id": "time-demo",
        "vitima_time_id": "time-b-demo",
        "ator_agente_id": "agente-demo",
        "posicao": {"x": 120.0, "y": -50.0},
        "jogadores": [
          {
            "jogador_id": "jogador-demo",
            "time_id": "time-demo",
            "agente_id": "agente-demo",
            "posicao": {"x": 110.0, "y": -40.0}
          }
        ]
      }
    ]
  },
  "meta": {"atualizado_em": null}
}
```

- Tipos: abate, plant, defuse.
- Preservar os valores originais; campo indisponível permanece null.
- Listas desconhecidas ficam vazias.
- Posição: vítima no abate; bomba no plant/defuse.
- Snapshots são parciais; não supor dez jogadores nem interpolar.
- Preservar snapshots disponíveis de defuse.
- Round existente sem eventos retorna lista vazia.
- Não limitar a timeline a `abate_adversario = true`.
- Bomb: rótulo “Morte pela spike”.
- Fall: rótulo “Morte por queda”, sem inferir intenção.
- self_kill indica igualdade de IDs, não suicídio deliberado.
- Não recalcular K/D/A do placar contando indiscriminadamente eventos.
- Não atribuir kill ou assist com base apenas em dano anterior.

Transformação de `mapas.transformacao`, com seis campos:

```text
u = x*u_x + y*u_y + u_offset
v = x*v_x + y*v_y + v_offset
```

Origem superior esquerda; u horizontal e v vertical, normalizados
na imagem. Não trocar eixos novamente.

Se u/v não forem finitos ou estiverem fora de [0,1], manter o evento
na timeline, mostrar aviso e não desenhar sobre o minimapa.
Não prender pontos à borda nem inventar posições.

Transformação desconhecida é null. Imagem com recorte, margem ou
rotação diferente exige nova conferência do alinhamento.

Coordenadas extremas com Iso diretamente envolvido podem receber
contexto de possível arena do Iso. Não afirmar esse contexto apenas
por um limite de coordenada nem tratá-lo como regra universal.

### GET /mapas/{mapa_id}/calor

Filtros gerais, com mapa definido pelo path, mais `time_id`,
`jogador_id` e `tipo` obrigatório: abate ou plant. Usa paginação.

Item:

```json
{
  "partida_id": "partida-demo",
  "round": 1,
  "evento_id": "evento-demo",
  "x": 120.0,
  "y": -50.0,
  "peso": 1
}
```

Abate usa posição da vítima, filtrado pelo autor.
Plant usa posição da bomba, filtrado pelo planter/time atacante.

Calor de abates exige:

- abate_adversario verdadeiro;
- dano final não ambiental: excluir Bomb, Fall e Crush;
- posição válida e projetável.

Pontos externos, inclusive arena externa, ficam fora da camada
espacial, preservando os totais de kills. Documentar a quantidade
de pontos excluídos ao fechar a implementação da resposta.

O frontend deve percorrer as páginas necessárias, sem apresentar
uma página parcial como o recorte completo.

## 7. Tools do coach — proposta para Guilherme

Funções internas, não novas rotas HTTP de estatísticas.
Consultam Gold com SQL pronto e parametrizado.

O coach valida seu próprio JWT. Tornar estatísticas públicas
não torna o endpoint de IA público.

| Tool | Parâmetros propostos | Referência |
|---|---|---|
| buscar_entidade | texto, tipo? | /busca |
| stats_jogador | jogador_id, mapa_id?, agente_id? | /jogadores/{id} |
| stats_time | time_id, mapa_id? | /times/{id} |
| comparar_times | time_a_id, time_b_id, mapa_id? | /comparacoes/times |
| economia_time | time_id, mapa_id? | /times/{id}/economia |
| pos_plant_retake | time_id, mapa_id? | /times/{id}/pos-plant-retake |
| composicoes | time_id?, mapa_id?, page?, page_size? | /composicoes |
| resumo_partida | partida_id | /partidas/{id} |
| abrir_na_prancheta | partida_id, round | Link após verificar existência |

Exemplo de abrir_na_prancheta:

```json
{
  "partida_id": "partida-demo",
  "round": 1,
  "url": "/prancheta?partida_id=partida-demo&round=1"
}
```

O caminho depende de alinhamento com Lhobregat.
Busca ambígua exige desambiguação.
`consulta_livre` permanece fora do contrato e desligada.

## 8. Métricas

Aplicar as decisões da Gold registradas em
`services/stats/sql/gold/OFICIALIZACAO_E_API.md`.

- K/D: kills/deaths; deaths zero produz null.
- ADR: dano a adversários dividido pelos rounds.
- HS%: 100*headshots/(headshots+bodyshots+legshots).
- ADR e HS% respeitam completude e alertas de qualidade da Gold.
- First blood: primeiro abate adversário com tempo válido,
  com desempate estável conforme SQL oficial.
- Taxa de vitória: vitórias/oportunidades*100.
- Sem oportunidades, taxas ficam null.
- Recalcular razões pelos totais; não tirar média simples de percentuais.
- Excluir observadores.
- Lado real por round, inclusive overtime; não inferir por Red/Blue.
- competitiveTier não fornece elo utilizável nesta base.
- Não prometer movimento contínuo ou habilidades por round.
- KAST, trocas, isolamento, WPA e percentis não integram esta versão.
- MVP sem critério fica null; rounds decisivos, lista vazia.

## 9. Implementação, cache e container

- Python 3.12 com FastAPI.
- Consultas com maximum_bytes_billed de 1 GiB por consulta.
- Cache em memória aplicado às rotas de dados implementadas.
- TTL: 300 segundos.
- Capacidade: 128 respostas por processo.
- Chave inclui rota, filtros, ordenação, paginação, versão da resposta
  e versão da carga Gold.
- Atualizar versões quando a carga ou o formato mudar.
- Cache vencido não é servido; reiniciar apaga o cache.
- Erros não são armazenados.
- Chamadas iguais são coordenadas dentro do mesmo processo.
- Até quatro blocos de consulta simultâneos por processo, compartilhados entre as rotas.
- Sem vaga: HTTP 503.
- Cache e coordenação não são compartilhados entre instâncias.
- Travas têm quantidade fixa; consultas diferentes podem
  compartilhar trava e aguardar.
- Esses controles não substituem limite por visitante nem teto
  global de custo.
- Consultas que continuem após timeout exigem tratamento adicional.
- Container com um worker e porta definida pela variável PORT.
- Build Docker e inicialização local testados.
- Ranking no BigQuery validado dentro do container com token temporário: HTTP 200, um jogador e total de 411.
- Autenticação com sa-stats no Cloud Run e deploy pendentes.
- Infraestrutura, permissões e deploy alinhados com Guilherme.

O frontend deve evitar requisições repetidas a cada renderização,
cancelar ou ignorar respostas antigas ao trocar filtros e exibir
falhas por componente sem convertê-las em zero.

Testar a página inteira, com chamadas simultâneas e troca de filtros.
Coach tem política de acesso e custo separada.

## 10. Validação e pendências

### Verificado

- Ranking real no Cloud Shell.
- Paginação e página além do fim.
- Filtro Ascent e combinação mapa/time.
- Ordenações kills, K/D e ADR.
- Rejeição de parâmetros inválidos, repetidos e desconhecidos.
- Datas invertidas rejeitadas.
- Cache MISS seguido de HIT.
- Três chamadas iguais simultâneas: um MISS e dois HIT.
- Bloqueio por lotação antes de acessar BigQuery, com simulação.
- Liberação das vagas após falha simulada.
- Build Docker e resposta de status dentro do container.

### Evidências de consultas

Carga: `gold_336_v1`.

| Consulta | Bytes estimados no dry run |
|---|---:|
| Ranking geral, três ordenações | 93.951 |
| Ranking filtrado por Ascent, três ordenações | 973.913 |
| Contagem geral | 0 |

Execuções verificadas: 411 jogadores no ranking geral e 293 no Ascent.
Estimativas e totais dependem da carga; nova carga exige validação.

### Pendências

- Implementar demais rotas e integrar os SQLs do Chico.
- Validar individualmente os demais filtros.
- Testar expiração, invalidação e separação das chaves do cache.
- Tratar consultas após timeout.
- Definir limite de requisições para publicação pública.
- Registrar o instante confiável da carga.
- Validar autenticação automática e permissões de sa-stats no Cloud Run.
- Publicar e testar integração com frontend e coach.
- Alinhar documentos antigos que ainda exigem JWT nas estatísticas.

| Responsável | Validação |
|---|---|
| Chico | SQLs, métricas, IDs, filtros, eventos e transformações |
| Gugu | Rotas, cache, erros e aderência ao contrato |
| RhuanK | Páginas, gráficos e estados de falha |
| Lhobregat | Prancheta, snapshots, coordenadas e calor |
| Guilherme | Infraestrutura, deploy e política do coach |

Este documento distingue implementação de planejamento.
Consulte o estado atual e os limites de validação deste documento.
## Atualização de implementação — detalhe de jogador

GET /api/stats/jogadores/{jogador_id} está implementado.
Esta atualização substitui a indicação anterior de pendência
para essa rota.

Filtros disponíveis: torneio_id, mapa_id, agente_id,
data_inicio e data_fim. Datas inclusivas em UTC.

Validados pela API: jogador existente, filtro Ascent, 404 para
jogador inexistente, recorte vazio e cache HIT.

A rota compartilha com o ranking o cache em memória e o limite
de quatro execuções simultâneas por processo.

O formato dos identificadores é validado. A validação de existência
dos IDs de filtros nos catálogos continua pendente.

O SQL recebe todos os parâmetros como STRING, conforme a entrega
do Chico; datas são validadas pela API antes do envio.

A consulta original permanece em sql/gold/consultas_api/.
A cópia utilizada pelo runtime fica em queries/jogador_detalhe.sql.
Mudanças na origem precisam ser sincronizadas e testadas na cópia.

O estado atual no início deste documento substitui as indicações anteriores de implementação pendente.

## Complemento — resposta do mapa de calor

GET /api/stats/mapas/{mapa_id}/calor implementado para
tipo=abate e tipo=plant, com filtros e paginação.

Os itens de data mantêm x/y nas coordenadas originais do jogo.
A projeção usa a transformação da Gold; pontos não projetáveis
são excluídos da camada espacial, sem alterar estatísticas de kills.

Campos adicionais de meta:
- eventos_elegiveis: total após filtros e regras de combate,
  antes da validação espacial.
- pontos_excluidos: elegíveis sem posição finita e projetável
  dentro de [0,1] nos dois eixos.
- transformacao_disponivel: existência da transformação na Gold.

pagination.total conta somente os pontos projetáveis.
Antes da paginação:
eventos_elegiveis = pagination.total + pontos_excluidos.

Sem transformação, nenhum ponto é considerado projetável.
Mapa inexistente retorna 404.
O frontend deve percorrer as páginas para obter o recorte completo.
## Verificação da entrega — 22/10/2026

- Suíte automatizada existente: 20 testes aprovados.
- O teste de inventário de rotas não substitui testes funcionais
  específicos de cada endpoint.
- Novas rotas verificadas principalmente por chamadas HTTP manuais.
- Container atualizado iniciou e GET /api/stats/status respondeu 200.
- Ranking no BigQuery validado dentro do container com token temporário: HTTP 200, um jogador e total de 411.
- Autenticação com sa-stats no Cloud Run pendente.
- Integração com frontend, deploy e teste da página completa pendentes.
- Revisão final dos campos e filtros em relação ao contrato pendente.
- Nomes e classes dos agentes vêm do catálogo estático local.
- Catálogos de armas e armaduras são estáticos; não indicam uso na base.
- IDs de armas desconhecidos presentes na Gold são preservados
  com nome null.
- GET /catalogos fornece as transformações reais dos mapas.
- minimapa_url permanece null; imagens são responsabilidade do frontend.


## Evidência atualizada — testes e container

Em 22/10/2026, a suíte retornou 20 testes aprovados, usando BigQuery
simulado. Os oito testes adicionais verificam validações, detalhes
inexistentes, páginas vazias, cache, nulos, snapshots, contadores
do calor, falhas e lotação nas novas rotas.

Em teste separado, o ranking consultou o BigQuery dentro do container
com token temporário fornecido ao cliente somente durante o teste.
Resultado: HTTP 200, um jogador retornado e total de 411.
Não foi necessário alterar o código da aplicação ou a imagem.

Continuam pendentes a autenticação automática com sa-stats no
Cloud Run, o deploy e a integração com o frontend.
Os testes simulados não validam os cálculos SQL na Gold.

## Ajustes para o front — 22/10/2026

- `/catalogos`: `torneios[].nome` com nome amigável, vindo de
  `services/stats/app/catalogos/torneios.json`.
- Detalhe de jogador e de time: `agentes` e `mapas` ordenados por
  partidas, vitórias, nome e ID; itens ganham `nome` (campo novo).
- Ranking com filtro e detalhe da partida: `nome` passa a ser o nick
  mais recente do jogador. O detalhe da partida ganha `nome_partida`.
- Formato preservado: só valores corrigidos e campos acrescentados.
- `queries/jogador_detalhe.sql` agora difere da origem em
  `sql/gold/consultas_api/` (ordem e nomes). A Gold não mudou.

Dry run com a carga `gold_336_v1`:

| Consulta | Bytes estimados |
|---|---:|
| catalogos.sql | 1.840.232 |
| jogador_detalhe.sql | 1.197.614 |
| time_detalhe.sql | 131.029 |
| ranking_filtrado.sql (torneio) | 964.682 |
| partida_detalhe.sql | 2.003.605 |

Diferenças de 1 entre a API e o antigo snapshot do front (ADR,
porcentagens e posição no ranking) vêm do snapshot, não da API:
o snapshot arredondava para uma casa antes de exibir sem casas
(205,46 → 205,5 → 206) e desempatava o ranking com `localeCompare`
em vez da ordem binária do `jogador_id`. Os totais por jogador
(rounds, kills, dano, tiros, first bloods) batem nos 411 jogadores.
