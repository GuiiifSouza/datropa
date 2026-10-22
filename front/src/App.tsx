import { AuthProvider } from './auth/Auth';
import { CoachProvider, PainelCoach } from './coach/Coach';
import { CatalogoProvider } from './componentes/Catalogo';
import { Header, Rodape } from './componentes/Moldura';
import { Roteador, type Rota } from './rotas';
import { Panorama } from './paginas/Panorama';
import { Partidas } from './paginas/Partidas';
import { Partida } from './paginas/Partida';
import { Times } from './paginas/Times';
import { Time } from './paginas/Time';
import { Jogador } from './paginas/Jogador';
import { Estatisticas } from './paginas/Estatisticas';
import { Meta } from './paginas/Meta';
import { TropaAI } from './paginas/TropaAI';
import { Prancheta } from './paginas/Prancheta';
import { NaoEncontrada } from './paginas/NaoEncontrada';

const ROTAS: Rota[] = [
  { padrao: '/', render: () => <Panorama /> },
  { padrao: '/partidas', render: () => <Partidas /> },
  { padrao: '/partidas/:id', render: (p) => <Partida key={p.id} id={p.id} /> },
  { padrao: '/times', render: () => <Times /> },
  { padrao: '/times/:id', render: (p) => <Time key={p.id} id={p.id} /> },
  { padrao: '/jogadores/:id', render: (p) => <Jogador key={p.id} id={p.id} /> },
  { padrao: '/estatisticas', render: () => <Estatisticas /> },
  { padrao: '/meta', render: () => <Meta /> },
  { padrao: '/tropa-ai', render: () => <TropaAI /> },
  // Prancheta tática: dono Rhuan. Contrato do link: /prancheta?partida_id=<id>&round=<n>.
  { padrao: '/prancheta', render: () => <Prancheta /> },
];

export function App() {
  return (
    <AuthProvider>
      <CatalogoProvider>
        <CoachProvider>
          <div className="app">
            <a href="#conteudo" className="pular">Pular para o conteúdo</a>
            <Header />
            <PainelCoach />
            <div id="conteudo" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Roteador rotas={ROTAS} naoEncontrada={<NaoEncontrada />} />
            </div>
            <Rodape />
          </div>
        </CoachProvider>
      </CatalogoProvider>
    </AuthProvider>
  );
}
