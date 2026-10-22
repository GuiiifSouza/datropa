import { Link } from '../rotas';

export function NaoEncontrada() {
  return (
    <main className="pagina pagina--estreita">
      <div className="estado">
        <span className="titulo-xl cor-ia">404</span>
        <b className="titulo-s">Essa página não existe</b>
        <span>O link pode estar errado ou a página mudou de lugar.</span>
        <Link para="/" className="botao">Ir para o Panorama</Link>
      </div>
    </main>
  );
}
