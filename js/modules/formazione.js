// js/modules/formazione.js

let moduloAttivo = '2-3-1';
let formazioneTitolari = {}; 
let riserveLista = [];
let menuRiserveAperto = false;
let spostamentoAbilitato = false;
let giocatoreSelezionato = null;
let partitaCorrenteId = null;

const COORDINATE_MODULI = {
  '2-3-1': [
    { id: 0, ruolo: 'Portiere', top: '85%', left: '50%', isPortiere: true },
    { id: 1, ruolo: 'Difensore', top: '65%', left: '28%' },
    { id: 2, ruolo: 'Difensore', top: '65%', left: '72%' },
    { id: 3, ruolo: 'Esterno', top: '40%', left: '18%' },
    { id: 4, ruolo: 'Centrocampista', top: '38%', left: '50%' },
    { id: 5, ruolo: 'Esterno', top: '40%', left: '82%' },
    { id: 6, ruolo: 'Attaccante', top: '16%', left: '50%' }
  ],
  '3-2-1': [
    { id: 0, ruolo: 'Portiere', top: '85%', left: '50%', isPortiere: true },
    { id: 1, ruolo: 'Difensore', top: '65%', left: '20%' },
    { id: 2, ruolo: 'Difensore', top: '65%', left: '50%' },
    { id: 3, ruolo: 'Difensore', top: '65%', left: '80%' },
    { id: 4, ruolo: 'Centrocampista', top: '38%', left: '35%' },
    { id: 5, ruolo: 'Centrocampista', top: '38%', left: '65%' },
    { id: 6, ruolo: 'Attaccante', top: '16%', left: '50%' }
  ],
  '3-1-2': [
    { id: 0, ruolo: 'Portiere', top: '85%', left: '50%', isPortiere: true },
    { id: 1, ruolo: 'Difensore', top: '65%', left: '20%' },
    { id: 2, ruolo: 'Difensore', top: '65%', left: '50%' },
    { id: 3, ruolo: 'Difensore', top: '65%', left: '80%' },
    { id: 4, ruolo: 'Centrocampista', top: '42%', left: '50%' },
    { id: 5, ruolo: 'Attaccante', top: '16%', left: '35%' },
    { id: 6, ruolo: 'Attaccante', top: '16%', left: '65%' }
  ]
};


// --- FEEDBACK TATTILE (Android + iPhone) ---
// Android/Chrome: Vibration API (navigator.vibrate).
// iPhone/iPad: iOS non ha la Vibration API e ignora i "tick" avviati da codice. Il tick di sistema parte
// solo se il DITO tocca davvero un interruttore vero (<input type="checkbox" switch>, iOS 17.4+).
// Quindi su iOS mettiamo un interruttore vero e invisibile (opacity 0) SOTTO il dito, sopra ogni
// pedina e ogni pulsante della Formazione: il tocco è vero e iOS fa il tick.
const HA_VIBRATE = typeof navigator.vibrate === 'function';
// stile inline = funziona anche se il CSS dell'index non c'è o la PWA ha una versione vecchia in cache
const HAPTIC_SW_HTML = HA_VIBRATE ? '' :
  '<input type="checkbox" switch class="haptic-sw" tabindex="-1" aria-hidden="true" ' +
  'style="position:absolute;left:0;top:0;width:100%;height:100%;margin:0;opacity:0;z-index:5;">';
const TATTILE_SU_PULSANTI = true;     // false = niente interruttore invisibile sui pulsanti (solo sulle pedine)

function triggerHaptic(pattern = 40) {
  try { if (HA_VIBRATE) navigator.vibrate(pattern); } catch (e) { /* nessuna vibrazione disponibile */ }
}

// iOS: aggiunge l'interruttore invisibile ai pulsanti della sezione (idempotente)
function initTattileIOS() {
  if (HA_VIBRATE || !TATTILE_SU_PULSANTI) return;
  document.querySelectorAll('#view-formazione button').forEach((btn) => {
    if (btn.querySelector('.haptic-sw')) return;
    if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative';
    btn.insertAdjacentHTML('beforeend', HAPTIC_SW_HTML);
  });
}

