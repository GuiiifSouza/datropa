import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './estilos/tokens.css';
import './estilos/base.css';
import './estilos/hubs.css';
import './estilos/graficos.css';
import './estilos/coach.css';
import './estilos/paginas.css';
import './estilos/animacoes.css';
import './estilos/polimento.css';
import './estilos/novas.css';

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
