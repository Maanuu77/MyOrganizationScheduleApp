// Punto de entrada: monta React y registra el service worker de la PWA.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { MotionConfig } from 'motion/react';
import './tema.css';
import { App } from './App';
import { registrarServiceWorker } from './serviceWorker';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* reducedMotion="user": si el sistema pide menos movimiento, las animaciones se suavizan */}
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
);

registrarServiceWorker();
