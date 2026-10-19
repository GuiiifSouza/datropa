# Da Tropa

Plataforma de analytics de partidas de VALORANT de campeonatos universitários: estatísticas de time e jogador, análise coletiva, coach de IA e prancheta tática. Projeto do Hackathon SEMCOMP/VALORANT da USP São Carlos. A primeira versão vai ao ar em `devs.datropa.com`.

Responda e escreva em português do Brasil, curto e direto. Código, nomes de variáveis e commits podem ficar em inglês ou português, mas siga o que já existe na pasta.

**Plano da semana, com quem faz o quê e até quando: [docs/plano-de-acao.md](docs/plano-de-acao.md).**

## Time e donos das pastas

| Quem | Frente | Pasta |
|---|---|---|
| Guilherme (GuiiifSouza) | Admin, infra, DevOps e back | `infra/`, `.github/`, `services/coach/`, `services/ingest/`, `docs/arquitetura/` |
| chico | Back (dados) | `services/stats/sql/gold/` |
| gugu | Back (API) | `services/stats/` |
| Lhobregat | Front | `front/` (prancheta tática e mapa de calor) |
| RhuanK | Front | `front/` (páginas, gráficos, tela do coach) |

O arquivo [.github/CODEOWNERS](.github/CODEOWNERS) diz quem aprova PR em cada pasta. **Mexa só na sua pasta.** Precisou de algo em outra, peça ao dono ou abra uma issue. Cada pasta tem o próprio `AGENTS.md` com o escopo dela.

Contato e e-mails ficam fora do repo, que é público.

## Admin é só com o Guilherme

Ele é o owner do GCP e do GitHub. Só ele mexe em:
- projeto GCP, IAM, APIs, billing, service accounts, segredos e Workload Identity Federation;
- Firebase (Hosting, Auth, regras do Firestore) e DNS de `devs.datropa.com`;
- colaboradores, proteção de branch, `CODEOWNERS` e configurações do repo;
- workflows do GitHub Actions (`.github/`).

Precisa de acesso, de uma API ligada ou de mudar alguma configuração? Peça no canal. Ninguém mais altera isso, nem por IA.

## Prazo

- Produto congelado: **quarta, 21/10/2026, 22h**.
- Vídeo e slides: quinta, 22/10.
- Entrega oficial: sexta, 23/10/2026, 23h59 (horário de Brasília). O time envia até 18h.
- Entregável: vídeo pitch de até 5 minutos (YouTube não listado) + link da apresentação + link do protótipo.

Com o prazo curto, prefira o que aparece no pitch. Funcionalidade que não entra no vídeo nem no protótipo espera.

## Regras do hackathon (não negociáveis)

- **Dados de partida só da base oficial** (os JSONs do Drive da organização). Nada de Riot API, tracker, VLR, scraping ou qualquer outra fonte para completar partidas.
- **Só pós-partida.** Nada que ajude durante uma partida em andamento ou dê vantagem em tempo real.
- **Nada que interaja com o cliente do jogo** ou com serviços da Riot sem autorização.
- **Licenças:** imagens, fontes, ícones e código de terceiros só com licença que permita o uso. Arte do VALORANT (minimapas, ícones de agente) segue a política de IP da Riot.

Na dúvida se algo fere uma regra, pare e pergunte ao Guilherme.

## Critérios de julgamento

Seis critérios, nota de 1 a 5 cada, mesmo peso (até 30 pontos): inovação, impacto para jogadores e equipes, qualidade da análise e do uso dos dados, viabilidade, usabilidade, qualidade do protótipo e da apresentação. A banca tem gente da Riot Games e da AcadArena. Análise coletiva (time, papéis, padrões de jogo) é bem-vista.

## Estrutura do monorepo

```
front/                      SPA: páginas, coach e prancheta tática (Firebase Hosting)
services/stats/             API de estatísticas, análise coletiva e eventos de round
services/stats/sql/gold/    SQL das tabelas gold
services/coach/             coach de IA: agente no Vertex AI com tools
services/ingest/            carga dos JSONs no BigQuery
infra/                      configuração de GCP e Firebase
docs/arquitetura/           diagrama e explicação da arquitetura
docs/dados.md               como a base de partidas é organizada
docs/plano-de-acao.md       quem faz o quê até quarta
data/                       JSONs baixados localmente (fora do git)
```

A linguagem de cada serviço fica a critério do dono da pasta. O requisito é rodar como container no Cloud Run, com deploy pelo CI. Registre a escolha no README da pasta.

## Arquitetura

Leia [docs/arquitetura/README.md](docs/arquitetura/README.md) antes de mexer em infraestrutura ou criar serviço. Resumo:

- GCP, um projeto, todos os serviços na mesma região.
- Front no Firebase Hosting com rewrites `/api/<serviço>/**` para o Cloud Run.
- Login com Firebase Authentication. **Todo serviço valida o JWT do Firebase**, não confie só no Hosting.
- BigQuery dataset `valorant`: `bronze` (JSON como veio) e `gold` (tabelas para consulta, inclusive `eventos_round` e `mapas`).
- Firestore para usuários, estratégias da prancheta e cache.
- Coach é um agente no Vertex AI (Gemini) que chama tools com consultas prontas. Ele não escreve SQL livre.

Mudou a arquitetura? Atualize `docs/arquitetura/arquitetura.py`, regere as imagens e ajuste o README da pasta no mesmo commit.

## Regras de segurança

- Uma service account por serviço, com privilégio mínimo. Nunca a conta padrão do Compute.
- O `coach` só lê o dataset `valorant`. Cada tool é uma consulta parametrizada, com `maximum_bytes_billed`. A `consulta_livre` fica desligada; se for ligada, só `SELECT`, dry run e `LIMIT` forçado.
- Sem chave JSON de service account no repo nem no CI. O GitHub Actions usa Workload Identity Federation.
- `.env`, credenciais e os JSONs da base não entram no git.

## Dados

Detalhes em [docs/dados.md](docs/dados.md). Pontos que pegam:

- Agente, arma e armadura vêm como UUID, e o mapa com codinome interno (`Jam` é Lotus). É preciso tabela de tradução para mostrar nome.
- O JSON não tem nome de time: ele está no nome do arquivo.
- `teamId` é `Red`/`Blue` e muda por partida. Para juntar o histórico de um time, use o nome do arquivo ou o conjunto de `puuid` dos jogadores.

## Git e GitHub

- Repo: `GuiiifSouza/datropa`, público. Nada de e-mail, chave, `.env` ou dado pessoal em commit.
- A `main` é protegida: só entra por PR aprovado pelo dono da pasta (veja o `CODEOWNERS`).
- Branch por tarefa, commit pequeno com mensagem clara.
- Deploy e qualquer coisa que gaste dinheiro no GCP só com o OK do Guilherme.
- Agentes do Guilherme: no `gh`, use a conta pessoal (`GH_TOKEN=$(gh auth token --user GuiiifSouza) gh ...`) e o remoto `git@github-pessoal:GuiiifSouza/datropa.git`. Nunca a conta da Nublify.

## Antes de dizer que terminou

- Rodou? Mostre o comando e a saída (teste, build ou print).
- Mexeu em consulta do BigQuery? Faça dry run e informe os bytes.
- Diga o que ficou de fora ou não foi verificado.