// CSS della sezione Formazione iniettato da qui: non serve più aggiungerlo all'index.html
(function iniettaCssFormazione() {
  if (document.getElementById('formazione-css')) return;
  const st = document.createElement('style');
  st.id = 'formazione-css';
  st.textContent = `
    .pedina-formazione { touch-action:none; -webkit-touch-callout:none; -webkit-user-select:none; user-select:none; -webkit-tap-highlight-color:transparent; }
    .pedina-sollevata { opacity:.35; }
    .pedina-target { outline:3px solid #fbbf24; outline-offset:3px; border-radius:14px; }
    .pedina-ghost { position:fixed; left:0; top:0; z-index:9999; pointer-events:none; display:flex; flex-direction:column; align-items:center; }
    .pedina-ghost-nome { margin-top:4px; background:rgba(15,23,42,.9); color:#fff; font-size:9px; font-weight:700; padding:2px 8px; border-radius:6px; white-space:nowrap; }
    .haptic-sw { position:absolute; left:0; top:0; width:100%; height:100%; margin:0; opacity:0; z-index:5; }
  `;
  document.head.appendChild(st);
})();

// Funzione per salvare la formazione su Supabase
window.salvaFormazioneSuSupabase = async function() {
  if (typeof isAdmin !== 'undefined' && !isAdmin) {
    return mostraAlert("Solo l'amministratore può salvare la formazione.");
  }
  if (!partitaCorrenteId) {
    return mostraAlert("Nessuna partita attiva trovata.");
  }

  const payload = {
    id_partita: partitaCorrenteId,
    modulo: moduloAttivo,
    titolari: formazioneTitolari,
    riserve: riserveLista,
    updated_at: new Date().toISOString()
  };

  const { error } = await db.from('formazioni_partite').upsert(payload, { onConflict: 'id_partita' });
  
  if (error) {
    console.error("Errore salvataggio formazione:", error);
    if (typeof mostraAlert === 'function') mostraAlert("Errore durante il salvataggio.");
  } else {
    triggerHaptic([30, 50, 30]);
    if (typeof mostraAlert === 'function') mostraAlert("Formazione salvata con successo! Ora tutti vedranno queste modifiche.");
  }
};

window.apriSezioneFormazione = function() {
  if (typeof chiudiMenuUtente === 'function') chiudiMenuUtente();
  if (typeof switchTab === 'function') {
    ['partite', 'classifica', 'sondaggi', 'messaggi'].forEach(t => {
      document.getElementById(`view-${t}`)?.classList.add('hidden');
    });
    document.getElementById('view-formazione')?.classList.remove('hidden');
  }

  const adminControls = document.getElementById('admin-formazione-controls');
  if (adminControls && typeof isAdmin !== 'undefined' && isAdmin) {
    adminControls.classList.remove('hidden');
  }

  caricaDatiFormazione();
};

window.cambiaModulo = function(modulo) {
  moduloAttivo = modulo;
  const display = document.getElementById('display-modulo-corrente');
  if (display) display.innerText = modulo;
  document.getElementById('menu-fasi-modulo')?.classList.add('hidden');
  renderCampoFormazione();
};

window.toggleMenuRiserve = function() {
  menuRiserveAperto = !menuRiserveAperto;
  const menu = document.getElementById('menu-riserve');
  const iconBtn = document.getElementById('icon-btn-riserve');

  if (menu) {
    if (menuRiserveAperto) {
      menu.classList.remove('translate-x-full');
      if (iconBtn) iconBtn.classList.add('rotate-180');
    } else {
      menu.classList.add('translate-x-full');
      if (iconBtn) iconBtn.classList.remove('rotate-180');
    }
  }
};

