# Identidade: Da Tropa 2.0, "Sinal Aberto + Strafe"

Tokens em `src/estilos/tokens.css`. Não use cor, fonte ou raio fora deles.

## Cores

| Token | Cor | Uso |
|---|---|---|
| `--fundo` | #0F1923 | fundo da página |
| `--superficie`, `--superficie-2` | #16212C, #1C2A36 | cartões e cartões internos |
| `--superficie-ia` | #1F1219 | blocos da Tropa AI |
| `--vermelho` | #FF4655 | Tropa AI, item ativo, ação principal |
| `--ambar` | #F9A23B | time A, ataque |
| `--menta` | #32E0C4 | time B, defesa, prancheta |
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

## Movimento

Tudo em `src/estilos/animacoes.css` e `src/componentes/Vida.tsx`, desligado para quem pede menos movimento no sistema.

- Botões sobem um pouco no hover, afundam no clique e o principal tem um brilho que atravessa.
- Pílula ou item de menu escolhido dá um "estalo".
- Cartões têm um holofote que segue o ponteiro e sobem no hover.
- As páginas entram em cascata; blocos abaixo da dobra aparecem ao rolar. O que já está na tela ao carregar nunca começa escondido.
- Os gráficos se desenham: barras crescem, a linha do momentum é traçada, os anéis enchem e as células do livro de rounds estalam em sequência.
- Números grandes contam até o valor (`<Contador>`).
- O fundo tem três manchas de luz que derivam devagar, e o ticker de resultados corre sozinho (para no hover).
- Menus suspensos são nossos (`<Seletor>`), nunca o `<select>` do navegador: abrem com animação e funcionam no teclado.

## Não fazer

- Texto na cor da série nos gráficos (o número fica em `--giz`; a cor fica na marca).
- Vermelho para algo que não seja IA, ativo ou ação.
- Arte da Riot antes do OK da organização.
- Zero no lugar de valor desconhecido.
- `<select>` nativo: use `<Seletor>`.
