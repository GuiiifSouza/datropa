import { Component, type ReactNode } from 'react';

/**
 * Segura erro de render de uma tela (hoje, a prancheta) para o site não ficar em branco.
 * Mostra um aviso no lugar da tela e deixa recomeçar sem o link que deu problema.
 */
export class LimiteDeErro extends Component<{ children: ReactNode; titulo: string; recomecar: string }, { erro: boolean }> {
  state = { erro: false };

  static getDerivedStateFromError() { return { erro: true }; }

  componentDidCatch(erro: unknown) { console.error(erro); }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <main className="pagina pagina--estreita">
        <div className="estado estado--erro" role="alert">
          <b className="titulo-s">{this.props.titulo}</b>
          <span>Algo deu errado ao montar a tela. Se veio de um link, ele pode estar incompleto.</span>
          {/* recarrega a página inteira: a tela volta do zero, sem o estado que quebrou */}
          <a href={this.props.recomecar} className="botao">Abrir vazia</a>
        </div>
      </main>
    );
  }
}