window.toggleModalitaSpostamento = function() {
  spostamentoAbilitato = !spostamentoAbilitato;
  triggerHaptic(30);

  const iconEl = document.getElementById('icon-lock-spostamento');
  const textEl = document.getElementById('text-lock-spostamento');
  const btn = document.getElementById('btn-toggle-spostamento');

  if (spostamentoAbilitato) {
    if (textEl) textEl.innerText = 'Spostamento Attivo';
    if (btn) btn.className = 'px-3.5 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-md flex items-center gap-2 transition-all transform scale-105';
    if (iconEl) iconEl.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>';
  } else {
    if (textEl) textEl.innerText = 'Blocca Spostamento';
    if (btn) btn.className = 'px-3.5 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs shadow-md flex items-center gap-2 transition-all';
    if (iconEl) iconEl.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>';
  }
};

// Modifica a caricaDatiFormazione per leggere prima la tabella formati_partite
async function caricaDatiFormazione() {
  const adesso = new Date().toISOString();

  let { data: partiteFuture } = await db.from('partite')
    .select('*')
    .gte('data_ora', adesso)
    .order('data_ora', { ascending: true })
    .limit(1);

  let partitaCorrente = partiteFuture && partiteFuture.length > 0 ? partiteFuture[0] : null;

  if (!partitaCorrente) {
    const { data: tuttePartite } = await db.from('partite')
      .select('*')
      .order('data_ora', { ascending: false })
      .limit(1);
    if (tuttePartite && tuttePartite.length > 0) {
      partitaCorrente = tuttePartite[0];
    }
  }

  if (!partitaCorrente) return;
  partitaCorrenteId = partitaCorrente.id;

  // 1. Controlla se esiste una formazione già salvata su Supabase
  const { data: formazioneSalvata } = await db.from('formazioni_partite')
    .select('*')
    .eq('id_partita', partitaCorrenteId)
    .single();

  if (formazioneSalvata) {
    moduloAttivo = formazioneSalvata.modulo || '2-3-1';
    formazioneTitolari = formazioneSalvata.titolari || {};
    riserveLista = formazioneSalvata.riserve || [];
    
    const display = document.getElementById('display-modulo-corrente');
    if (display) display.innerText = moduloAttivo;
    
    renderCampoFormazione();
    return;
  }

  // 2. Fallback: genera dai convocati "Presenti" se non è ancora stata salvata una formazione
  const { data: presenze } = await db.from('presenze')
    .select('*')
    .eq('id_partita', partitaCorrente.id)
    .eq('stato', 'Presente');

  let convocatiNomi = (presenze || []).map(p => p.nome_utente);

  let listaGiocatori = convocatiNomi.map(nome => {
    const anagrafica = (typeof GIOCATORI_MOCK !== 'undefined' ? GIOCATORI_MOCK : []);
    const g = anagrafica.find(item => 
      (item.nome_completo || item.nome)?.toLowerCase().trim() === nome.toLowerCase().trim()
    );
    return {
      nome,
      numero: g?.numero_maglia || Math.floor(Math.random() * 90) + 2,
      ruolo: g?.posizione || 'Giocatore'
    };
  });

  let portiereObj = listaGiocatori.find(j => j.ruolo.toLowerCase().includes('portiere') || j.numero === 1);
  if (!portiereObj && listaGiocatori.length > 0) {
    portiereObj = listaGiocatori[0];
    portiereObj.ruolo = 'Portiere';
    portiereObj.numero = 1;
  }

  let outfield = listaGiocatori.filter(j => j !== portiereObj);

  formazioneTitolari = {};
  if (portiereObj) {
    formazioneTitolari[0] = { ...portiereObj, isPortiere: true };
  }

  for (let i = 0; i < 6 && i < outfield.length; i++) {
    formazioneTitolari[i + 1] = outfield[i];
  }

  riserveLista = outfield.slice(6);
  renderCampoFormazione();
}

