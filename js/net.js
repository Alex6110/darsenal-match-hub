// js/net.js — rete resiliente per Supabase + registrazione Service Worker
// Va caricato PRIMA di supabaseConfig.js

(function () {
  const CACHE_DATI = 'darsenal-dati-v1';
  const TIMEOUT_LETTURA = 8000;   // ms
  const TIMEOUT_SCRITTURA = 20000;
  const TENTATIVI_LETTURA = 3;
  const inVolo = new Map();       // GET identiche in corso -> una sola richiesta

  const attendi = ms => new Promise(r => setTimeout(r, ms));
  const chiaveCache = (url, accept) =>
    'https://cache.local/' + encodeURIComponent(url) + '__' + encodeURIComponent(accept || '');

  function banner(mostra) {
    let el = document.getElementById('banner-offline');
    if (!el && mostra && document.body) {
      el = document.createElement('div');
      el.id = 'banner-offline';
      el.textContent = 'Connessione assente o instabile: dati salvati';
      el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#421627;color:#fff;' +
        'font:600 11px sans-serif;text-align:center;padding:4px;padding-top:calc(4px + env(safe-area-inset-top,0px))';
      document.body.appendChild(el);
    }
    if (el) el.style.display = mostra ? 'block' : 'none';
  }

  async function tentaUnaVolta(url, init, timeoutMs) {
    const ctrl = new AbortController();
    const orig = init && init.signal;
    if (orig) {
      if (orig.aborted) ctrl.abort();
      else orig.addEventListener('abort', () => ctrl.abort(), { once: true });
    }
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  }

  async function leggiConFallback(url, init) {
    const accept = init.headers && (init.headers.get ? init.headers.get('Accept') : init.headers['Accept']);
    let ultimoErrore;
    for (let i = 0; i < TENTATIVI_LETTURA; i++) {
      if (i > 0) await attendi(400 * i);
      try {
        const res = await tentaUnaVolta(url, init, TIMEOUT_LETTURA);
        if (res.ok) {
          window.__reteInErrore = false;
          banner(false);
          try {
            const c = await caches.open(CACHE_DATI);
            await c.put(chiaveCache(url, accept), res.clone());
          } catch (e) {}
          return res;
        }
        if (res.status < 500) return res;   // 4xx: errore vero, nessun retry
        ultimoErrore = new Error('HTTP ' + res.status);
      } catch (e) {
        ultimoErrore = e;
        if (init.signal && init.signal.aborted) throw e;
      }
    }
    // Rete non utilizzabile: ultima copia salvata, se esiste
    window.__reteInErrore = true;
    try {
      const c = await caches.open(CACHE_DATI);
      const salvato = await c.match(chiaveCache(url, accept));
      if (salvato) { banner(true); return salvato; }
    } catch (e) {}
    throw ultimoErrore;
  }

  // fetch da passare a supabase-js
  window.fetchResiliente = function (input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    const metodo = (init.method || (input && input.method) || 'GET').toUpperCase();

    if (metodo !== 'GET') {
      // Scritture: un solo tentativo (niente duplicati), timeout più lungo
      return tentaUnaVolta(url, init, TIMEOUT_SCRITTURA).catch(e => {
        window.__reteInErrore = true;
        throw e;
      });
    }
    const accept = init.headers && (init.headers.get ? init.headers.get('Accept') : init.headers['Accept']);
    const k = url + '|' + (accept || '');
    if (!init.signal && inVolo.has(k)) return inVolo.get(k).then(r => r.clone());
    const p = leggiConFallback(url, init);
    if (!init.signal) {
      inVolo.set(k, p);
      p.finally(() => inVolo.delete(k)).catch(() => {});
    }
    return p.then(r => (init.signal ? r : r.clone()));
  };

  // Quando torna la rete / si riapre l'app dopo un errore: ricarica la tab corrente
  function riprova() {
    if (!window.__reteInErrore || !navigator.onLine) return;
    window.__reteInErrore = false;
    banner(false);
    const tab = localStorage.getItem('darsenal_active_tab') || 'partite';
    if (tab === 'messaggi' && typeof caricaMessaggi === 'function') caricaMessaggi();
    else if (typeof caricaDatiPerTab === 'function') caricaDatiPerTab(tab);
  }
  window.addEventListener('online', riprova);
  window.addEventListener('offline', () => banner(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') riprova();
  });

  // Service Worker registrato subito (non solo dopo il login)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
})();
