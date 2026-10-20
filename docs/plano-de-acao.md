# Plano de ação

Produto pronto e congelado na **quarta, 21/10, às 22h**. Quinta é para slides e vídeo; sexta, para enviar.

O que vai para o vídeo:
- **estatísticas** de time e jogador;
- **análise coletiva**;
- **coach de IA** (agente com tools no Vertex AI);
- **prancheta tática** no estilo do [valoplant.gg](https://valoplant.gg/pt/9193DF).

Como cada peça funciona: [docs/arquitetura/README.md](arquitetura/README.md).

## Metas

| Quando | O quê |
|---|---|
| **Qua 21/10, 22h** | Produto no ar em `devs.datropa.com`, congelado |
| Qui 22/10, 22h | Slides e vídeo de até 5 min prontos |
| Sex 23/10, 18h | Vídeo no YouTube (não listado) e formulário enviado. O prazo oficial é 23h59 |

## Quem faz o quê

| Pessoa | Frente | Dono de |
|---|---|---|
| **Guilherme** | Admin, infra, DevOps e back | **Todo o admin do GCP e do GitHub**: projeto, IAM, APIs, billing, Firebase, DNS, segredos, WIF, colaboradores, proteção de branch. CI/CD. `services/ingest` com Eventarc. **`services/coach`**: agente no Vertex AI e as tools. Regras do Firestore. Revisão e merge dos PRs |
| **chico** | Back (dados) | Toda a gold no BigQuery: ranking, time, mapa, agente, partida, análise coletiva (economia, pós-plant, retake, composições), `eventos_round` e `mapas` (conversão de coordenadas) |
| **gugu** | Back (API) | `services/stats`: as rotas do contrato em cima da gold e cache no Firestore. `docs/api.md`. Tabelas de tradução de UUID (agente, arma, armadura). As 10 perguntas da demo do coach |
| **Lhobregat** | Front | Esqueleto do `front/`, login, **prancheta tática** completa (mapa, peças, desenho, etapas, salvar, round real) e mapa de calor |
| **RhuanK** | Front | Ranking, páginas de time (com os gráficos coletivos), jogador e partida, tela do coach, identidade visual |

**Admin é com o Guilherme.** Precisa de permissão no GCP, de uma API ligada, de um segredo, de acesso ao repo ou de mudar alguma configuração? Peça no canal. Ninguém mais mexe em IAM, billing ou configuração do repo.

**Cada um na sua pasta.** O [CODEOWNERS](../.github/CODEOWNERS) define quem revisa o PR de cada pasta. O GitHub chama o dono automaticamente.

## Contrato entre front e back

Até **segunda às 23h**, o gugu publica `docs/api.md`. O conteúdo é combinado com o chico (tabelas), com o Guilherme (tools do coach) e com o front:
- as rotas;
- as tools do coach;
- o formato de `eventos_round`;
- um JSON de exemplo de cada resposta.

O front usa esses exemplos como mock até a API real subir. Assim ninguém fica esperando ninguém.

## Cronograma

### Segunda 19/10 (até 23h)

- **Guilherme:** feito. Projeto GCP, APIs, bucket com os 336 JSONs, dataset `valorant` com o bronze carregado, Firebase, limite de custo e acesso do chico e do gugu ao BigQuery. Estado e pendências em [infra/README.md](../infra/README.md).
- **Todos:** clonar, ler o `AGENTS.md` e o `docs/dados.md`, baixar a base em `data/raw` e aceitar o convite do repo.
- **gugu:** `docs/api.md`, com o chico, o Guilherme e o front.
- **Lhobregat:**
  - esqueleto do `front/` rodando local;
  - perguntar à organização se dá para usar dado estático público do jogo (nome e ícone de agente e arma, minimapa) só para exibir. Os JSONs só trazem UUID e coordenada. Se liberarem, combinar com o gugu a tabela de tradução de UUID. Sem resposta até terça de manhã, vale o plano B dos riscos.

### Terça 20/10

| Até | Quem | Entrega |
|---|---|---|
| 10h | Guilherme | Bronze no BigQuery (carga manual, se o ingest não estiver pronto) |
| 12h | Guilherme | CI/CD deployando cada serviço no Cloud Run. Front em `devs.datropa.com`. Auth ligado |
| 12h | gugu | Tabelas de tradução de UUID no BigQuery |
| 14h | chico | Gold principal: ranking de jogador, stats de time, mapa e agente, detalhe da partida |
| 18h | chico | Gold `eventos_round` e `mapas` |
| 18h | Guilherme | Agente local respondendo com `buscar_entidade`, `stats_jogador` e `stats_time` |
| 20h | gugu | `stats` no ar com as rotas do contrato |
| 20h | Lhobregat | Prancheta: mapa, lado, arrastar agentes e desenho, com mock |
| 20h | RhuanK | Ranking, time, jogador e partida, com mock |
| 22h | Guilherme | `coach` no ar. `ingest` via Eventarc de ponta a ponta. Regras do Firestore |

### Quarta 21/10

| Até | Quem | Entrega |
|---|---|---|
| 12h | chico | Gold da análise coletiva: economia por round, pós-plant, retake, composições |
| 12h | Guilherme | Tools coletivas, `resumo_partida`, `abrir_na_prancheta` e scouting no coach |
| 12h | Lhobregat | Prancheta: etapas com play, salvar e link curto |
| 14h | gugu | Rotas da análise coletiva no `stats` |
| 14h | Lhobregat + RhuanK | Front ligado na API real |
| 16h | Lhobregat | Round real na prancheta e mapa de calor |
| 16h | RhuanK | Gráficos coletivos na página do time e tela do coach com dado real |
| **18h** | todos | **Feature freeze.** A partir daqui, só correção de bug |
| 18h | gugu | 10 perguntas da demo testadas no coach |
| 20h | Guilherme | Deploy final e teste de ponta a ponta no navegador e no celular |
| 21h | todos | Rascunho do roteiro do pitch e lista de telas para gravar |
| **22h** | todos | **Produto congelado** |

### Quinta 22/10

Slides, gravação de tela, narração e edição. Vídeo pronto até 22h.

### Sexta 23/10

Revisão final, upload no YouTube (não listado) e formulário enviado até 18h.

## Rotina

- Sync no Discord às **10h e às 21h**: o que fiz, o que vou fazer, o que está me travando.
- Travou por mais de 1h? Avise no canal.
- Cada um trabalha na sua pasta e na sua branch, com PR para a `main`.

## Riscos

| Risco | Saída |
|---|---|
| Guilherme vira gargalo (admin + coach + infra) | Acessos de todos liberados na segunda à noite. Pedidos de admin num canal só, atendidos no sync das 10h e das 21h |
| Organização não libera fonte externa para UUID, minimapa e ícones | Tabela de UUID à mão (28 agentes, 21 armas), contorno simples do mapa e ícone com a inicial do agente |
| Conversão de coordenada errada na prancheta | Validar com 3 plants conhecidos por mapa: o site A ou B precisa cair no lugar certo |
| Agente escolhe a tool errada ou inventa número | Descrição clara de cada tool, resposta obrigada a citar o resultado e 10 perguntas da demo testadas |
| Prancheta é a tarefa mais pesada do front | Ordem fixa: mapa e agentes → desenho → etapas → salvar → round real. O que não ficar pronto até quarta às 18h sai do pitch |
| Custo do GCP | `maximum_bytes_billed` no BigQuery e alerta de orçamento |