function generaIconaMaglia(numero, isPortiere = false) {
  const fillColor = isPortiere ? '#0f172a' : '#5e2038';
  return `
    <div class="relative w-11 h-11 flex items-center justify-center filter drop-shadow-md transition-transform duration-200">
      <svg class="w-full h-full" viewBox="0 -7.72 127.24603 127.24603" xmlns="http://www.w3.org/2000/svg">
        <!-- Sfondo colorato della maglia (riempie i tracciati interni dell'icona 2) -->
        <path fill="${fillColor}" d="m32 109c-1.4 0-2.5-1.1-2.5-2.5v-62.6l-7 5.9c-.1.1-.2.1-.2.2-1 .6-2.1 1-3.2 1-2 0-3.8-1-4.9-2.6l-10.7-16.1c-1.8-2.7-1-6.3 1.7-8.1l29.7-20.7c.2-.1.4-.3.7-.3.1 0 2.8-.9 6.6-1h3.1c.7 0 1.4.3 1.8.8.5.5.7 1.2.6 1.9 0 .1 0 .3-.1.4.2 7.5 8.1 14.5 16.5 14.5s16.3-7 16.5-14.5c0-.1 0-.3-.1-.4-.1-.7.2-1.4.6-1.9s1.1-.8 1.8-.8h6.1c2.4 0 4.3 1.1 4.5 1.2.1 0 .1.1.2.1l28.7 20.7c2.6 1.7 3.4 5.4 1.6 8.1l-10.7 15.2c-1 1.6-2.9 2.6-4.9 2.6-1.2 0-2.3-.3-3.2-1-.1 0-.1-.1-0.2-.2l-6.4-5.3-.2 62.9c0 1.4-1.1 2.5-2.5 2.5h-63.9z"></path>
        <!-- Bordo esterno e contorno nero dell'icona 2 -->
        <path fill="#000000" d="m89.1 5c1.8 0 3.1.9 3.1.9l28.7 20.6c1.6 1 2 3.1.9 4.7l-10.7 15.1c-0.6 1-1.7 1.5-2.8 1.5-.6 0-1.3-.2-1.9-.6l-10.5-8.6-.2 68.2h-63.7v-68l-11.2 9.4c-.6.4-1.2.6-1.9.6-1.1 0-2.2-.5-2.8-1.5l-10.6-16.1c-1-1.6-.6-3.6.9-4.7l29.7-20.7s2.4-.8 5.8-.9h3.1v.2.2c0 9 9.1 17.3 19 17.3s19-8.3 19-17.3v-.2-.2h5.9.2c-.1.1 0 .1 0 .1m0-5s-.1 0 0 0h-.2-5.9c-1.4 0-2.7.6-3.7 1.6-.9 1-1.4 2.4-1.3 3.8v.4c-.3 6.1-7.1 11.9-14 11.9s-13.7-5.8-14-11.9v-.4c.1-1.4-.3-2.8-1.3-3.8-.9-1-2.3-1.6-3.7-1.6h-3.1-.1c-4 .1-6.9 1-7.3 1.1-.5.2-.9.4-1.3.7l-29.5 20.6c-3.8 2.6-4.8 7.7-2.3 11.6l10.7 16.1c1.6 2.3 4.2 3.7 7 3.7 1.6 0 3.2-.5 4.6-1.4.2-.1.3-.2.5-.3l2.9-2.5v57.2c0 2.8 2.2 5 5 5h63.8c2.8 0 5-2.2 5-5l.1-57.7 2.3 1.9c.1.1.3.2.4.3 1.4.9 3 1.4 4.6 1.4 2.8 0 5.4-1.4 6.9-3.7l10.6-15 .1-.1c2.5-3.8 1.5-9-2.3-11.5l-28-20.9c-.1-.1-.2-.1-.3-.2-.3-.2-2.6-1.5-5.6-1.5z"></path>
      </svg>
      <span class="absolute inset-0 flex items-center justify-center font-black text-xs pt-1 text-white">${numero}</span>
    </div>
  `;
}

