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

// Service worker: hace la app instalable y permite que los avisos del
// calendario salgan aunque la pestaña no esté abierta. En desarrollo no se
// registra, que se queda cacheando el bundle y estorba.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* sin service worker la app funciona igual, solo no se instala */
    });
  });
}
