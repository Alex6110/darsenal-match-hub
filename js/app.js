let currentUser = null;
let isAdmin = false;

// Gestione della barra di navigazione inferiore
function switchTab(tabName) {
  if (tabName === 'sondaggi' && !currentUser) {
    document.getElementById('login-modal').classList.remove('hidden');
    return;
  }

  ['partite', 'classifica', 'sondaggi'].forEach(t => {
    document.getElementById(`view-${t}`).classList.add('hidden');
    const navBtn = document.getElementById(`nav-${t}`);
    navBtn.classList.remove('text-burgundy');
    navBtn.classList.add('text-slate-400');
  });

  document.getElementById(`view-${tabName}`).classList.remove('hidden');
  const activeBtn = document.getElementById(`nav-${tabName}`);
  activeBtn.classList.add('text-burgundy');
  activeBtn.classList.remove('text-slate-400');

  if (tabName === 'partite') caricaPartite();
  if (tabName === 'classifica') caricaClassifica();
  if (tabName === 'sondaggi') caricaSondaggi();
}

// Mostra/Nascondi password per Admin
document.getElementById('input-nome-utente').addEventListener('input', (e) => {
  const val = e.target.value.trim().toLowerCase();
  const pwdContainer = document.getElementById('pwd-container');
  if (val === 'alessandro branca' || val === 'branca alessandro') {
    pwdContainer.classList.remove('hidden');
  } else {
    pwdContainer.classList.add('hidden');
  }
});

// Esecuzione Login
function confermaLogin() {
  const nomeInput = document.getElementById('input-nome-utente').value.trim();
  const pwdInput = document.getElementById('input-pwd-admin').value;

  if (!nomeInput) return alert("Inserisci il tuo nome.");

  // Funzione per ignorare maiuscole e ordine nome/cognome
  const normalizzaNomeInput = (nome) => nome.toLowerCase().trim().split(/\s+/).sort().join(' ');
  const inputNorm = normalizzaNomeInput(nomeInput);

  // Cerca la corrispondenza nel database
  let nomeUfficiale = null; 
  let giocatoreTrovato = false;

  if (typeof GIOCATORI_MOCK !== 'undefined') {
    const match = GIOCATORI_MOCK.find(g => normalizzaNomeInput(g.nome_completo) === inputNorm);
    if (match) {
      nomeUfficiale = match.nome_completo; // Usa il nome esatto del database
      giocatoreTrovato = true;
    }
  }

  if (inputNorm === 'alessandro branca') {
    if (pwdInput === 'AlessandroDelPiero') {
      isAdmin = true;
      currentUser = nomeUfficiale || 'Branca Alessandro'; 
      document.getElementById('admin-distinta-btn').classList.remove('hidden');
      document.getElementById('admin-panel').classList.remove('hidden');
      document.getElementById('admin-partita-btn-container').classList.remove('hidden');
      document.getElementById('admin-classifica-btn').classList.remove('hidden');
    } else {
      return alert("Password Admin errata!");
    }
  } else {
    // Se non è admin e non esiste in GIOCATORI_MOCK, blocca l'accesso
    if (!giocatoreTrovato) {
      return alert("Calciatore non appartenente a questa squadra.");
    }
    
    isAdmin = false;
    currentUser = nomeUfficiale;
  }

  document.getElementById('user-badge').innerText = currentUser;
  document.getElementById('user-badge').classList.remove('hidden');
  document.getElementById('login-modal').classList.add('hidden');
  
  switchTab('sondaggi');
}

// -------------------------------------------------------------
// SEZIONE PARTITE & CALENDARIO
// -------------------------------------------------------------
let tabCalendarioAttivo = 'prossimi'; // di default mostra i prossimi impegni

window.setTabCalendario = function(tab) {
  tabCalendarioAttivo = tab;
  caricaPartite();
};

