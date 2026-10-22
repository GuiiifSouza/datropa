# Validação local — 22/10/2026

API em 127.0.0.1:8083.
Frontend da branch front/site-completo, executado com Vite na porta 5173.
Configuração: VITE_FONTE_DADOS=api e proxy para a API local.
Arquivos do frontend conferidos e iguais à branch de origem.

## Verificado

- 20 testes automatizados aprovados com BigQuery simulado.
- Container iniciou e respondeu ao status.
- Ranking consultado no container com token temporário:
  HTTP 200, um jogador e total de 411.
- Ranking pelo proxy do frontend: HTTP 200, total de 411.
- Filtro Ascent: total de 293; Kaytoh com 200 kills.
- Ufmt Turuna: 36 partidas, 23 vitórias e 705 rounds.
- Partida 9672a9d8-21a8-4b85-9c62-217a0e8f0ed9:
  placar 9 × 13, dez jogadores e 22 rounds coerentes.
- Gráficos da Ufmt no Ascent:
  ataque 69/100, defesa 79/126;
  pós-plant 66/79, retake 23/64;
  economia: pistol 16/24, eco 6/21, force 24/38, full 102/143.
- npm run tipos e npm run build concluídos sem erros.

## Pendências

- Conferir a origem e o recorte da coluna “Cena”.
- Validar prancheta e calor nas telas quando a implementação estiver disponível.
- Validar autenticação e permissões de sa-stats no Cloud Run.
- Deploy e teste integrado no ambiente publicado.
- Demais limitações registradas no README e no contrato permanecem aplicáveis.
