// Service worker de Holm.
//
// El listener de 'fetch' es passthrough a propósito: NO llamamos a respondWith,
// así la red la sigue manejando el navegador. Interceptar sin tener nada en
// caché rompe las peticiones cuando fallan. Su único papel aquí es que la app
// sea instalable; trabajar sin conexión ya se verá.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  /* passthrough: sin respondWith */
});

// Push real: el navegador despierta este worker aunque Holm esté cerrado. El
// servidor manda el cuerpo como JSON { title, body, url }.
//
// `icon` y `badge` son obligatorios en la práctica: en Android un push sin
// icono se descarta en silencio, y tiene que ser PNG (el SVG no lo rasteriza).
// `tag` + `renotify` reemplazan el aviso anterior en vez de acumularlos.
self.addEventListener('push', (event) => {
  let data = { title: 'Holm', body: '', url: '/calendario' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* payload ilegible: se muestra el aviso genérico */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'holm',
      renotify: true,
      data: { url: data.url || '/calendario' },
    }),
  );
});

// Tocar el aviso enfoca una ventana de Holm ya abierta (llevándola a la vista
// que toca) o abre una nueva.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/calendario';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const cliente of lista) {
        if ('focus' in cliente) {
          if ('navigate' in cliente) cliente.navigate(url).catch(() => {});
          return cliente.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
