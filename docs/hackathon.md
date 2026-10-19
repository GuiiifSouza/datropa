# Regras do Hackathon SEMCOMP/VALORANT

Resumo do [documento oficial](https://docs.google.com/document/d/17dyxuHI6OXzETZ2VGsu1YTDowLzNzjjPGEKr2RC4qWc/edit) da USP São Carlos, conferido em **19/10/2026**. Se houver diferença, vale o documento oficial. Mudou algo lá? Atualize aqui no mesmo dia.

## O desafio

Criar uma solução que use dados reais de partidas de VALORANT para ajudar jogadores e times a entender e melhorar o desempenho individual e coletivo. O formato é livre: dashboard, ferramenta de análise, recomendação, coaching guiado, comparador, relatório automático, visualização, descoberta de padrões.

**Público-alvo:** jogadores, treinadores, analistas e times que querem entender o próprio desempenho, achar pontos fortes e fracos e usar dados para decidir.

**Análise coletiva é especialmente bem-vinda**: desempenho do time como um todo, papéis dentro do time, padrões de jogo coletivos.

## Participação

- Online.
- Individual ou em equipe de até 5 pessoas.
- Para estudantes de graduação em Ciências da Computação, Sistemas de Informação e Ciências de Dados.

## Base de dados

- Todas as equipes recebem a mesma base: JSONs das partidas, baixados do [Drive da organização](https://drive.google.com/drive/folders/1IuptLxv1FpcvrfB6a7z9bEqPNYSsQ-hW).
- O documento cita as classificatórias 1 a 4. A pasta também traz a fase de grupos do UNIVAVÁ e a Rush Series. Tudo o que está na pasta oficial pode ser usado.
- Linguagem, framework, biblioteca e ferramenta são livres. **A origem dos dados de partida não é.**

Detalhes do formato: [docs/dados.md](dados.md).

## Regras e restrições

1. **Dados de partida só dos JSONs da organização.**
2. **Proibido completar a base** com dado de site, plataforma ou serviço externo.
3. **Proibido scraping, engenharia reversa** ou qualquer coleta equivalente em serviço de terceiros.
4. **Não é preciso integrar** com API de VALORANT, plataforma de estatísticas ou sistema de torneio. Na prática, não integre.
5. **Só pós-partida:** análise, reflexão, visualização, aprendizado ou apoio depois do jogo. Nada que interfira em partida em andamento ou dê vantagem em tempo real.
6. **Nada que interaja sem autorização** com os serviços da Riot ou com o cliente do jogo (programa, automação, integração).
7. **Respeitar direitos autorais, propriedade intelectual e licenças** de bibliotecas, imagens, fontes e código de terceiros.

### O que isso significa para o Da Tropa

| Situação | Pode? |
|---|---|
| Ler os JSONs da base e calcular estatísticas | Sim |
| Gemini (Vertex AI) analisando dados da base | Sim. A IA é ferramenta; o dado vem da base |
| Puxar partida, elo ou perfil de jogador da Riot API, tracker.gg ou VLR | **Não** |
| Tabela de tradução de UUID de agente e arma, minimapas e ícones de fonte pública | **Perguntar à organização antes.** Não é dado de partida, mas é fonte externa e arte da Riot (regras 2 e 7) |
| Prancheta tática para planejar e rever rounds | Sim, é pós-partida |
| Overlay ou dica durante o jogo | **Não** (regra 5) |

## Prazos

Horário de Brasília (UTC-3).

| Etapa | Quando |
|---|---|
| Início | Segunda, 19/10/2026, 10h |
| Monitoria | Ticket no Discord, todo dia, das 9h às 18h |
| **Entrega final** | **Sexta, 23/10/2026, 23h59** |
| Resultado | Até o fim do dia 26/10/2026, pelo canal oficial ou pela organização da SEMCOMP |

Entrega depois do horário pode ser desconsiderada. Marcos intermediários são avisados nos canais oficiais.

O prazo interno do time é mais cedo: veja [docs/plano-de-acao.md](plano-de-acao.md).

## Entregável

- **Vídeo pitch de até 5 minutos** (pode ser YouTube não listado). Precisa mostrar:
  - o problema escolhido;
  - a solução;
  - como os dados foram usados;
  - principais resultados e funcionalidades;
  - o valor para jogadores e times.
- **Link da apresentação** usada no vídeo.
- **Link do protótipo** navegável ou funcional. É opcional, mas ajuda na avaliação.
- Tudo enviado pelo [formulário oficial](https://docs.google.com/forms/d/e/1FAIpQLSc83Lzz3W4oA0Cv5g1cPUTU8SU4sD0lbjJggp--kz2nLOegUw/viewform), com o nome da equipe e de todos os integrantes.

## Critérios de julgamento

Seis critérios, nota de 1 a 5 em cada, todos com o mesmo peso. Nota máxima: 30. A nota de cada critério é a média da banca.

| Critério | O que a banca olha |
|---|---|
| Inovação | Originalidade, criatividade, solução diferente ou bem aplicada ao contexto |
| Impacto para jogadores e equipes | Gera aprendizado, apoia decisão, ajuda a entender o desempenho individual e coletivo |
| Qualidade da análise e do uso dos dados | Metodologia coerente, boas interpretações, uso adequado da base, dado virando informação útil |
| Viabilidade | Dá para implementar e evoluir: escopo, tecnologia, clareza do produto, continuidade depois do hackathon |
| Usabilidade e experiência | Fácil de entender e usar, interface clara, adequada ao público |
| Qualidade do protótipo e da apresentação | Demonstração clara, bom pitch, comunicação do problema e da solução, nível de execução |

Escala: 1 muito abaixo, 2 abaixo, 3 atende, 4 acima, 5 excelente.

## Banca

- Fernando Birche e Pedro Fracassi (Riot Games).
- Tomás Jordão Mácul, Rafael Voitexen e Matheus Franciscon (AcadArena).

## Premiação

Cada integrante do time vencedor ganha:
- kit VALORANT (camiseta e pelúcia);
- tour guiado na Riot Games, na Barra Funda, em São Paulo;
- ingresso para a final do UNIVAVÁ, sábado, 14/11.

Transporte e alimentação do tour e da final estão incluídos.

## Referências de conformidade

As restrições foram escritas com base nas políticas públicas da Riot de setembro de 2026. Se o projeto continuar depois do hackathon ou virar produto público, revise:
- [Riot Developer Portal: VALORANT Developer API Policy](https://developer.riotgames.com/docs/valorant)
- [Termos de Serviço da Riot (Brasil)](https://www.riotgames.com/pt-br/terms-of-service-BR)
- [Jurídico e política de propriedade intelectual da Riot](https://www.riotgames.com/pt-br/juridico)
