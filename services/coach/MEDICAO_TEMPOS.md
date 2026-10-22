# Medicao de latencia — somente branch de teste

Branch: chico/teste-velocidade-coach. Sem deploy, merge, alteracao da Gold,
paralelismo, cache adicional ou troca de modelo nesta etapa.

## O que foi instrumentado

- Cada tentativa de chamada ao Gemini e as esperas entre retries.
- Cada tool (inclusive retorno de erro tratado).
- Cada consulta BigQuery, incluindo espera de resultado, materializacao das
  linhas no Python, cache_hit, bytes processados e numero de linhas.
- Tempo completo da chamada HTTP quando COACH_MEDIR_TEMPOS=1 no servidor local.
  Inclui autenticacao e controle de cotas antes do agente; nao inclui rede do
  navegador, renderizacao do front ou startup do container.
- Sem a flag HTTP e sem sessao CLI, cronometros ficam inativos.

Relatorios de tempo nao armazenam pergunta, token, argumentos, SQL ou resultados
das tools. O CLI salva a resposta textual para conferir qualidade; nao versionar
esses arquivos. Logs anteriores do agente continuam com o comportamento original.
Tempos de BigQuery estao incluidos nas tools; nao somar camadas diferentes.
O contador de cache indica apenas o cache de consulta do BigQuery, nao cache de
resultados das tools. O cache local de IDs ja existente pode evitar uma consulta.

## 1. Preparar e testar sem Google

Clonar em uma pasta separada no Cloud Shell:

```bash
git clone --branch chico/teste-velocidade-coach https://github.com/GuiiifSouza/datropa.git ~/datropa-coach-tempos
cd ~/datropa-coach-tempos/services/coach
python3 --version
command -v uv
```

Requer Python >=3.12 e uv. Depois de confirmar as ferramentas:

```bash
uv sync --frozen --group dev
uv run --frozen pytest -q
```

Os testes substituem Gemini/BigQuery por objetos falsos. Testes de integracao
existentes ficam ignorados sem as flags de opt-in. Nao definir essas flags nesta etapa.

## 2. Medir chamadas reais, so depois do teste offline

Executar com credenciais ADC de uma conta ja autorizada para Vertex AI e leitura
da Gold/execucao de jobs BigQuery. Nao criar chave de service account ou mudar IAM.
Se faltar permissao, conferir com Guilherme. Configuracao padrao: datropa,
southamerica-east1, gemini-2.5-flash; confirmar que coincide com o servico publicado.

```bash
uv run --frozen python -m coach.medir_cli --repeticoes 3 --saida tempos_coach_comparacao.json "Compare Wolf Gaming e Azure Bears Golden."
```

AVISO: sao tres perguntas reais, com uso/custo de Gemini e consultas BigQuery.
Este CLI nao passa pela rota HTTP e portanto nao aplica os limites por usuario
da API. O limite de bytes por consulta continua ativo. Nao chamar em loop aberto.
Ao ocorrer erro, salva o que mediu e para, sem completar as demais repeticoes.
Arquivo de saida existente nao e sobrescrito.

O CLI cria uma conversa sem historico a cada repeticao, no mesmo processo.
A primeira pode inicializar clientes e o cache de IDs; as demais podem reutilizar.
Nao equivale a medir cold start do Cloud Run. Importacoes iniciais ficam fora.
Pergunta continuada como "Compare com..." exige contexto/historico; nao usar
isoladamente para comparar tempos com a tela que ja tinha um time escolhido.

```bash
cloudshell download tempos_coach_comparacao.json
```

Revisar resposta, tools_com_erro, tentativas e tempos por fase; nao interpretar
mediana de falhas como melhoria de desempenho. Repetir perguntas da demo, jogador,
economia e fora do escopo antes de aceitar qualquer otimizacao futura.

## 3. Medicao HTTP opcional, local

```bash
COACH_MEDIR_TEMPOS=1 uv run --frozen uvicorn coach.app:app --host 127.0.0.1 --port 8081
```

Mantem JWT/cotas e formato de resposta. O log coach_tempos traz um ID aleatorio
para correlacionar fases; nao e exposto ao frontend. Esta etapa requer uma sessao
de teste autorizada e configuracao local do cliente; nao aponta o site oficial
para o servidor local. Nao publicar nem alterar variaveis do Cloud Run.

## Validacao desta implementacao

112 testes aprovados e 13 integracoes ignoradas no ambiente local do agente,
sem GCP, incluindo isolamento de contextos, preservacao de erros/respostas,
retries, cache de consulta, propagacao para thread HTTP e gravacao do CLI.
Nenhum tempo real do Google foi medido ainda. Nenhuma otimizacao foi aplicada.
