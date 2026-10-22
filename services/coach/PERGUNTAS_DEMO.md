# Perguntas da demo do coach

Testadas em 22/10/2026 contra o Vertex AI (`gemini-2.5-flash`) e a gold `gold_336_v1`, com o código desta pasta. As 10 perguntas saíram das sugestões que a tela do coach mostra no front (`Coach.tsx`, `Panorama.tsx`, `Time.tsx`, `Jogador.tsx` e `Partida.tsx`, branch `front/site-completo`). As 10 perguntas do gugu citadas no plano não estavam no repo.

Quando a tela tem contexto, o front manda a pergunta com o prefixo `[Contexto da tela: <tipo> <id> (<rótulo>)]`. As perguntas 3, 4 e 10 foram testadas assim.

**Como rodar:** `COACH_TESTE_REAL=1 uv run pytest tests/test_perguntas.py -s`. O teste confere a tool chamada, que nenhuma tool deu erro e que todo número da resposta aparece no resultado das tools. Resultado em 22/10: 13 de 13 em duas rodadas seguidas (as 10 da demo e mais 3 de cobertura).

**Conferência com o BigQuery:** os números abaixo foram conferidos com SQL escrito à parte, direto na gold, e bateram.

Nicks de jogador ficam fora deste arquivo porque o repo é público. Na demo eles aparecem na tela, vindos da base.

| # | Pergunta | Tool | Resposta (resumo) | Passou |
|---|---|---|---|---|
| 1 | Quem foi o melhor jogador da fase de grupos do Univavá? | `ranking_jogadores` (acs, `UNIVAVA_G`) | Critério ACS: o 1º é da Green Owls Jacurutu, 272,3 de ACS em 8 partidas (176 rounds), K/D 1,21. 82 jogadores com 3+ partidas na fase | sim |
| 2 | Qual time converte melhor depois de plantar a spike? | `ranking_times` (pos_plant) | Ceub Octopus: 92,45% em 53 oportunidades (49 vitórias). Mínimo de 3 partidas e 10 oportunidades | sim |
| 3 | (tela do jogador) Em qual agente o \<jogador\> rende mais? | `stats_jogador` | Compara ACS e K/D por agente, com o número de partidas de cada um, e avisa quando a amostra do melhor agente é menor | sim |
| 4 | (tela do Wolf Gaming) Faz um scouting do Wolf Gaming: mapas, lado forte, composição e jogadores-chave. | `scouting_time` | 68,75% de vitória em 16 partidas; ataque 54,71% e defesa 56,67%; Ascent 100% em 4 (composição Omen, Jett, Phoenix, Sova, Cypher; site B em 55,88% dos plants); Split e Summit 33,33%; pós-plant 73,11% em 119; eco é o ponto fraco (33,33% em 36 rounds) | sim |
| 5 | Macklogic Red ou Azure Bears Golden: quem está melhor? | `comparar_times` | Macklogic 90,91% de vitória em 11 partidas; Azure 75% em 32, mas na frente em K/D do time (1,32 x 1,15), rounds (64,08% x 61,4%) e defesa (67,21% x 61,67%). Sem confronto direto | sim |
| 6 | Como o Wolf Gaming se sai nos rounds de force? | `economia_time` | 54,0% em 63 rounds de force (34 vitórias); 56,3% em 32 no ataque e 51,6% em 31 na defesa | sim |
| 7 | Quem segura melhor depois de plantar a spike: Minerva Thunders ou UFMT Turuna? | `pos_plant_retake` ou `comparar_times` | UFMT Turuna 74,5% em 263 oportunidades; Minerva Thunders 72,6% em 106 | sim |
| 8 | Qual composição mais ganha em Lotus? | `composicoes` | Omen, Neon, Raze, Fade e Vyse: 75% em 8 aparições | sim |
| 9 | Me conta como foi o Split entre Macklogic Red e Wolf Gaming. | `resumo_partida` (time, adversário e mapa) | Macklogic Red 16 x 14, 7 x 5 no intervalo, fase de grupos do Univavá (20/09/2026); maior ACS 293,7 e mais abates (29) do lado da Macklogic; 3 rounds vencidos pela Macklogic e 2 pelo Wolf com compra inferior (force contra full) | sim |
| 10 | (tela da partida) Qual foi o round que decidiu esse mapa? Abre ele na prancheta. | `resumo_partida` + `abrir_na_prancheta` | Round 30, o que fechou o mapa: Macklogic Red venceu no ataque por eliminação, plant no A. Link `https://datropa.web.app/prancheta?partida_id=a8065391-…&round=30` | sim |

## O que quebrou no teste e foi corrigido

- **Ranking não existia.** As perguntas 1 e 2 estão fixas no Panorama do front, e o coach respondia que não tinha o dado ou pedia um time. Entraram `ranking_jogadores` e `ranking_times`, com filtro de torneio e fase.
- **"Wolf Gaming" pedia desambiguação** com o Wolf Gaming Academy, mesmo com nome exato. O prompt agora segue o candidato com `correspondencia_exata`.
- **"Como foi o Split entre A e B" ia para `comparar_times`** e devolvia o histórico dos dois times. Agora vai para `resumo_partida`.
- **Número sem tool:** numa rodada, o modelo respondeu "100% de vitória em 3 partidas" sem consultar nada. O loop agora cobra a consulta e, se ele insistir, devolve uma mensagem segura.
- **Conta própria:** o modelo calculou "first bloods por round". O prompt proíbe métrica derivada, e `stats_jogador` passou a trazer ACS pronto.
- **Falha passageira do Vertex** ("Server disconnected") derrubava a pergunta. Agora repete até 3 vezes.
- **Link da prancheta** apontava para `devs.datropa.com`, que não tem DNS. Agora usa `https://datropa.web.app`.

## Limites que continuam

- Round decisivo e MVP não têm critério oficial. O coach diz o critério que usou (o round que fechou o mapa, o maior ACS).
- Com temperatura 0,2, o texto muda entre rodadas. Os números e a tool escolhida ficaram iguais nas duas rodadas, salvo na pergunta 7, que às vezes usa `comparar_times` em vez de `pos_plant_retake`, com os mesmos números.
- O teste com login real do Firebase em produção não foi feito: o front no ar ainda é a página provisória.
