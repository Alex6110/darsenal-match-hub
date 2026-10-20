// js/modules/formazione.js

let moduloAttivo = '2-3-1';
let formazioneTitolari = {}; // Mappa posizioneIndex -> Giocatore
let riserveLista = [];
let menuRiserveAperto = false;
let spostamentoAbilitato = false;
let giocatoreSelezionato = null; // Per il tap-to-swap su mobile/PWA

const COORDINATE_MODULI = {
  '2-3-1': [
    { id: 0, ruolo: 'Portiere', top: '86%', left: '50%', isPortiere: true },
    { id: 1, ruolo: 'Difensore', top: '65%', left: '30%' },
    { id: 2, ruolo: 'Difensore', top: '65%', left: '70%' },
    { id: 3, ruolo: 'Esterno', top: '40%', left: '20%' },
    { id: 4, ruolo: 'Centrocampista', top: '38%', left: '50%' },
    { id: 5, ruolo: 'Esterno', top: '40%', left: '80%' },
    { id: 6, ruolo: 'Attaccante', top: '16%', left: '50%' }
  ],
  '3-2-1': [
    { id: 0, ruolo: 'Portiere', top: '86%', left: '50%', isPortiere: true },
    { id: 1, ruolo: 'Difensore', top: '65%', left: '20%' },
    { id: 2, ruolo: 'Difensore', top: '65%', left: '50%' },
    { id: 3, ruolo: 'Difensore', top: '65%', left: '80%' },
    { id: 4, ruolo: 'Centrocampista', top: '38%', left: '35%' },
    { id: 5, ruolo: 'Centrocampista', top: '38%', left: '65%' },
    { id: 6, ruolo: 'Attaccante', top: '16%', left: '50%' }
  ],
  '3-1-2': [
    { id: 0, ruolo: 'Portiere', top: '86%', left: '50%', isPortiere: true },
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
    // Nascondi tutte le altre viste
    ['partite', 'classifica', 'sondaggi', 'messaggi'].forEach(t => {
      document.getElementById(`view-${t}`)?.classList.add('hidden');
    });
    document.getElementById('view-formazione')?.classList.remove('hidden');
  }

  // Gestione visibilità controlli admin
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
  if (menu) {
    if (menuRiserveAperto) menu.classList.remove('translate-x-full');
    else menu.classList.add('translate-x-full');
  }
};

window.toggleModalitaSpostamento = function() {
  spostamentoAbilitato = !spostamentoAbilitato;
  const btn = document.getElementById('btn-toggle-spostamento');
  if (btn) {
    btn.innerText = spostamentoAbilitato ? '🔓 Spostamento Attivo' : '🔒 Blocca Spostamento';
    btn.className = spostamentoAbilitato ? 'px-3 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-md' : 'px-3 py-2 bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md';
  }
};

async function caricaDatiFormazione() {
  // Prendi i convocati dal sondaggio/partita attiva più recente
  const { data: partite } = await db.from('partite').select('*').order('data_ora', { ascending: true });
  if (!partite || partite.length === 0) return;

  const partitaCorrente = partite[0];
  const { data: presenze } = await db.from('presenze').select('*').eq('id_partita', partitaCorrente.id).eq('stato', 'Presente');

  let convocatiNomi = (presenze || []).map(p => p.nome_utente);
  
  // Se non ci sono voti nel sondaggio, usa la lista mock/giocatori come fallback
  if (convocatiNomi.length === 0) {
    convocatiNomi = GIOCATORI_MOCK.slice(0, 12).map(g => g.nome_completo);
  }

  // Trova il portiere
  let portiereObj = convocatiNomi.map(nome => {
    const g = GIOCATORI_MOCK.find(item => (item.nome_completo || item.nome)?.toLowerCase() === nome.toLowerCase());
    return { nome, numero: g?.numero_maglia || 1, ruolo: g?.posizione || 'Giocatore' };
  }).find(giocatore => giocatore.ruolo === 'Portiere');

  if (!portiereObj) {
    portiereObj = { nome: convocatiNomi[0], numero: 1, ruolo: 'Portiere' };
  }

  // Rimuovi il portiere dai outfield players
  let outfield = convocatiNomi.filter(n => n !== portiereObj.nome).map(nome => {
    const g = GIOCATORI_MOCK.find(item => (item.nome_completo || item.nome)?.toLowerCase() === nome.toLowerCase());
    return { nome, numero: g?.numero_maglia || Math.floor(Math.random() * 90) + 2, ruolo: g?.posizione || 'Giocatore' };
  });

  // Primi 6 in campo come titolari, i successivi 5 in riserva
  formazioneTitolari = {};
  formazioneTitolari[0] = { nome: portiereObj.nome, numero: portiereObj.numero, isPortiere: true };

  for (let i = 0; i < 6 && i < outfield.length; i++) {
    formazioneTitolari[i + 1] = outfield[i];
  }

  riserveLista = outfield.slice(6);
  renderCampoFormazione();
}

