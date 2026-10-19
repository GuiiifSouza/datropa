# Da Tropa

Analytics de partidas de VALORANT de campeonatos universitários, com coach de IA e bolão de palpites (só pontos, sem dinheiro).

Projeto para o [Hackathon SEMCOMP/VALORANT da USP São Carlos](https://docs.google.com/document/d/17dyxuHI6OXzETZ2VGsu1YTDowLzNzjjPGEKr2RC4qWc/edit), de 19 a 23 de outubro de 2026. A base são as partidas do UNIVAVÁ (classificatórias) e da Rush Series, fornecidas pela organização.

![Arquitetura](docs/arquitetura/arquitetura-da-tropa.png)

## O que tem

- **Estatísticas:** ranking de jogadores, desempenho por time, mapa e agente, detalhe de cada partida.
- **Coach de IA:** pergunta em português, resposta com dado de verdade. O Gemini gera o SQL, o serviço valida e roda só leitura no BigQuery. Também faz scouting de time e resumo de partida.
- **Bolão:** palpites nas partidas, ranking por pontos. Sem dinheiro.

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [AGENTS.md](AGENTS.md) | Regras do projeto e do hackathon, estrutura, segurança. Vale para pessoas e agentes de IA |
| [docs/arquitetura/README.md](docs/arquitetura/README.md) | Componentes, fluxos numerados, camadas de dados, decisões |
| [docs/dados.md](docs/dados.md) | A base de partidas: onde baixar, formato do JSON, armadilhas |

## Estrutura

```
front/              SPA no Firebase Hosting
services/stats/     estatísticas
services/coach/     coach de IA
services/bolao/     bolão
services/ingest/    carga dos JSONs no BigQuery
docs/               arquitetura e dados
```

## Stack

Google Cloud: Firebase Hosting e Authentication, Cloud Run, BigQuery, Firestore, Cloud Storage, Pub/Sub, Vertex AI (Gemini). CI/CD no GitHub Actions com Workload Identity Federation.
