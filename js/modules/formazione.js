// js/modules/formazione.js

let moduloAttivo = '2-3-1';
let formazioneTitolari = {}; // Mappa posizioneIndex -> Giocatore
let riserveLista = [];
let menuRiserveAperto = false;
let spostamentoAbilitato = false;
let giocatoreSelezionato = null; // Per il tap-to-swap con animazione

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
      // Quando il menu è aperto, la freccia punta fuori dal campo (0deg)
      if (iconBtn) iconBtn.classList.remove('rotate-180');
    } else {
      menu.classList.add('translate-x-full');
      // Quando il menu è chiuso, la freccia punta verso il campo (180deg)
      if (iconBtn) iconBtn.classList.add('rotate-180');
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
  // Prendi la partita più recente o attiva dal database
  const { data: partite } = await db.from('partite').select('*').order('data_ora', { ascending: true });
  if (!partite || partite.length === 0) return;

  const partitaCorrente = partite[0];
  
  // Richiedi ESCLUSIVAMENTE i giocatori che hanno votato "Presente" nel sondaggio della partita
  const { data: presenze } = await db.from('presenze').select('*').eq('id_partita', partitaCorrente.id).eq('stato', 'Presente');

  let convocatiNomi = (presenze || []).map(p => p.nome_utente);

  // Mappa con i dati completi dei giocatori (numero maglia, ruolo, ecc.) presi dai mock/anagrafica
  let listaGiocatori = convocatiNomi.map(nome => {
    const g = (typeof GIOCATORI_MOCK !== 'undefined' ? GIOCATORI_MOCK : []).find(item => 
      (item.nome_completo || item.nome)?.toLowerCase() === nome.toLowerCase()
    );
    return {
      nome,
      numero: g?.numero_maglia || Math.floor(Math.random() * 90) + 2,
      ruolo: g?.posizione || 'Giocatore'
    };
  });

  // Trova il portiere tra i convocati "Presente"
  let portiereObj = listaGiocatori.find(j => j.ruolo.toLowerCase().includes('portiere') || j.numero === 1);
  if (!portiereObj && listaGiocatori.length > 0) {
    portiereObj = listaGiocatori[0];
    portiereObj.ruolo = 'Portiere';
    portiereObj.numero = 1;
  }

  // Rimuovi il portiere dai movimenti di campo
  let outfield = listaGiocatori.filter(j => j !== portiereObj);

  formazioneTitolari = {};
  if (portiereObj) {
    formazioneTitolari[0] = { ...portiereObj, isPortiere: true };
  }

  // Primi 6 titolari di movimento
  for (let i = 0; i < 6 && i < outfield.length; i++) {
    formazioneTitolari[i + 1] = outfield[i];
  }

  // Restanti in riserva
  riserveLista = outfield.slice(6);
  renderCampoFormazione();
}

// Funzione helper per generare l'icona SVG della maglietta con numero (Migliorata e dettagliata)
function generaIconaMaglia(numero, isPortiere = false) {
  const fillColor = isPortiere ? '#0f172a' : '#5e2038'; // Portiere scuro, Giocatori bordeaux
  const textColor = '#ffffff';

  return `
    <div class="relative w-11 h-11 flex items-center justify-center filter drop-shadow-md transition-transform duration-200">
      <svg class="w-full h-full" viewBox="0 0 100 100" fill="${fillColor}" stroke="#ffffff" stroke-width="3.5">
        <path d="M32 15 L45 23 L55 23 L68 15 L85 28 L72 42 L72 85 L28 85 L28 42 L15 28 Z" stroke-linejoin="round"/>
      </svg>
      <span class="absolute inset-0 flex items-center justify-center font-black text-xs pt-1.5" style="color: ${textColor};">${numero}</span>
    </div>
  `;
}

function renderCampoFormazione() {
  const container = document.getElementById('titolari-container');
  const riserveContainer = document.getElementById('riserve-lista-container');
  const labelTitoloRiserve = document.getElementById('label-titolo-riserve');

  if (!container || !riserveContainer) return;

  // Aggiorna il numero esatto delle riserve nel titolo del cassetto
  if (labelTitoloRiserve) {
    labelTitoloRiserve.innerText = `Riserve (${riserveLista.length})`;
  }

  const posizioni = COORDINATE_MODULI[moduloAttivo] || COORDINATE_MODULI['2-3-1'];

  // Render Titolari in Campo con Nome Sotto al fermaposto
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

  // Render Riserve nel Cassetto Laterale (Nome sotto o a fianco dell'icona maglia)
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
    // Primo click: seleziona
    giocatoreSelezionato = tipo === 'titolare' ? { id, tipo } : { indexRiserva: id, tipo };
    renderCampoFormazione();
  } else {
    // Secondo click: esegui lo scambio (Swap) tra titolari e/o riserve
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