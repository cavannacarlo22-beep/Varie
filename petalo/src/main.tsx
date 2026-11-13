import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles/app.css';

registerSW({ immediate: true });

window.addEventListener('unhandledrejection', (e) => {
  console.error('Errore non gestito', e.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
