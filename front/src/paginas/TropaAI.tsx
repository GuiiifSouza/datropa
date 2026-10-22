/** 08 · Tropa AI em tela cheia: uma coluna só, conversa e compositor. Sem painel lateral. */
import { BoasVindas, Compositor, Conversa, useCoach } from '../coach/Coach';

export function TropaAI() {
  const { mensagens, novaConversa } = useCoach();
  return (
    <main className="tropa-tela">
      <div className="tropa-tela__barra">
        <span className="rotulo rotulo--vermelho">TROPA AI · COACH</span>
        {mensagens.length > 0 && <button type="button" className="botao botao--linha botao--pequeno" onClick={novaConversa}>+ Nova conversa</button>}
      </div>
      <div className="tropa-tela__corpo">
        {mensagens.length === 0 ? <BoasVindas /> : <Conversa grande />}
      </div>
      <div className="tropa-tela__rodape">
        <Compositor grande autoFoco />
        <span className="tropa-tela__nota">Respostas só com dados da base. Quando der para ver em gráfico, a Tropa AI mostra o gráfico.</span>
      </div>
    </main>
  );
}
