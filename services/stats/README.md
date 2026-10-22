# API de estatísticas — DA TROPA

Responsáveis: Gugu pela API e Chico pelas tabelas em `sql/gold/`.

Backend em Python 3.12 com FastAPI, preparado para Cloud Run com
a service account `sa-stats`.

Contrato de referência: [docs/api.md](../../docs/api.md).
Escopo da pasta: [AGENTS.md](AGENTS.md).

## Estado atual

As rotas abaixo estão implementadas. Foram realizadas verificações
HTTP manuais no Cloud Shell e a suíte automatizada existente passou
com 20 testes.

O container atualizado iniciou e `/api/stats/status` respondeu 200.
O ranking consultou o BigQuery dentro do container usando token temporário: HTTP 200, um jogador e total de 411. A autenticação com sa-stats no Cloud Run permanece pendente.

A revisão final de aderência ao contrato, a integração com o frontend
e o deploy ainda estão pendentes.

## Rotas

Todas usam o prefixo `/api/stats`.

| Método | Caminho | Finalidade |
|---|---|---|
| GET | `/status` | Verificar se o servidor responde |
| GET | `/ranking` | Ranking de jogadores |
| GET | `/jogadores/{jogador_id}` | Detalhe de jogador |
| GET | `/times` | Lista de times |
| GET | `/times/{time_id}` | Detalhe de time |
| GET | `/times/{time_id}/economia` | Economia por categoria |
| GET | `/times/{time_id}/pos-plant-retake` | Resultados após plant |
| GET | `/partidas` | Lista de partidas |
| GET | `/partidas/{partida_id}` | Placar, jogadores e rounds |
| GET | `/partidas/{partida_id}/rounds/{round}/eventos` | Eventos para a prancheta |
| GET | `/composicoes` | Composições por mapa |
| GET | `/comparacoes/times` | Comparação e confrontos diretos |
| GET | `/mapas` | Estatísticas por mapa |
| GET | `/mapas/{mapa_id}/calor` | Pontos de abates ou plants |
| GET | `/agentes` | Nome, classe e estatísticas dos agentes |
| GET | `/catalogos` | Torneios, mapas, agentes, armas e armaduras |
| GET | `/busca` | Busca de times, jogadores e mapas |

Parâmetros e formatos estão no contrato. A revisão final deve conferir
o comportamento implementado em cada rota, inclusive filtros.

`/status` não consulta nem verifica o BigQuery.

## Organização

- `app/main.py`: aplicação, registro dos erros e routers.
- `app/routes/`: endpoints organizados por assunto.
- `app/catalogos/`: traduções estáticas e registro das fontes.
- `app/validacoes.py`: parâmetros, identificadores e datas.
- `app/erros.py`: erros tratados da API.
- `app/database.py`: cliente BigQuery, leitura de SQL e concorrência.
- `app/serializacao.py`: conversão de resultados aninhados.
- `app/cache.py`: cache em memória e coordenação de chamadas.
- `queries/`: consultas de leitura usadas pelos endpoints.
- `sql/gold/`: definições e validações da Gold, mantidas por Chico.
- `tests/`: testes automatizados.

## Acesso e dados

As estatísticas são públicas e não exigem login ou token Firebase.
Essa decisão não altera a política do coach ou as regras da prancheta.

Credenciais Google Cloud ficam exclusivamente no backend.
Credenciais, tokens e arquivos `.env` não entram no Git nem na imagem.

As consultas dos endpoints leem somente a Gold:

- Projeto: `datropa`.
- Dataset: `valorant`.
- Região: `southamerica-east1`.
- Limite: `maximum_bytes_billed=1073741824` por consulta.

Datas de filtro são inclusivas e em UTC. Razões são recalculadas
pelos totais; denominador zero produz null. Alertas de qualidade
seguem o tratamento de cada consulta.

`meta.atualizado_em` permanece null enquanto o instante da carga
não estiver disponível.

## Catálogos e coordenadas

Nomes e classes dos agentes vêm do catálogo estático local.
Nomes amigáveis dos torneios vêm de `app/catalogos/torneios.json`.

Nome de jogador é o nick da partida mais recente, em todas as rotas.
O detalhe da partida também traz `nome_partida`, o nick daquela partida.
Armas e armaduras também usam arquivos locais; suas fontes estão
registradas em `app/catalogos/README.md`.

