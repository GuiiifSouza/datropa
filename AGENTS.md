# Da Tropa

Plataforma de analytics de partidas de VALORANT de campeonatos universitários, com coach de IA e bolão de palpites (só pontos, sem dinheiro). Projeto do Hackathon SEMCOMP/VALORANT da USP São Carlos.

Responda e escreva em português do Brasil, curto e direto. Código, nomes de variáveis e commits podem ficar em inglês ou português, mas siga o que já existe na pasta.

## Prazo

- Início: segunda, 19/10/2026, 10h.
- Entrega: sexta, 23/10/2026, 23h59 (horário de Brasília). Depois disso a submissão pode ser descartada.
- Entregável: vídeo pitch de até 5 minutos (YouTube não listado) + link da apresentação + link do protótipo, se houver.

Com cinco dias, prefira o que aparece no pitch. Funcionalidade que não entra no vídeo nem no protótipo navegável espera.

## Regras do hackathon (não negociáveis)

- **Dados de partida só da base oficial** (os JSONs do Drive da organização). Nada de Riot API, tracker, VLR, scraping ou qualquer outra fonte para completar partidas.
- **Só pós-partida.** Nada que ajude durante uma partida em andamento ou dê vantagem em tempo real.
- **Nada que interaja com o cliente do jogo** ou com serviços da Riot sem autorização.
- **Licenças:** imagens, fontes, ícones e código de terceiros só com licença que permita o uso. Arte do VALORANT segue a política de IP da Riot.

Na dúvida se algo fere uma regra, pare e pergunte ao Guilherme.

## Critérios de julgamento

Seis critérios, nota de 1 a 5 cada, mesmo peso (até 30 pontos): inovação, impacto para jogadores e equipes, qualidade da análise e do uso dos dados, viabilidade, usabilidade, qualidade do protótipo e da apresentação. A banca tem gente da Riot Games e da AcadArena. Análise coletiva (time, papéis, padrões de jogo) é bem-vista.

## Estrutura do monorepo

```
front/               SPA (Firebase Hosting)
services/stats/      rankings, times, mapas, agentes, detalhes de partida
services/coach/      coach de IA (NL → SQL no BigQuery, só leitura)
services/bolao/      palpites e ranking do bolão
services/ingest/     carrega os JSONs no BigQuery
docs/arquitetura/    diagrama e explicação da arquitetura
docs/dados.md        como a base de partidas é organizada
data/                JSONs baixados localmente (fora do git)
```

As pastas `front/` e `services/` ainda não existem. Crie seguindo esta estrutura.

## Arquitetura

Leia [docs/arquitetura/README.md](docs/arquitetura/README.md) antes de mexer em infraestrutura ou criar serviço. Resumo:

- GCP, um projeto, todos os serviços na mesma região.
- Front no Firebase Hosting com rewrites `/api/<serviço>/**` para o Cloud Run.
- Login com Firebase Authentication. **Todo serviço valida o JWT do Firebase**, não confie só no Hosting.
- BigQuery dataset `valorant`: `bronze` (JSON como veio) e `gold` (tabelas para consulta).
- Firestore para usuários, palpites, pontuação e cache.
- Vertex AI (Gemini) no coach.

Mudou a arquitetura? Atualize `docs/arquitetura/arquitetura.py`, regere as imagens e ajuste o README da pasta no mesmo commit.

## Regras de segurança

- Uma service account por serviço, com privilégio mínimo. Nunca a conta padrão do Compute.
- O `coach` só lê o dataset `valorant`. Todo SQL gerado pela IA passa por: só `SELECT`, `maximum_bytes_billed` e dry run antes de rodar.
- Sem chave JSON de service account no repo nem no CI. O GitHub Actions usa Workload Identity Federation.
- `.env`, credenciais e os JSONs da base não entram no git.

## Dados

Detalhes em [docs/dados.md](docs/dados.md). Pontos que pegam:

- IDs de agente, arma e mapa vêm como UUID ou caminho interno (`/Game/Maps/Ascent/Ascent`). É preciso tabela de tradução para mostrar nome.
- O JSON não tem nome de time; ele está no nome do arquivo.
- `teamId` é `Red`/`Blue` e muda por partida. Para juntar o histórico de um time, use o nome do arquivo ou o conjunto de `puuid` dos jogadores.

## Git e GitHub

- Repo pessoal: `GuiiifSouza/datropa`, remoto `git@github-pessoal:GuiiifSouza/datropa.git`.
- No `gh`, use a conta pessoal: `GH_TOKEN=$(gh auth token --user GuiiifSouza) gh ...`. Nunca a conta da Nublify.
- Branch por frente de trabalho, commit pequeno com mensagem clara.
- Push, PR, deploy e qualquer coisa que gaste dinheiro no GCP só com o OK do Guilherme.

## Antes de dizer que terminou

- Rodou? Mostre o comando e a saída (teste, build ou print).
- Mexeu em consulta do BigQuery? Faça dry run e informe os bytes.
- Diga o que ficou de fora ou não foi verificado.
