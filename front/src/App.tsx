import { lazy, Suspense } from 'react';
import { AuthProvider } from './auth/Auth';
import { CoachProvider, PainelCoach } from './coach/Coach';
import { CatalogoProvider } from './componentes/Catalogo';
import { Header, NavInferior, Rodape } from './componentes/Moldura';
import { MotorDeVida } from './componentes/Vida';
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
import { Comparar } from './paginas/Comparar';
import { Mapa } from './paginas/Mapa';
import { NaoEncontrada } from './paginas/NaoEncontrada';
import { Carregando } from './componentes/Visuais';
import { LimiteDeErro } from './componentes/LimiteDeErro';

// a prancheta é a tela mais pesada (motor, molde e estilos próprios): só baixa quando alguém abre
const Prancheta = lazy(() => import('./paginas/Prancheta').then((m) => ({ default: m.Prancheta })));

const ROTAS: Rota[] = [
  { padrao: '/', render: () => <Panorama /> },
  { padrao: '/partidas', render: () => <Partidas /> },
  { padrao: '/partidas/:id', render: (p) => <Partida key={p.id} id={p.id} /> },
  { padrao: '/times', render: () => <Times /> },
  { padrao: '/times/:id', render: (p) => <Time key={p.id} id={p.id} /> },
  { padrao: '/jogadores/:id', render: (p) => <Jogador key={p.id} id={p.id} /> },
  { padrao: '/estatisticas', render: () => <Estatisticas /> },
  { padrao: '/meta', render: () => <Meta /> },
  { padrao: '/mapas/:id', render: (p) => <Mapa key={p.id} id={p.id} /> },
  { padrao: '/comparar', render: () => <Comparar /> },
  { padrao: '/tropa-ai', render: () => <TropaAI /> },
  // Prancheta tática: dono Rhuan. Contrato do link: /prancheta?partida_id=<id>&round=<n>.
  // o limite de erro segura link ?j= estragado ou falha ao baixar a tela, para o site não ficar em branco
  { padrao: '/prancheta', render: () => (
    <LimiteDeErro key={window.location.search} titulo="Não deu para abrir a prancheta" recomecar="/prancheta">
      <Suspense fallback={<main className="pagina"><Carregando altura={480} /></main>}><Prancheta /></Suspense>
    </LimiteDeErro>
  ) },
];

export function App() {
  return (
    <AuthProvider>
      <CatalogoProvider>
        <CoachProvider>
          <div className="app">
            <a href="#conteudo" className="pular" onClick={(e) => { e.preventDefault(); document.getElementById('conteudo')?.focus(); }}>Pular para o conteúdo</a>
            <MotorDeVida />
            <Header />
            <PainelCoach />
            <div id="conteudo" tabIndex={-1} style={{ flex: 1, display: 'flex', flexDirection: 'column', outline: 'none' }}>
              <Roteador rotas={ROTAS} naoEncontrada={<NaoEncontrada />} />
            </div>
            <Rodape />
            <NavInferior />
          </div>
        </CoachProvider>
      </CatalogoProvider>
    </AuthProvider>
  );
}