async function caricaPartite() {
  const prossimoContainer = document.getElementById('prossimo-incontro-container');
  const listeContainer = document.getElementById('partite-precedenti-container');

  const { data: calendario, error } = await db
    .from('calendario_torneo')
    .select('*')
    .order('data_ora', { ascending: true });

  if (error) {
    console.error("Errore caricamento calendario:", error);
    prossimoContainer.innerHTML = `<div class="text-xs text-rose-500 py-2">Errore nel caricamento.</div>`;
    return;
  }

  if (!calendario || calendario.length === 0) {
    prossimoContainer.innerHTML = `<div class="text-xs text-slate-400 py-4 text-center">Nessuna partita in calendario.</div>`;
    listeContainer.innerHTML = '';
    return;
  }

  const adesso = new Date();
  
  // LOGICA: Le prossime sono future O non completate (senza risultato). Le passate sono nel passato E completate.
  const prossime = calendario.filter(p => new Date(p.data_ora) >= adesso || !p.completata);
  const passate = calendario.filter(p => new Date(p.data_ora) < adesso && p.completata).reverse();

  // Rendering Prossimo Incontro (La partita imminente)
  if (prossime.length > 0) {
    const p = prossime[0];
    const d = new Date(p.data_ora).toLocaleString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

    // Tasto risultato gigante per la partita in primo piano (se non ha già un risultato ed è l'admin)
    const btnRisultatoHtml = (isAdmin && !p.risultato) ? `<button onclick="apriModalRisultato('${p.id}')" class="mt-3 w-full py-2.5 bg-burgundy/10 text-burgundy font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-burgundy/20 transition-colors">Aggiungi Risultato</button>` : '';

    prossimoContainer.innerHTML = `
      <div class="bg-white p-4 rounded-3xl shadow-md border-l-4 border-burgundy relative">
        ${isAdmin ? `<button onclick="eliminaPartitaTorneo('${p.id}')" class="absolute top-3 right-3 text-xs text-slate-300 hover:text-rose-600 transition-colors"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>` : ''}
        <div class="flex justify-between items-center text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-3 border-b border-slate-100 pb-2">
          <span>${p.giornata || 'PROSSIMO MATCH'}</span>
          <span class="text-burgundy font-extrabold flex items-center gap-1">
            <svg class="w-3.5 h-3.5 inline-block -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> 
            ${d}
          </span>
        </div>
        <div class="flex justify-between items-center py-2">
          <div class="flex flex-col items-center gap-1.5 w-2/5">
            <div class="w-12 h-12 rounded-full bg-burgundy text-white flex items-center justify-center font-black text-base shadow-inner">${p.squadra_casa.substring(0, 2).toUpperCase()}</div>
            <span class="font-bold text-sm text-slate-900 text-center leading-tight">${p.squadra_casa}</span>
          </div>
          <div class="text-center font-black text-slate-200 text-base w-1/5">VS</div>
          <div class="flex flex-col items-center gap-1.5 w-2/5">
            <div class="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-black text-base shadow-inner">${p.squadra_trasferta.substring(0, 2).toUpperCase()}</div>
            <span class="font-bold text-sm text-slate-600 text-center leading-tight">${p.squadra_trasferta}</span>
          </div>
        </div>
        ${btnRisultatoHtml}
      </div>
    `;
  } else {
    prossimoContainer.innerHTML = `<div class="text-xs text-slate-400 py-4 text-center">Nessun match imminente.</div>`;
  }

  // Costruzione Bottoni Toggle List (Iniettato dinamicamente per non toccare struttura HTML)
  const toggleHtml = `
    <div class="flex bg-slate-100/80 p-1.5 rounded-[1rem] mb-4 mt-6 border border-slate-200/60">
      <button onclick="setTabCalendario('giocate')" class="flex-1 py-2 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all ${tabCalendarioAttivo === 'giocate' ? 'bg-white text-burgundy shadow-sm' : 'text-slate-400 hover:text-slate-600'}">Partite Giocate</button>
      <button onclick="setTabCalendario('prossimi')" class="flex-1 py-2 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all ${tabCalendarioAttivo === 'prossimi' ? 'bg-white text-burgundy shadow-sm' : 'text-slate-400 hover:text-slate-600'}">Prossimi Impegni</button>
    </div>
  `;

  let listaHtml = '';
  const restoProssime = prossime.slice(1); // Escludiamo la prima che è in primo piano
  const listaDaMostrare = tabCalendarioAttivo === 'giocate' ? passate : restoProssime;

  if (listaDaMostrare.length === 0) {
    const msg = tabCalendarioAttivo === 'giocate' ? 'Nessuna partita giocata per ora.' : 'Nessun altro impegno futuro in calendario.';
    listaHtml = `<div class="text-xs text-slate-400 py-4 text-center font-medium">${msg}</div>`;
  } else {
    listaHtml = listaDaMostrare.map(p => {
      const d = new Date(p.data_ora).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' });
      const ora = new Date(p.data_ora).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

      // Pulsanti Admin (Risultato o Elimina) per le partite in lista
      const adminButtons = isAdmin ? `
        <div class="absolute top-1 right-1.5 flex gap-1 items-center bg-white/90 px-1 py-0.5 rounded-lg backdrop-blur-sm">
          ${!p.risultato ? `<button onclick="apriModalRisultato('${p.id}')" class="text-[9px] text-emerald-600 font-black uppercase tracking-widest hover:underline mr-1 bg-emerald-50 px-2 py-1 rounded-md">Risultato</button>` : ''}
          <button onclick="eliminaPartitaTorneo('${p.id}')" class="text-xs text-slate-300 hover:text-rose-600 p-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        </div>
      ` : '';

      return `
        <div class="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-100 relative mb-3">
          ${adminButtons}
          <div class="flex justify-between text-[10px] font-bold text-slate-400 mb-2.5">
            <span class="uppercase">${p.giornata || 'PARTITA'}</span><span>${d} - ${ora}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="font-bold text-sm w-2/5 truncate text-slate-800">${p.squadra_casa}</span>
            <div class="bg-slate-50 border border-slate-100 px-3 py-1 rounded-xl font-black text-slate-800 tracking-widest text-xs min-w-[50px] text-center shadow-inner">
              ${p.risultato || 'VS'}
            </div>
            <span class="font-bold text-sm w-2/5 text-right text-slate-600 truncate">${p.squadra_trasferta}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  listeContainer.innerHTML = toggleHtml + listaHtml;
}

// Modal Admin Calendario - Creazione Incontro
async function apriModalPartitaTorneo() {
  document.getElementById('admin-torneo-giornata').value = '';
  document.getElementById('admin-torneo-data').value = '';
  document.getElementById('admin-torneo-ora').value = '';
  document.getElementById('admin-torneo-luogo').value = '';

  // Caricamento Dinamico delle Squadre dalla Classifica
  const { data: classifica, error } = await db.from('classifica').select('squadra').order('squadra');
  let options = '<option value="" disabled selected>Seleziona squadra...</option>';
  if (!error && classifica) {
    options += classifica.map(c => `<option value="${c.squadra}">${c.squadra}</option>`).join('');
  }
  document.getElementById('admin-torneo-casa').innerHTML = options;
  document.getElementById('admin-torneo-trasferta').innerHTML = options;

  document.getElementById('partita-torneo-modal').classList.remove('hidden');
}

function chiudiModalPartitaTorneo() { document.getElementById('partita-torneo-modal').classList.add('hidden'); }

async function salvaPartitaTorneo() {
  const giornata = document.getElementById('admin-torneo-giornata').value.trim();
  const casa = document.getElementById('admin-torneo-casa').value;
  const trasferta = document.getElementById('admin-torneo-trasferta').value;
  const data = document.getElementById('admin-torneo-data').value;
  const ora = document.getElementById('admin-torneo-ora').value;
  const luogo = document.getElementById('admin-torneo-luogo').value.trim() || 'Campo Sportivo';

  if (!casa || !trasferta || !data || !ora) return alert("Compila tutti i campi obbligatori!");

  const dataOraISO = new Date(`${data}T${ora}`).toISOString();

  // Completata = false di base. Il risultato viene inserito dopo.
  const { error } = await db.from('calendario_torneo').insert([{
    giornata, squadra_casa: casa, squadra_trasferta: trasferta, data_ora: dataOraISO, luogo, completata: false
  }]);

  if (error) return alert("Errore nel salvataggio della partita.");

  chiudiModalPartitaTorneo();
  caricaPartite();
}

// GESTIONE INSERIMENTO RISULTATI (Nuovo Modale)
let idPartitaPerRisultato = null;

function apriModalRisultato(id) {
  idPartitaPerRisultato = id;
  document.getElementById('admin-input-risultato').value = '';
  document.getElementById('inserisci-risultato-modal').classList.remove('hidden');
}

function chiudiModalRisultato() {
  document.getElementById('inserisci-risultato-modal').classList.add('hidden');
  idPartitaPerRisultato = null;
}

async function salvaRisultatoTorneo() {
  const risultato = document.getElementById('admin-input-risultato').value.trim();
  if (!risultato) return alert("Inserisci un risultato valido (es. 2-1)");

  const { error } = await db.from('calendario_torneo')
    .update({ risultato: risultato, completata: true })
    .eq('id', idPartitaPerRisultato);

  if (error) {
     console.error(error);
     return alert("Errore nel salvataggio del risultato.");
  }

  chiudiModalRisultato();
  caricaPartite();
}

async function eliminaPartitaTorneo(id) {
  if (!confirm("Vuoi eliminare questa partita definitivamente?")) return;
  await db.from('calendario_torneo').delete().eq('id', id);
  caricaPartite();
}

// -------------------------------------------------------------
// SEZIONE CLASSIFICA
// -------------------------------------------------------------
let squadraInModifica = null; // Variabile per tenere traccia della squadra che stiamo modificando

async function caricaClassifica() {
  const tbody = document.getElementById('classifica-tbody');

  // Recuperiamo tutte le squadre senza ordinarle dal database, lo facciamo in JS
  const { data: classifica, error } = await db.from('classifica').select('*');

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-xs text-rose-500 py-4">Errore caricamento classifica.</td></tr>`;
    return;
  }

  if (!classifica || classifica.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-xs text-slate-400 py-4">Classifica vuota.</td></tr>`;
    return;
  }

  // ORDINAMENTO AUTOMATICO: 1° Punti, 2° Differenza Reti, 3° Alfabetico
  classifica.sort((a, b) => {
    if (b.punti !== a.punti) return b.punti - a.punti; // Ordine per punti
    if (b.differenza_reti !== a.differenza_reti) return b.differenza_reti - a.differenza_reti; // Parità di punti: Differenza reti
    return a.squadra.localeCompare(b.squadra); // Parità di dr: Ordine alfabetico
  });

  tbody.innerHTML = classifica.map((item, index) => {
    const isDarsenal = item.squadra.toLowerCase().includes('darsenal');
    const rowClass = isDarsenal ? 'bg-burgundy-soft/50 font-bold' : '';
    const textBurgundy = isDarsenal ? 'text-burgundy' : 'text-slate-700';

    // Aggiungiamo anche il tasto modifica (matita) accanto al cestino per l'admin
    const adminButtons = isAdmin ? `
      <div class="flex gap-2">
        <button onclick="apriModalModificaSquadra('${item.id}', '${item.squadra}', ${item.punti}, ${item.differenza_reti}, ${item.giocate})" class="text-xs text-slate-300 hover:text-emerald-500">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
        </button>
        <button onclick="eliminaSquadraClassifica('${item.id}')" class="text-xs text-slate-300 hover:text-rose-600">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
    ` : '';

    return `
      <tr class="${rowClass}">
        <!-- La posizione è generata in automatico dall'indice dell'array (index + 1) -->
        <td class="p-3 text-center ${textBurgundy}">${index + 1}</td>
        <td class="p-3 flex items-center justify-between gap-2">
          <span class="flex items-center gap-2">
            ${isDarsenal ? '<span class="w-2 h-2 rounded-full bg-burgundy"></span>' : ''}
            ${item.squadra}
          </span>
          ${adminButtons}
        </td>
        <td class="p-3 text-center text-slate-600">${item.giocate}</td>
        <td class="p-3 text-center ${item.differenza_reti >= 0 ? 'text-emerald-600' : 'text-rose-500'}">${item.differenza_reti > 0 ? '+' : ''}${item.differenza_reti}</td>
        <td class="p-3 text-center font-black ${textBurgundy}">${item.punti}</td>
      </tr>
    `;
  }).join('');
}

// NUOVA FUNZIONE: Somma i punti dalla tendina e aggiunge +1 alle giocate
function aggiungiPunti(valore) {
  if (!valore) return;
  const puntiInput = document.getElementById('admin-classifica-punti');
  const giocateInput = document.getElementById('admin-classifica-giocate');
  
  // Somma algebrica
  puntiInput.value = (parseInt(puntiInput.value) || 0) + parseInt(valore);
  
  // Aumenta di 1 le partite giocate in automatico
  giocateInput.value = (parseInt(giocateInput.value) || 0) + 1; 
}

// Modal Admin Classifica - Apertura per NUOVA squadra
function apriModalGestioneClassifica() { 
  squadraInModifica = null;
  document.getElementById('admin-classifica-squadra').value = '';
  document.getElementById('admin-classifica-squadra').readOnly = false;
  document.getElementById('admin-classifica-punti').value = '0'; 
  document.getElementById('admin-classifica-punti-add').value = ''; // Resetta tendina
  document.getElementById('admin-classifica-dr').value = '0';
  document.getElementById('admin-classifica-giocate').value = '0';
  document.getElementById('classifica-modal').classList.remove('hidden'); 
}

// Modal Admin Classifica - Apertura per MODIFICA squadra esistente
function apriModalModificaSquadra(id, squadra, punti, dr, giocate) {
  squadraInModifica = { id, squadra, punti, dr, giocate };
  document.getElementById('admin-classifica-squadra').value = squadra;
  document.getElementById('admin-classifica-squadra').readOnly = true; // Impedisce di cambiare nome
  document.getElementById('admin-classifica-punti').value = punti || 0; 
  document.getElementById('admin-classifica-punti-add').value = ''; // Resetta tendina
  document.getElementById('admin-classifica-dr').value = dr || 0;
  document.getElementById('admin-classifica-giocate').value = giocate || 0;
  document.getElementById('classifica-modal').classList.remove('hidden');
}

function chiudiModalGestioneClassifica() { 
  document.getElementById('classifica-modal').classList.add('hidden'); 
  squadraInModifica = null;
}

// Funzione di salvataggio (Legge direttamente il campo Punti Totali pulito)
async function salvaSquadraClassifica() {
  const squadra = document.getElementById('admin-classifica-squadra').value.trim();
  const puntiTotali = parseInt(document.getElementById('admin-classifica-punti').value) || 0;
  const giocate = parseInt(document.getElementById('admin-classifica-giocate').value) || 0;
  const dr = parseInt(document.getElementById('admin-classifica-dr').value) || 0;

  if (!squadra) return alert("Inserisci il nome della squadra!");

  const { error } = await db.from('classifica').upsert([{
    squadra, punti: puntiTotali, giocate, differenza_reti: dr
  }], { onConflict: 'squadra' });

  if (error) {
    console.error(error);
    return alert("Errore durante l'aggiornamento della classifica.");
  }

  chiudiModalGestioneClassifica();
  caricaClassifica();
}

async function eliminaSquadraClassifica(id) {
  if (!confirm("Vuoi eliminare questa squadra dalla classifica?")) return;
  await db.from('classifica').delete().eq('id', id);
  caricaClassifica();
}

// -------------------------------------------------------------
// GESTIONE MODALE SONDAGGIO AMICHEVOLE
// -------------------------------------------------------------
function apriModalAmichevole() {
  document.getElementById('amichevole-modal').classList.remove('hidden');
}

function chiudiModalAmichevole() {
  document.getElementById('amichevole-modal').classList.add('hidden');
  document.getElementById('admin-avversario').value = '';
  document.getElementById('admin-data').value = '';
  document.getElementById('admin-ora').value = '';
  document.getElementById('admin-luogo').value = '';
}

async function creaSondaggioAmichevole() {
  const avversario = document.getElementById('admin-avversario').value.trim();
  const data = document.getElementById('admin-data').value;
  const ora = document.getElementById('admin-ora').value;
  const luogo = document.getElementById('admin-luogo').value.trim() || 'Campo Sportivo';

  if (!avversario || !data || !ora) return alert("Compila tutti i campi obbligatori (Squadra, Data e Ora).");

  const dataOraISO = new Date(`${data}T${ora}`).toISOString();

  const { error } = await db.from('partite').insert([{ squadra_avversaria: avversario, data_ora: dataOraISO, luogo }]);

  if (error) return alert("Impossibile salvare la partita. Verificare Supabase.");

  chiudiModalAmichevole();
  caricaSondaggi();
}

async function eliminaSondaggio(idPartita) {
  if (!confirm("Sei sicuro di voler eliminare questo sondaggio?")) return;
  const { error } = await db.from('partite').delete().eq('id', idPartita);
  if (error) return alert("Impossibile eliminare il sondaggio.");
  caricaSondaggi();
}

// -------------------------------------------------------------
// AUTOMAZIONI: CREAZIONE TORNEO E CANCELLAZIONE SCADUTI
// -------------------------------------------------------------
async function gestisciAutomazioniSondaggi() {
  const adesso = new Date();

  // Cancellazione automatica sondaggi scaduti
  await db.from('partite').delete().lt('data_ora', adesso.toISOString());

  // Creazione automatica sondaggio prendendo dal calendario_torneo su Supabase
  const { data: prossimePartite } = await db.from('calendario_torneo').select('*').gte('data_ora', adesso.toISOString());

  if (prossimePartite && prossimePartite.length > 0) {
    for (const partita of prossimePartite) {
      const dataPartita = new Date(partita.data_ora);

      const giornoSettimana = dataPartita.getDay();
      const diffALunedi = (giornoSettimana === 0 ? -6 : 1 - giornoSettimana);
      const lunediSettimanaPartita = new Date(dataPartita);
      lunediSettimanaPartita.setDate(dataPartita.getDate() + diffALunedi);
      lunediSettimanaPartita.setHours(0, 0, 0, 0);

      const sabatoAttivazione = new Date(lunediSettimanaPartita);
      sabatoAttivazione.setDate(lunediSettimanaPartita.getDate() - 2);

      if (adesso >= sabatoAttivazione) {
        const avversario = partita.squadra_casa.toLowerCase().includes('darsenal') ? partita.squadra_trasferta : partita.squadra_casa;

        const { data: esistente } = await db
          .from('partite')
          .select('id')
          .eq('squadra_avversaria', avversario)
          .eq('data_ora', partita.data_ora);

        if (!esistente || esistente.length === 0) {
          await db.from('partite').insert([{
            squadra_avversaria: avversario,
            data_ora: partita.data_ora,
            luogo: partita.luogo || 'Campo Sportivo'
          }]);
        }
      }
    }
  }
}

// -------------------------------------------------------------
// CARICAMENTO SONDAGGI E RENDERING
// -------------------------------------------------------------
async function caricaSondaggi() {
  const container = document.getElementById('sondaggi-container');

  await gestisciAutomazioniSondaggi();

  const { data: partiteList, error: errPartite } = await db
    .from('partite')
    .select('*')
    .order('data_ora', { ascending: true });

  if (errPartite) {
    container.innerHTML = `<div class="text-center text-xs text-rose-500 py-4">Errore caricamento partite.</div>`;
    return;
  }

  if (!partiteList || partiteList.length === 0) {
    container.innerHTML = `<div class="text-center text-xs text-slate-400 py-6">Nessun sondaggio/partita disponibile.</div>`;
    return;
  }

  const { data: presenzeList } = await db.from('presenze').select('*');
  const tuttePresenze = presenzeList || [];

  container.innerHTML = partiteList.map((partita) => {
    const presenzePartita = tuttePresenze.filter(p => p.id_partita === partita.id);
    const presenti = presenzePartita.filter(p => p.stato === 'Presente');
    const assenti = presenzePartita.filter(p => p.stato === 'Assente');
    
    const mioVoto = presenzePartita.find(p => p.nome_utente.toLowerCase() === currentUser?.toLowerCase());

    const dataFormatted = new Date(partita.data_ora).toLocaleString('it-IT', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Stili dinamici bottoni - Design App Moderno
    const btnCiSonoClass = mioVoto && mioVoto.stato === 'Presente'
      ? 'bg-emerald-500 text-white font-black shadow-lg shadow-emerald-500/30 border-2 border-emerald-500' // Attivo
      : 'bg-white border-2 border-emerald-100 text-emerald-600 font-bold hover:bg-emerald-50 hover:border-emerald-200'; // Inattivo

    const btnAssenteClass = mioVoto && mioVoto.stato === 'Assente'
      ? 'bg-rose-500 text-white font-black shadow-lg shadow-rose-500/30 border-2 border-rose-500' // Attivo
      : 'bg-white border-2 border-rose-100 text-rose-500 font-bold hover:bg-rose-50 hover:border-rose-200'; // Inattivo

    // Tasto elimina Admin ridisegnato
    const adminDeleteBtn = isAdmin
      ? `<button onclick="eliminaSondaggio('${partita.id}')" title="Elimina sondaggio" class="absolute top-4 right-4 text-slate-300 hover:text-rose-600 bg-white p-1 rounded-full transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>`
      : '';

    return `
      <div class="w-full mb-6">
        <!-- Card Principale -->
        <div class="bg-white p-5 rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 relative overflow-hidden">
          
          <!-- Decorazione superiore stile app -->
          <div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-burgundy to-rose-400"></div>
          
          ${adminDeleteBtn}

          <!-- Intestazione Card -->
          <div class="flex items-center gap-2 mb-3 mt-1">
            <div class="w-8 h-8 rounded-full bg-burgundy/10 flex items-center justify-center text-burgundy">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
            </div>
            <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">Convocazione</span>
          </div>

          <!-- Dettagli Match -->
          <div class="mb-5">
            <h3 class="text-xl font-black text-slate-800 tracking-tight">
              Darsenal <span class="text-slate-300 mx-1 font-medium text-lg">vs</span> ${partita.squadra_avversaria}
            </h3>
            <div class="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-2">
              <svg class="w-4 h-4 text-burgundy/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> 
              ${dataFormatted} <span class="text-slate-200 mx-1">|</span> ${partita.luogo || 'Campo'}
            </div>
          </div>

          <!-- Liste Presenti / Assenti (Affiancate) -->
          <div class="grid grid-cols-2 gap-3 mb-5">
            <!-- Box Presenti -->
            <div class="bg-emerald-50/50 rounded-2xl p-3 border border-emerald-100/50">
              <div class="flex items-center justify-between border-b border-emerald-100/80 pb-2 mb-2">
                <span class="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Presenti</span>
                <span class="bg-emerald-200 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded-full">${presenti.length}</span>
              </div>
              <div class="space-y-1.5 text-emerald-700 font-semibold text-xs max-h-32 overflow-y-auto">
                ${presenti.length ? presenti.map(p => `<div class="truncate flex items-center gap-1.5"><div class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></div>${p.nome_utente}</div>`).join('') : '<div class="text-emerald-500/50 italic font-medium">Nessuno</div>'}
              </div>
            </div>

            <!-- Box Assenti -->
            <div class="bg-rose-50/50 rounded-2xl p-3 border border-rose-100/50">
              <div class="flex items-center justify-between border-b border-rose-100/80 pb-2 mb-2">
                <span class="text-[10px] font-black text-rose-800 uppercase tracking-widest">Assenti</span>
                <span class="bg-rose-200 text-rose-900 text-[10px] font-black px-2 py-0.5 rounded-full">${assenti.length}</span>
              </div>
              <div class="space-y-1.5 text-rose-700 font-semibold text-xs max-h-32 overflow-y-auto">
                ${assenti.length ? assenti.map(a => `<div class="truncate flex items-center gap-1.5"><div class="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"></div>${a.nome_utente}</div>`).join('') : '<div class="text-rose-500/50 italic font-medium">Nessuno</div>'}
              </div>
            </div>
          </div>

          <!-- Pulsanti di Azione -->
          <div class="flex gap-3">
            <button onclick="votaPresenza('${partita.id}', true)" class="flex-1 py-3.5 rounded-2xl text-sm transition-all duration-200 flex items-center justify-center gap-2 ${btnCiSonoClass}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                Ci sono
            </button>
            <button onclick="votaPresenza('${partita.id}', false)" class="flex-1 py-3.5 rounded-2xl text-sm transition-all duration-200 flex items-center justify-center gap-2 ${btnAssenteClass}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                Non ci sono
            </button>
          </div>

        </div>
      </div>
    `;
  }).join('');
}

async function votaPresenza(partitaId, presente) {
  if (!currentUser) return alert("Devi prima effettuare il login.");

  const nuovoStato = presente ? 'Presente' : 'Assente';

  const { error } = await db
    .from('presenze')
    .upsert(
      { id_partita: partitaId, nome_utente: currentUser, stato: nuovoStato },
      { onConflict: 'id_partita,nome_utente' }
    );

  if (error) return alert(`Impossibile registrare il voto: ${error.message || JSON.stringify(error)}`);

  caricaSondaggi();
}

// -------------------------------------------------------------
// GENERAZIONE PDF DISTINTA
// -------------------------------------------------------------
async function generaDistintaPDF() {
  try {
    const dataLimite = new Date();
    dataLimite.setHours(dataLimite.getHours() - 12); 
    const limiteISO = dataLimite.toISOString();

    const { data: sondaggi, error: errSondaggi } = await db
      .from('partite')
      .select('*')
      .gte('data_ora', limiteISO)
      .order('data_ora', { ascending: true })
      .limit(1);

    if (errSondaggi || !sondaggi || sondaggi.length === 0) {
      return alert("Nessun sondaggio attivo trovato per le partite odierne o future.");
    }

    const sondaggioAttivo = sondaggi[0];
    const idSondaggio = sondaggioAttivo.id;

    const { data: presenti, error: errPresenti } = await db
      .from('presenze')
      .select('nome_utente')
      .eq('id_partita', idSondaggio)
      .eq('stato', 'Presente');

    if (errPresenti || !presenti || presenti.length === 0) {
      return alert("Nessun giocatore ha votato 'Ci sono' a questo sondaggio.");
    }

    const normalizzaNome = (nome) => nome.toLowerCase().trim().split(/\s+/).sort().join(' ');

    let giocatoriLista = presenti.map(p => {
      const nomeDB = normalizzaNome(p.nome_utente);
      
      const mockData = (typeof GIOCATORI_MOCK !== 'undefined') 
        ? GIOCATORI_MOCK.find(g => normalizzaNome(g.nome_completo) === nomeDB) 
        : null;
      
      return {
        nome_da_stampare: mockData ? mockData.nome_completo : p.nome_utente,
        data_nascita: mockData ? mockData.data_nascita : '',
        ruolo: mockData ? mockData.ruolo : '',
        numero_maglia: mockData && mockData.numero_maglia ? mockData.numero_maglia : 99 
      };
    });

    let testoCasa = "DARSENAL"; 
    let testoTrasferta = sondaggioAttivo.squadra_avversaria.toUpperCase();

    const { data: matchCalendario } = await db
      .from('calendario_torneo')
      .select('*')
      .eq('data_ora', sondaggioAttivo.data_ora)
      .limit(1);

    if (matchCalendario && matchCalendario.length > 0) {
      testoCasa = matchCalendario[0].squadra_casa.toUpperCase();
      testoTrasferta = matchCalendario[0].squadra_trasferta.toUpperCase();
    }

    giocatoriLista.sort((a, b) => a.numero_maglia - b.numero_maglia);
    const capitanoPresente = giocatoriLista.some(g => g.ruolo && g.ruolo.toLowerCase() === 'capitano');

    const urlPdf = 'Distinta.pdf'; 
    const existingPdfBytes = await fetch(urlPdf).then(res => res.arrayBuffer());
    
    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const page = pages[0]; 

    const baseFontSize = 11;
    
    const coordY_Iniziale_Titolo = 715; 
    const coordX_Casa = 120;       
    const coordX_Trasferta = 330;  
    const coordY_PrimaRiga = 663; 
    const distanzaTraRighe = 13.7;  

    const asseX_Numero = 136;           
    const asseX_Nome = 156;             
    const asseX_DataNascita = 290;      
    const asseX_Cap = 380;              

    // Punto 3: Nomi squadre più piccoli di un punto (da 14 a 13)
    page.drawText(testoCasa, { x: coordX_Casa, y: coordY_Iniziale_Titolo, size: 13 });
    page.drawText(testoTrasferta, { x: coordX_Trasferta, y: coordY_Iniziale_Titolo, size: 13 });

    giocatoriLista.forEach((g, index) => {
      // Calcolo base Y
      let currentY = coordY_PrimaRiga - (index * distanzaTraRighe);

      // Punto 2: Compensazione per la riga nera spessa dopo il settimo giocatore (index 7)
      if (index >= 7) {
        currentY -= 2.5; // Abbassa di ulteriori 2.5 punti per saltare lo spessore
      }

      const numeroTxt = g.numero_maglia !== 99 ? g.numero_maglia.toString() : (index + 1).toString(); 
      const nomeCompletoTxt = g.nome_da_stampare.toUpperCase(); 
      const dataTxt = g.data_nascita || ''; 

      let capTxt = '';
      const ruolo = g.ruolo ? g.ruolo.toLowerCase() : '';
      
      if (ruolo === 'capitano') {
        capTxt = 'CAP.';
      } else if (ruolo === 'vice capitano' || ruolo === 'vice') {
        capTxt = capitanoPresente ? 'V.CAP.' : 'CAP.';
      }

      // Punto 1: Compattamento nomi lunghi
      let nameFontSize = baseFontSize;
      if (nomeCompletoTxt.length > 18) {
        nameFontSize = 9.5; // Rimpicciolisce il font per non sforare la casella
      }

      page.drawText(numeroTxt, { x: asseX_Numero, y: currentY, size: baseFontSize });
      page.drawText(nomeCompletoTxt, { x: asseX_Nome, y: currentY, size: nameFontSize });
      page.drawText(dataTxt, { x: asseX_DataNascita, y: currentY, size: baseFontSize });
      if (capTxt) page.drawText(capTxt, { x: asseX_Cap, y: currentY, size: baseFontSize });
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const urlBlob = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = urlBlob;
    link.download = `Distinta_${testoCasa}_${testoTrasferta}.pdf`.replace(/\s+/g, '_');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
  } catch (error) {
    console.error("Errore generazione PDF:", error);
    alert("Si è verificato un errore durante la creazione della distinta PDF.");
  }
}

window.onload = () => {
  caricaPartite();
};