Dados estáticos externos não são usados para completar partidas.
IDs de armas desconhecidos encontrados na Gold são preservados
com nome null.

`/catalogos` fornece as transformações reais dos mapas.
`minimapa_url` permanece null; imagens ficam com o frontend.

Projeção:

```text
u = x*u_x + y*u_y + u_offset
v = x*v_x + y*v_y + v_offset
```

Eventos de round preservam as coordenadas originais e os snapshots
disponíveis, sem interpolação.

O calor exclui pontos não projetáveis e informa:

- `meta.eventos_elegiveis`;
- `meta.pontos_excluidos`;
- `meta.transformacao_disponivel`.

`pagination.total` conta os pontos projetáveis antes da paginação.
O frontend deve percorrer as páginas para obter o recorte completo.
Exclusões espaciais não alteram as estatísticas de kills.

## Executar localmente

Na raiz do repositório:

```bash
python3 -m venv services/stats/.venv

services/stats/.venv/bin/python -m pip install \
  -r services/stats/requirements.txt

services/stats/.venv/bin/python -m uvicorn app.main:app \
  --app-dir services/stats \
  --host 127.0.0.1 \
  --port 8083
```

O processo precisa de credenciais Google Cloud com permissão
para executar consultas e ler as tabelas necessárias.

## Cache e concorrência

- Cache em memória com TTL de 300 segundos.
- Até 128 respostas por processo.
- Chaves incluem versões e parâmetros relevantes da resposta.
- Reiniciar o processo apaga o cache.
- Erros não são armazenados.
- Chamadas iguais são coordenadas dentro do mesmo processo.
- Travas têm quantidade fixa; chamadas diferentes podem aguardar
  a mesma trava.
- Até quatro blocos de consulta simultâneos por processo,
  compartilhados entre as rotas.
- Sem vaga, a rota retorna HTTP 503.
- A vaga é liberada ao encerrar o bloco, inclusive após falhas.

Cache e concorrência não são compartilhados entre instâncias.
Esses controles não equivalem a limite por visitante nem a teto
global de custo. Jobs podem continuar no BigQuery após timeout;
esse tratamento ainda precisa ser concluído.

## Testes

Na raiz:

```bash
PYTHONPATH=services/stats services/stats/.venv/bin/python \
  -m unittest discover -s services/stats/tests -v
```

Último resultado informado: 26 testes aprovados (22/10/2026,
com `tests/test_ajustes_front.py`).

Os testes usam BigQuery simulado e não precisam de credenciais.
Cobrem comportamentos de ranking, jogador, listagem de times,
validação, cache e concorrência, além do inventário de rotas.

O teste de inventário não valida funcionalmente cada endpoint.
As rotas acrescentadas depois da reorganização foram verificadas
principalmente por chamadas HTTP manuais.

## Container

Build:

```bash
docker build -t datropa-stats:local services/stats
```

Executar:

```bash
docker run --rm --name datropa-stats-validacao \
  -e PORT=8080 \
  -p 127.0.0.1:8084:8080 \
  datropa-stats:local
```

Teste em outro terminal:

```bash
curl -i http://127.0.0.1:8084/api/stats/status
```

O container copia `app/`, incluindo os catálogos, e `queries/`.
Usa usuário sem privilégios de root, um worker e a variável `PORT`.

Inicialização e status foram verificados. O comando acima não
fornece credenciais para consultar o BigQuery.

## Pendências para entrega

- Revisar campos e filtros das rotas contra o contrato.
- Ampliar testes funcionais das novas rotas.
- Testar expiração e invalidação do cache.
- Validar exclusões espaciais e o desenho com o frontend.
- Validar autenticação automática e permissões de sa-stats no Cloud Run.
- Tratar jobs que continuem após timeout.
- Concluir tratamento uniforme de 404 e 500.
- Definir limite de requisições e resposta 429.
- Disponibilizar um instante confiável da carga.
- Concluir alinhamento dos documentos antigos de autenticação.
- Testar a página inteira com chamadas simultâneas e troca de filtros.
- Realizar deploy com Guilherme e teste integrado.

O frontend deve evitar chamadas repetidas, ignorar respostas antigas
após troca de filtros e mostrar falhas por componente. Erros não
devem ser apresentados como estatísticas zeradas.

Infraestrutura, permissões e deploy ficam com Guilherme.

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
