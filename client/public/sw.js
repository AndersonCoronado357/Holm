// Service worker mínimo: existe para que Holm se pueda instalar como app.
//
// El listener de 'fetch' es passthrough a propósito: NO llamamos a respondWith,
// así la red la sigue manejando el navegador. Interceptar sin tener nada en
// caché rompe las peticiones cuando fallan. Trabajar sin conexión ya se verá.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  /* passthrough */
});

// Avisos de los eventos del calendario. Con el service worker el navegador
// puede mostrarlos aunque la pestaña no esté abierta.
// El icono es obligatorio en la práctica: en Android una notificación sin él
// se descarta en silencio.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      const abierta = lista.find((c) => 'focus' in c);
      if (abierta) return abierta.focus();
      return self.clients.openWindow('/calendario');
    }),
  );
});
