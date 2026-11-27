/* NAidioma Web Push Worker — Avisos carinhosos do bichinho na tela do celular (Android, Desktop & iPhone PWA iOS 16.4+) */
self.addEventListener('push', (event) => {
  let payload = {
    title: '🧩 NAidioma',
    body: 'Seu bichinho está te esperando para encaixar 1 pecinha hoje!',
    url: '/',
    tag: 'naidioma-daily-reminder',
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag || 'naidioma-daily-reminder',
      renotify: true,
      vibrate: [120, 60, 120],
      data: { url: payload.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
