// Service Worker: cache per uso offline + Web Push a app chiusa
const VERSIONE = 'darsenal-shell-v2';   // cambiala quando vuoi forzare un reset della cache
const CACHE_DATI = 'darsenal-dati-v1';   // usata da js/net.js, non va cancellata

const FILE_APP = [
  './', 'index.html', 'manifest.json', 'logo.png', 'pdf-styles.css', 'tailwind.css',
  'js/net.js', 'js/data.js', 'js/supabaseConfig.js', 'js/state.js', 'js/app.js',
  'js/modules/ui.js', 'js/modules/giocatori.js', 'js/modules/auth.js', 'js/modules/partite.js',
  'js/modules/classifica.js', 'js/modules/convocazioni.js', 'js/modules/sondaggi.js',
  'js/modules/pdf.js', 'js/modules/notifiche.js', 'js/modules/formazione.js', 'js/modules/saldo.js'
];
const FILE_CDN = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js',
  'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js',
  'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/l10n/it.js',
  'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css',
  'https://fonts.googleapis.com/css2?family=Caladea:wght@400;700&display=swap'
];
const HOST_CDN = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSIONE);
    // allSettled: un file che fallisce non blocca l'installazione
    await Promise.allSettled([
      ...FILE_APP.map(u => cache.add(new Request(u, { cache: 'reload' }))),
      ...FILE_CDN.map(u => cache.add(new Request(u, { mode: 'no-cors' })))
    ]);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nomi = await caches.keys();
    await Promise.all(nomi.filter(n => n !== VERSIONE && n !== CACHE_DATI).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

function conTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.hostname.endsWith('supabase.co')) return;   // dati: li gestisce js/net.js

  // Librerie e font su CDN: prima la cache (versioni fissate), rete solo se mancano
  if (HOST_CDN.includes(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSIONE);
      const salvato = await cache.match(req);
      if (salvato) return salvato;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  // File dell'app: rete se risponde entro 4s (sempre aggiornati), altrimenti cache
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSIONE);
      try {
        const res = await conTimeout(fetch(req), 4000);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (e) {
        const salvato = await cache.match(req, { ignoreSearch: true });
        if (salvato) return salvato;
        if (req.mode === 'navigate') {
          const home = await cache.match('index.html');
          if (home) return home;
        }
        throw e;
      }
    })());
  }
});

// -------------------------------------------------------------
// Web Push (invariato)
// -------------------------------------------------------------

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

  const relativeUrl = event.notification.data.url || '/';
  const targetUrl = new URL(relativeUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});