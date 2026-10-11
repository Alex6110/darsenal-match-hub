// -------------------------------------------------------------
// SEZIONE CLASSIFICA
// -------------------------------------------------------------
let squadraInModifica = null; // Variabile per tenere traccia della squadra che stiamo modificando

async function caricaClassifica() {
  const tbody = document.getElementById('classifica-tbody');
  if (!tbody) return;

  // Se non ci sono fasi create nel database
  if (!window.faseAttivaId) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-xs text-slate-400 py-6">Ancora nessuna info sul torneo.</td></tr>`;
    return;
  }

  // Filtra la classifica in base alla fase attiva selezionata
  const { data: classifica, error } = await db
    .from('classifica')
    .select('*')
    .eq('fase_torneo', window.faseAttivaId);

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-xs text-rose-500 py-4">Errore caricamento classifica.</td></tr>`;
    return;
  }

  if (!classifica || classifica.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-xs text-slate-400 py-4">Classifica vuota per questa fase.</td></tr>`;
    return;
  }

  // ORDINAMENTO AUTOMATICO: 1° Punti, 2° Differenza Reti, 3° Alfabetico
  classifica.sort((a, b) => {
    if (b.punti !== a.punti) return b.punti - a.punti;
    if (b.differenza_reti !== a.differenza_reti) return b.differenza_reti - a.differenza_reti;
    return a.squadra.localeCompare(b.squadra);
  });

  tbody.innerHTML = classifica.map((item, index) => {
    const isDarsenal = item.squadra.toLowerCase().includes('darsenal');
    const rowClass = isDarsenal ? 'bg-burgundy-soft/50 font-bold' : '';
    const textBurgundy = isDarsenal ? 'text-burgundy' : 'text-slate-700';

    const adminButtons = (typeof isAdmin !== 'undefined' && isAdmin) ? `
      <div class="flex gap-2">
        <button onclick="apriModalModificaSquadra('${item.id}', '${item.squadra.replace(/'/g, "\\'")}', ${item.punti}, ${item.differenza_reti}, ${item.giocate})" class="text-xs text-slate-300 hover:text-emerald-500">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
        </button>
        <button onclick="eliminaSquadraClassifica('${item.id}')" class="text-xs text-slate-300 hover:text-rose-600">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
    ` : '';

    return `
      <tr class="${rowClass}">
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

window.selezionaPuntiCustom = function(valore) {
  window.aggiungiPunti(valore);
  const optionsMenu = document.getElementById('options-admin-classifica-punti-add');
  if (optionsMenu) optionsMenu.classList.add('hidden');
};

window.aggiungiPunti = function(valore) {
  if (valore === undefined || valore === null || valore === "") return;
  
  const puntiInput = document.getElementById('admin-classifica-punti');
  const giocateInput = document.getElementById('admin-classifica-giocate');
  
  puntiInput.value = (parseInt(puntiInput.value) || 0) + parseInt(valore);
  giocateInput.value = (parseInt(giocateInput.value) || 0) + 1; 
};


async function eliminaSquadraClassifica(id) {
  const confermato = await mostraConfirm("Vuoi eliminare questa squadra dalla classifica?");
  if (!confermato) return;

  const { error } = await db.from('classifica').delete().eq('id', id);
  if (error) return mostraAlert("Errore durante l'eliminazione della squadra.");

  caricaClassifica();
}

window.apriModalModificaSquadra = function(id, squadra, punti, dr, giocate) {
  squadraInModifica = id;
  window.squadraInModifica = id;
  
  // Compila i campi con i dati reali della riga selezionata
  const inputSquadra = document.getElementById('admin-classifica-squadra');
  const inputPunti = document.getElementById('admin-classifica-punti');
  const inputGiocate = document.getElementById('admin-classifica-giocate');
  const inputDr = document.getElementById('admin-classifica-dr');

  if (inputSquadra) inputSquadra.value = squadra;
  if (inputPunti) inputPunti.value = punti ?? 0;
  if (inputGiocate) inputGiocate.value = giocate ?? 0;
  if (inputDr) inputDr.value = dr ?? 0;

  // Apre la modale senza azzerare i valori
  document.getElementById('classifica-modal')?.classList.remove('hidden');
};

async function salvaSquadraClassifica() {
  if (!window.faseAttivaId) {
    return mostraAlert("Crea o seleziona prima una fase per salvare la squadra!");
  }

  const squadra = document.getElementById('admin-classifica-squadra').value.trim();
  const puntiTotali = parseInt(document.getElementById('admin-classifica-punti').value) || 0;
  const giocate = parseInt(document.getElementById('admin-classifica-giocate').value) || 0;
  const dr = parseInt(document.getElementById('admin-classifica-dr').value) || 0;

  if (!squadra) return mostraAlert("Inserisci il nome della squadra!");

  const payload = {
    squadra, 
    punti: puntiTotali, 
    giocate, 
    differenza_reti: dr,
    fase_torneo: window.faseAttivaId
  };

  // Mantiene l'ID della riga per aggiornare la squadra esistente anziché crearne una nuova
  if (squadraInModifica || window.squadraInModifica) {
    payload.id = squadraInModifica || window.squadraInModifica;
  }

  const { error } = await db.from('classifica').upsert([payload]);

  if (error) {
    console.error(error);
    return mostraAlert("Errore durante l'aggiornamento della classifica: " + error.message);
  }

  chiudiModalGestioneClassifica();
  caricaClassifica();
}