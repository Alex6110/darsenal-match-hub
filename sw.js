// Service Worker per le Web Push Notifications a app chiusa

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Darsenal - Match Hub';
  const options = {
    body: data.body || 'Hai una nuova notifica.',
    icon: 'logo.png',
    badge: 'logo.png',
    data: { url: data.url || '/' }
  };

  if ('setAppBadge' in navigator) {
    navigator.setAppBadge(1).catch(() => {});
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }

  const targetUrl = event.notification.data.url || '/';

  // Usa openWindow per forzare l'apertura e la navigazione corretta su Android e iOS
  event.waitUntil(
    clients.openWindow(targetUrl)
  );
});