function renderCampoFormazione() {
  const container = document.getElementById('titolari-container');
  const riserveContainer = document.getElementById('riserve-lista-container');
  const labelTitoloRiserve = document.getElementById('label-titolo-riserve');

  if (!container || !riserveContainer) return;
  initDragFormazione();
  initTattileIOS();

  if (labelTitoloRiserve) {
    labelTitoloRiserve.innerText = `Riserve (${riserveLista.length})`;
  }

  const posizioni = COORDINATE_MODULI[moduloAttivo] || COORDINATE_MODULI['2-3-1'];

  container.innerHTML = posizioni.map(pos => {
    const giocatore = formazioneTitolari[pos.id] || { nome: 'Vuoto', numero: '--', isPortiere: pos.isPortiere };
    const isSelected = giocatoreSelezionato && giocatoreSelezionato.id === pos.id ? 'scale-110 z-30' : '';

    return `
        <div class="pedina-formazione absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer transition-all duration-300 transform ${isSelected}"
            data-id="${pos.id}" data-tipo="titolare" data-numero="${giocatore.numero}" data-nome="${String(giocatore.nome).replace(/"/g, '&quot;')}" data-portiere="${pos.isPortiere ? 1 : 0}"
            onclick="clickPedina(${pos.id}, 'titolare')"
            style="top: ${pos.top}; left: ${pos.left};">
            ${HAPTIC_SW_HTML}
            <div class="${giocatoreSelezionato && giocatoreSelezionato.id === pos.id ? 'ring-4 ring-amber-400 rounded-xl animate-pulse' : ''}">
            ${generaIconaMaglia(giocatore.numero, pos.isPortiere)}
            </div>
            <span class="mt-1 bg-slate-900/85 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap shadow-sm border border-white/10">${giocatore.nome}</span>
        </div>
    `;
  }).join('');

  if (riserveLista.length === 0) {
    riserveContainer.innerHTML = `<div class="text-[11px] text-slate-400 text-center py-4 italic">Nessun giocatore in panchina</div>`;
  } else {
    riserveContainer.innerHTML = riserveLista.map((ris, index) => {
      const isSelected = giocatoreSelezionato && giocatoreSelezionato.indexRiserva === index ? 'ring-2 ring-amber-400 bg-amber-50' : 'bg-slate-50';
      return `
        <div class="pedina-formazione relative flex flex-col items-center p-2.5 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-all duration-300 transform ${isSelected}"
            data-id="${index}" data-tipo="riserva" data-numero="${ris.numero}" data-nome="${String(ris.nome).replace(/"/g, '&quot;')}" data-portiere="0"
            onclick="clickPedina(${index}, 'riserva')">
            ${HAPTIC_SW_HTML}
            <div class="w-9 h-9 flex items-center justify-center">
            ${generaIconaMaglia(ris.numero, false)}
            </div>
            <span class="text-xs font-bold text-slate-800 text-center mt-1 truncate w-full">${ris.nome}</span>
        </div>
     `;
    }).join('');
  }
}

// --- TRASCINAMENTO CON POINTER EVENTS (stesso codice per iPhone, Android e sito) ---
// Non usiamo il drag & drop HTML5: su iOS mostra la sua anteprima di sistema (rettangolo scuro + "+")
// e non si può personalizzare. Qui il giocatore "sollevato" è un nostro elemento che segue il dito.
const LONG_PRESS_MS = 350;      // tocco: tieni premuto 350ms per sollevare il giocatore
const MOVE_TOLERANCE = 10;      // px: se il dito si muove prima, non è un tocco lungo
const MOUSE_DRAG_START = 4;     // px: sito, con "Spostamento attivo" il drag parte dopo questo movimento

let ghostElement = null;
let dragState = null;
let dragTarget = null;
let bloccaClickFinoA = 0;
let ultimoTargetId = null;

