import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { AuthProvider } from './state/auth';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);

// Service worker: hace la app instalable y es quien recibe los push, así que
// los avisos llegan con Holm cerrado.
//
// Se registra TAMBIÉN en desarrollo, a propósito: sin él no hay `PushManager`
// y los avisos no se pueden probar hasta producción. Es seguro porque el
// worker no cachea nada (su `fetch` es passthrough), así que no se queda con
// un bundle viejo ni estorba al recargar.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* sin service worker la app funciona igual, solo no se instala */
    });
  });
}
