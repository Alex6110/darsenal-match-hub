// js/modules/formazione.js

let moduloAttivo = '2-3-1';
let formazioneTitolari = {}; 
let riserveLista = [];
let menuRiserveAperto = false;
let spostamentoAbilitato = false;
let giocatoreSelezionato = null;

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
  if (navigator.vibrate) navigator.vibrate(30);

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

async function caricaDatiFormazione() {
  const adesso = new Date().toISOString();

  // Cerca prioritariamente la prossima partita futura
  let { data: partiteFuture } = await db.from('partite')
    .select('*')
    .gte('data_ora', adesso)
    .order('data_ora', { ascending: true })
    .limit(1);

  let partitaCorrente = partiteFuture && partiteFuture.length > 0 ? partiteFuture[0] : null;

  // Se non ci sono partite future, prendi l'ultima passata
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
  
  // Carica i giocatori che hanno votato "Presente" per questa specifica partita
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

  if (labelTitoloRiserve) {
    labelTitoloRiserve.innerText = `Riserve (${riserveLista.length})`;
  }

  const posizioni = COORDINATE_MODULI[moduloAttivo] || COORDINATE_MODULI['2-3-1'];

  container.innerHTML = posizioni.map(pos => {
    const giocatore = formazioneTitolari[pos.id] || { nome: 'Vuoto', numero: '--', isPortiere: pos.isPortiere };
    const isSelected = giocatoreSelezionato && giocatoreSelezionato.id === pos.id ? 'scale-110 z-30' : '';

    return `
      <div onclick="gestisciClickGiocatore(${pos.id}, 'titolare')" class="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer transition-all duration-300 ${isSelected}" style="top: ${pos.top}; left: ${pos.left};">
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
        <div onclick="gestisciClickGiocatore(${index}, 'riserva')" class="flex flex-col items-center p-2.5 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-all ${isSelected}">
          <div class="w-9 h-9 flex items-center justify-center">
            ${generaIconaMaglia(ris.numero, false)}
          </div>
          <span class="text-xs font-bold text-slate-800 text-center mt-1 truncate w-full">${ris.nome}</span>
        </div>
      `;
    }).join('');
  }
}

window.gestisciClickGiocatore = function(id, tipo) {
  if (typeof isAdmin !== 'undefined' && !isAdmin) {
    return mostraAlert("Solo l'amministratore può modificare la formazione in campo.");
  }

  if (!spostamentoAbilitato) {
    spostamentoAbilitato = true;
    if (navigator.vibrate) navigator.vibrate(30);
    const btn = document.getElementById('btn-toggle-spostamento');
    const textEl = document.getElementById('text-lock-spostamento');
    const iconEl = document.getElementById('icon-lock-spostamento');
    if (textEl) textEl.innerText = 'Spostamento Attivo';
    if (btn) btn.className = 'px-3.5 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-md flex items-center gap-2 transition-all transform scale-105';
    if (iconEl) iconEl.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>';
  }

  if (navigator.vibrate) navigator.vibrate(40);

  if (!giocatoreSelezionato) {
    giocatoreSelezionato = tipo === 'titolare' ? { id, tipo } : { indexRiserva: id, tipo };
    renderCampoFormazione();
  } else {
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
    renderCampoFormazione();
  }
};