function initDragFormazione() {
  const campo = document.getElementById('campo-da-calcio');
  if (!campo || campo.dataset.dragInit) return;
  campo.dataset.dragInit = '1';
  campo.addEventListener('pointerdown', onPedinaDown);
  campo.addEventListener('contextmenu', (e) => { if (e.target.closest('.pedina-formazione')) e.preventDefault(); });
}

function creaGhostIcona(dati, clientX, clientY) {
  rimuoviGhostIcona();
  ghostElement = document.createElement('div');
  ghostElement.className = 'pedina-ghost';
  ghostElement.innerHTML = generaIconaMaglia(dati.numero, dati.portiere);
  const nome = document.createElement('span');
  nome.className = 'pedina-ghost-nome';
  nome.textContent = dati.nome;
  ghostElement.appendChild(nome);
  document.body.appendChild(ghostElement);
  muoviGhostIcona(clientX, clientY);
}

function muoviGhostIcona(clientX, clientY) {
  if (ghostElement) {
    // sopra al dito, così non lo copre
    ghostElement.style.transform = `translate3d(${clientX}px, ${clientY}px, 0) translate(-50%, -115%) scale(1.15)`;
  }
}

function rimuoviGhostIcona() {
  if (ghostElement) {
    ghostElement.remove();
    ghostElement = null;
  }
}

function onPedinaDown(e) {
  const el = e.target.closest('.pedina-formazione');
  if (!el || dragState) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (typeof isAdmin !== 'undefined' && !isAdmin) return;      // i non admin non spostano (il tap mostra l'avviso)

  const touch = e.pointerType !== 'mouse';
  if (!touch && !spostamentoAbilitato) return;                  // sito: serve "Spostamento attivo"

  dragState = {
    el, touch, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, attivo: false, timer: null,
    id: parseInt(el.dataset.id, 10), tipo: el.dataset.tipo,
    dati: { numero: el.dataset.numero, nome: el.dataset.nome, portiere: el.dataset.portiere === '1' }
  };

  window.addEventListener('pointermove', onPedinaMove, { passive: false });
  window.addEventListener('pointerup', onPedinaUp);
  window.addEventListener('pointercancel', onPedinaCancel);

  if (touch) {
    dragState.timer = setTimeout(attivaDrag, LONG_PRESS_MS);
  }
}

function attivaDrag() {
  if (!dragState || dragState.attivo) return;
  dragState.attivo = true;
  clearTimeout(dragState.timer);
  dragState.el.classList.add('pedina-sollevata');
  creaGhostIcona(dragState.dati, dragState.x ?? dragState.x0, dragState.y ?? dragState.y0);
  triggerHaptic(35);                                            // "sollevato"
}

function onPedinaMove(e) {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  dragState.x = e.clientX; dragState.y = e.clientY;
  const dist = Math.hypot(e.clientX - dragState.x0, e.clientY - dragState.y0);

  if (!dragState.attivo) {
    if (dragState.touch && dist > MOVE_TOLERANCE) return fineDrag();     // non era un tocco lungo
    if (!dragState.touch && dist > MOUSE_DRAG_START) attivaDrag();
    if (!dragState.attivo) return;
  }

  e.preventDefault();
  muoviGhostIcona(e.clientX, e.clientY);

  const sotto = document.elementFromPoint(e.clientX, e.clientY)?.closest('.pedina-formazione') || null;
  const bersaglio = (sotto && sotto !== dragState.el) ? sotto : null;
  if (bersaglio !== dragTarget) {
    dragTarget?.classList.remove('pedina-target');
    dragTarget = bersaglio;
    if (dragTarget) {
      dragTarget.classList.add('pedina-target');
      triggerHaptic(15);                                        // passaggio sopra un altro giocatore
    }
  }
}

