# Identidade: Da Tropa 2.0, "Sinal Aberto + Strafe"

Tokens em `src/estilos/tokens.css`. Não use cor, fonte ou raio fora deles.

## Cores

| Token | Cor | Uso |
|---|---|---|
| `--fundo` | #0F1923 | fundo da página |
| `--superficie`, `--superficie-2` | #16212C, #1C2A36 | cartões e cartões internos |
| `--superficie-ia` | #1F1219 | blocos da Tropa AI |
| `--vermelho` | #FF4655 | Tropa AI, item ativo, ação principal |
| `--time-a` | #FF4655 | time A e ataque nos dados (placares, gráficos), como no VALORANT |
| `--time-b` | #3FA9F5 | time B e defesa nos dados |
| `--ambar` | #F9A23B | destaque de rótulos e líderes |
| `--menta` | #32E0C4 | prancheta |
| `--alerta` | #F5E36B | prorrogação e destaque |
| `--giz`, `--giz-2`, `--apagado` | #ECE8E1, #C5CBD3, #9AA6B2 | texto principal, secundário e rótulos |
| `--trilho` | #263442 | fundo de barra |

## Tipos

- **Big Shoulders Display 900**, caixa alta: títulos e números grandes (`.titulo-xl`, `.titulo-l`, `.num`).
- **Inter Tight**: texto.
- **JetBrains Mono**, caixa alta e espaçado: rótulos (`.rotulo`), fontes de dado, códigos.
- **Caveat**: só nos balões de dica do orbe da prancheta.

## Formas

Pílulas (`999px`) para botões e filtros; cartões com raio 22 a 40. Bordas de 1px em `--linha`. Sombra só no header, no painel da IA e em menus.

## Componentes principais

- **Header** com logo e navegação à esquerda, os dois orbes no centro (Tropa AI e Prancheta) e busca e conta à direita. Os orbes descem um pouco para fora da barra. No hover, a IA ganha ícones em órbita 3D e a prancheta mostra o lápis rabiscando e balões de dica.
- **Cartão de série** em grid fixo: time A, placar, time B, MD, botão da prancheta; os mapas em três slots iguais.
- **Banner da prancheta** em toda tela com partida ou round.
- **Figura**: moldura de gráfico com título, legenda, Gráfico/Tabela e fonte.
- **Estados**: esqueleto ao carregar, erro com "tentar de novo", vazio com dica do que mudar.

## Times e agentes

- **Logo do time sem moldura** (`<SeloTime>`): a arte aparece inteira, com sombra e brilho na cor do próprio time. Nada de quadrado âmbar ou menta atrás. Tamanhos `p` 30, `m` 46, `g` 84 e `xg` até 196 px.
- **Cor do time** vem da logo: `scripts/cores_logos.py` gera `src/util/coresTimes.ts` (rode de novo ao trocar ou incluir logos). Time sem logo ganha um tom fixo derivado do nome. Use `estiloTime(nome)`, que define `--cor-time` e `--cor-time-2`; a página do time, o cartão da lista e o confronto da partida se pintam com elas.
- Vermelho e azul (`--time-a`, `--time-b`) continuam sendo **time A e time B dos dados** (placares, gráficos de série). A cor da logo é identidade, não substitui essa regra.
- **Arte de corpo inteiro** (`<CorpoAgente>`, `public/arte/agentes/corpo`): pódio do Meta, cartões de agente, topo do jogador, elenco do time e faixa do agente filtrado em Estatísticas. A cor de fundo atrás do retrato é a do agente (`COR_AGENTE`).

## Responsivo

- Acima de 1180 px o header é uma linha com os orbes no centro; até 899 px vira duas linhas com a navegação centralizada; até 640 px a navegação vai para uma barra fixa embaixo (`<NavInferior>`).
- Teste sempre em 390, 768/820 e 1024 px, sem rolagem horizontal.
- Faixas roláveis (pílulas, elenco e pódio no celular) não cortam o hover e não passam a rolagem para a página.

## Movimento

Tudo em `src/estilos/animacoes.css` e `src/componentes/Vida.tsx`, desligado para quem pede menos movimento no sistema.

- Botões sobem um pouco no hover, afundam no clique e o principal tem um brilho que atravessa.
- Pílula ou item de menu escolhido dá um "estalo".
- Cartões têm um holofote que segue o ponteiro e sobem no hover.
- As páginas entram em cascata; blocos abaixo da dobra aparecem ao rolar. O que já está na tela ao carregar nunca começa escondido.
- Os gráficos se desenham: barras crescem, a linha do momentum é traçada, os anéis enchem e as células do livro de rounds estalam em sequência.
- Números grandes contam até o valor (`<Contador>`).
- O fundo tem três manchas de luz que derivam devagar, e o ticker de resultados corre sozinho (para no hover).
- Com o painel da Tropa AI aberto, a página de trás não rola (`html.rolagem-presa`).
- Menus suspensos são nossos (`<Seletor>`), nunca o `<select>` do navegador: abrem com animação e funcionam no teclado.

## Não fazer

- Texto na cor da série nos gráficos (o número fica em `--giz`; a cor fica na marca).
- Vermelho para algo que não seja IA, ativo, ação ou o time A/ataque nos dados.
- Arte da Riot antes do OK da organização.
- Zero no lugar de valor desconhecido.
- `<select>` nativo: use `<Seletor>`.
