// js/net.js — rete resiliente per Supabase + dati in cache (stale-while-revalidate) + Service Worker
// Va caricato PRIMA di supabaseConfig.js

(function () {
  const CACHE_DATI = 'darsenal-dati-v1';
  const TIMEOUT_LETTURA = 8000;    // ms
  const TIMEOUT_SCRITTURA = 20000;
  const TENTATIVI_LETTURA = 3;
  const inVolo = new Map();        // GET identiche in corso -> una sola richiesta
  const inAggiornamento = new Set();
  let ultimaScrittura = 0;         // dopo una scrittura, le copie salvate prima non vengono più usate subito
  let ultimaRicarica = 0;
  let timerRicarica;

  const attendi = ms => new Promise(r => setTimeout(r, ms));

  function intestazione(init, nome) {
    const h = init && init.headers;
    if (!h) return '';
    return (h.get ? h.get(nome) : (h[nome] || h[nome.toLowerCase()])) || '';
  }
  const chiaveCache = (url, init) =>
    'https://cache.local/' + encodeURIComponent(url) + '__' +
    encodeURIComponent(['Accept', 'Range', 'Prefer'].map(n => intestazione(init, n)).join('|'));

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

  // Salva una copia della risposta con l'ora di salvataggio
  async function salvaInCache(chiave, copia) {
    try {
      const c = await caches.open(CACHE_DATI);
      const headers = new Headers(copia.headers);
      headers.set('x-salvato-il', String(Date.now()));
      await c.put(chiave, new Response(await copia.blob(), {
        status: copia.status, statusText: copia.statusText, headers
      }));
    } catch (e) {}
  }

  // Rete con timeout e retry; se non risponde, ultima copia salvata
  async function leggiConFallback(url, init, chiave) {
    let ultimoErrore;
    for (let i = 0; i < TENTATIVI_LETTURA; i++) {
      if (i > 0) await attendi(400 * i);
      try {
        const res = await tentaUnaVolta(url, init, TIMEOUT_LETTURA);
        if (res.ok) {
          window.__reteInErrore = false;
          banner(false);
          salvaInCache(chiave, res.clone());
          return res;
        }
        if (res.status < 500) return res;   // 4xx: errore vero, nessun retry
        ultimoErrore = new Error('HTTP ' + res.status);
      } catch (e) {
        ultimoErrore = e;
        if (init.signal && init.signal.aborted) throw e;
      }
    }
    window.__reteInErrore = true;
    try {
      const c = await caches.open(CACHE_DATI);
      const salvato = await c.match(chiave);
      if (salvato) { banner(true); return salvato; }
    } catch (e) {}
    throw ultimoErrore;
  }

  // Ricarica la tab corrente (se non si sta scrivendo o usando una finestra)
  function ricaricaTabCorrente() {
    const tab = localStorage.getItem('darsenal_active_tab') || 'partite';
    if (tab === 'messaggi' && typeof caricaMessaggi === 'function') caricaMessaggi();
    else if (typeof caricaDatiPerTab === 'function') caricaDatiPerTab(tab);
  }

  function programmaRicarica() {
    clearTimeout(timerRicarica);
    timerRicarica = setTimeout(() => {
      if (Date.now() - ultimaRicarica < 5000) return;
      if (document.visibilityState !== 'visible') return;
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (document.querySelector('[id*="modal"]:not(.hidden)')) return;
      ultimaRicarica = Date.now();
      ricaricaTabCorrente();
    }, 400);
  }

  // Aggiorna in background; se i dati sono cambiati ridisegna la pagina
  function aggiornaInBackground(url, init, chiave, vecchia) {
    if (inAggiornamento.has(chiave)) return;
    inAggiornamento.add(chiave);
    (async () => {
      try {
        const res = await leggiConFallback(url, init, chiave);
        if (!res.ok) return;
        const [a, b] = await Promise.all([vecchia.text(), res.text()]);
        if (a !== b) programmaRicarica();
      } catch (e) {
      } finally {
        inAggiornamento.delete(chiave);
      }
    })();
  }

  // Lettura: copia salvata subito (se valida) + aggiornamento in background
  async function leggi(url, init) {
    const chiave = chiaveCache(url, init);
    if (!init.signal) {
      try {
        const c = await caches.open(CACHE_DATI);
        const salvato = await c.match(chiave);
        if (salvato) {
          const quando = Number(salvato.headers.get('x-salvato-il')) || 0;
          if (quando > ultimaScrittura) {
            aggiornaInBackground(url, init, chiave, salvato.clone());
            return salvato;
          }
        }
      } catch (e) {}
    }
    return leggiConFallback(url, init, chiave);
  }

  // fetch da passare a supabase-js
  window.fetchResiliente = function (input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    const metodo = (init.method || (input && input.method) || 'GET').toUpperCase();

    if (metodo !== 'GET') {
      // Scritture: un solo tentativo (niente duplicati), timeout più lungo
      ultimaScrittura = Date.now();
      return tentaUnaVolta(url, init, TIMEOUT_SCRITTURA)
        .catch(e => { window.__reteInErrore = true; throw e; })
        .finally(() => { ultimaScrittura = Date.now(); });
    }
    const k = url + '|' + intestazione(init, 'Accept') + '|' + intestazione(init, 'Range') + '|' + intestazione(init, 'Prefer');
    if (!init.signal && inVolo.has(k)) return inVolo.get(k).then(r => r.clone());
    const p = leggi(url, init);
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
    ricaricaTabCorrente();
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