function onPedinaUp(e) {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  const { attivo, id, tipo } = dragState;
  const bersaglio = dragTarget;
  fineDrag();
  if (!attivo) return;                                          // era un tap: ci pensa onclick

  bloccaClickFinoA = Date.now() + 400;                          // niente "click" fantasma dopo il rilascio
  if (bersaglio) {
    giocatoreSelezionato = tipo === 'titolare' ? { id, tipo } : { indexRiserva: id, tipo };
    ultimoTargetId = null;
    gestisciClickGiocatore(parseInt(bersaglio.dataset.id, 10), bersaglio.dataset.tipo);   // scambia + vibrazione + render
  } else {
    triggerHaptic(15);
  }
}

function onPedinaCancel(e) {
  if (dragState && e.pointerId === dragState.pointerId) fineDrag();
}

function fineDrag() {
  if (!dragState) return;
  clearTimeout(dragState.timer);
  dragState.el.classList.remove('pedina-sollevata');
  dragTarget?.classList.remove('pedina-target');
  dragTarget = null;
  rimuoviGhostIcona();
  window.removeEventListener('pointermove', onPedinaMove);
  window.removeEventListener('pointerup', onPedinaUp);
  window.removeEventListener('pointercancel', onPedinaCancel);
  dragState = null;
}

// Tap su un giocatore (selezione + secondo tap per scambiare): ignorato subito dopo un trascinamento
window.clickPedina = function(id, tipo) {
  if (Date.now() < bloccaClickFinoA) return;
  gestisciClickGiocatore(id, tipo);
};

// Gestione interazione al click / tocco sui giocatori in campo e panchina
window.gestisciClickGiocatore = function(id, tipo) {
  if (typeof isAdmin !== 'undefined' && !isAdmin) {
    return mostraAlert("Solo l'amministratore può modificare la formazione in campo.");
  }

  if (!spostamentoAbilitato) {
    spostamentoAbilitato = true;
    triggerHaptic(30);
    const btn = document.getElementById('btn-toggle-spostamento');
    const textEl = document.getElementById('text-lock-spostamento');
    const iconEl = document.getElementById('icon-lock-spostamento');
    if (textEl) textEl.innerText = 'Spostamento Attivo';
    if (btn) btn.className = 'px-3.5 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-md flex items-center gap-2 transition-all transform scale-105';
    if (iconEl) iconEl.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>';
  }

  if (!giocatoreSelezionato) {
    giocatoreSelezionato = tipo === 'titolare' ? { id, tipo } : { indexRiserva: id, tipo };
    triggerHaptic(35); // 1. Vibrazione iniziale al tenere premuto / selezionare il giocatore
    renderCampoFormazione();
  } else {
    // 3. Vibrazione di rilascio / interscambio completato tra i due giocatori
    triggerHaptic([40, 60, 40]);

    if (giocatoreSelezionato.tipo === 'titolare' && tipo === 'titolare') {
      const temp = formazioneTitolari[giocatoreSelezionato.id];
      formazioneTitolari[giocatoreSelezionato.id] = formazioneTitolari[id];
      formazioneTitolari[id] = temp;
    } else if (giocatoreSelezionato.tipo === 'titolare' && tipo === 'riserva') {
      const tempTitolare = formazioneTitolari[giocatoreSelezionato.id];
      formazioneTitolari[giocatoreSelezionato.id] = riserveLista[id];
      riserveLista[id] = tempTitolare;
    } else if (giocatoreSelezionato.tipo === 'riserva' && tipo === 'titolare') {
      const tempRiserva = riserveLista[giocatoreSelezionato.indexRiserva];
      riserveLista[giocatoreSelezionato.indexRiserva] = formazioneTitolari[id];
      formazioneTitolari[id] = tempRiserva;
    } else if (giocatoreSelezionato.tipo === 'riserva' && tipo === 'riserva') {
      const temp = riserveLista[giocatoreSelezionato.indexRiserva];
      riserveLista[giocatoreSelezionato.indexRiserva] = riserveLista[id];
      riserveLista[id] = temp;
    }

    giocatoreSelezionato = null;
    ultimoTargetId = null;
    rimuoviGhostIcona();
    renderCampoFormazione();
  }
};