function renderCampoFormazione() {
  const container = document.getElementById('titolari-container');
  const riserveContainer = document.getElementById('riserve-lista-container');
  if (!container || !riserveContainer) return;

  const posizioni = COORDINATE_MODULI[moduloAttivo] || COORDINATE_MODULI['2-3-1'];

  // Render Titolari in Campo
  container.innerHTML = posizioni.map(pos => {
    const giocatore = formazioneTitolari[pos.id] || { nome: 'Vuoto', numero: '--' };
    const bgColor = pos.isPortiere ? 'bg-black text-white' : 'bg-burgundy text-white';
    const isSelected = giocatoreSelezionato && giocatoreSelezionato.id === pos.id ? 'ring-4 ring-amber-400 scale-110' : '';

    return `
      <div onclick="gestisciClickGiocatore(${pos.id}, 'titolare')" class="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer transition-transform ${isSelected}" style="top: ${pos.top}; left: ${pos.left};">
        <div class="w-10 h-10 rounded-full ${bgColor} border-2 border-white shadow-lg flex items-center justify-center font-black text-xs">
          ${giocatore.numero}
        </div>
        <span class="mt-1 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap shadow-sm">${giocatore.nome.split(' ').pop()}</span>
      </div>
    `;
  }).join('');

  // Render Riserve nel Cassetto Laterale
  if (riserveLista.length === 0) {
    riserveContainer.innerHTML = `<div class="text-[11px] text-slate-400 text-center py-4 italic">Nessuna riserva disponibile</div>`;
  } else {
    riserveContainer.innerHTML = riserveLista.map((ris, index) => {
      const isSelected = giocatoreSelezionato && giocatoreSelezionato.indexRiserva === index ? 'ring-2 ring-amber-400 bg-amber-50' : 'bg-slate-50';
      return `
        <div onclick="gestisciClickGiocatore(${index}, 'riserva')" class="flex items-center gap-2 p-2 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-all ${isSelected}">
          <div class="w-7 h-7 rounded-full bg-burgundy text-white flex items-center justify-center font-black text-[10px] shrink-0">${ris.numero}</div>
          <span class="text-xs font-bold text-slate-800 truncate">${ris.nome}</span>
        </div>
      `;
    }).join('');
  }
}

window.gestisciClickGiocatore = function(id, tipo) {
  if (typeof isAdmin !== 'undefined' && !isAdmin) {
    return mostraAlert("Solo l'amministratore può modificare la formazione in campo.");
  }

  if (!spostamentoAbilitato && typeof isAdmin !== 'undefined' && isAdmin) {
    // Attiva automaticamente lo spostamento al primo click per comodità
    spostamentoAbilitato = true;
    const btn = document.getElementById('btn-toggle-spostamento');
    if (btn) {
      btn.innerText = '🔓 Spostamento Attivo';
      btn.className = 'px-3 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-md';
    }
  }

  if (!giocatoreSelezionato) {
    // Primo click: seleziona il giocatore
    giocatoreSelezionato = { id, tipo };
    renderCampoFormazione();
  } else {
    // Secondo click: esegui lo scambio (Swap)
    if (giocatoreSelezionato.tipo === 'titolare' && tipo === 'titolare') {
      // Non permettere di spostare il portiere fuori dalla porta se non con un altro portiere (opzionale, o scambia liberamente tranne porta)
      const temp = formazioneTitolari[giocatoreSelezionato.id];
      formazioneTitolari[giocatoreSelezionato.id] = formazioneTitolari[id];
      formazioneTitolari[id] = temp;
    } else if (giocatoreSelezionato.tipo === 'titolare' && tipo === 'riserva') {
      // Scambio tra titolare e riserva (tranne se il titolare è il portiere e la riserva non è portiere, oppure permetti il cambio)
      const tempTitolare = formazioneTitolari[giocatoreSelezionato.id];
      formazioneTitolari[giocatoreSelezionato.id] = riserveLista[id];
      riserveLista[id] = tempTitolare;
    } else if (giocatoreSelezionato.tipo === 'riserva' && tipo === 'titolare') {
      const tempRiserva = riserveLista[giocatoreSelezionato.id];
      riserveLista[giocatoreSelezionato.id] = formazioneTitolari[id];
      formazioneTitolari[id] = tempRiserva;
    }

    giocatoreSelezionato = null;
    renderCampoFormazione();
  }
};