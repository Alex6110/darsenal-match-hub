// -------------------------------------------------------------
// SEZIONE PARTITE & CALENDARIO
// -------------------------------------------------------------
let tabCalendarioAttivo = 'prossimi';
let cacheCalendario = [];
let eventiPartitaCorrenti = [];

window.setTabCalendario = function(tab) {
  tabCalendarioAttivo = tab;
  renderPartite();
};

async function caricaPartite() {
  const prossimoContainer = document.getElementById('prossimo-incontro-container');
  const listeContainer = document.getElementById('partite-precedenti-container');

  if (!window.faseAttivaId) {
    if (prossimoContainer) {
      prossimoContainer.innerHTML = `<div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center text-xs text-slate-400 font-medium">Ancora nessuna info sul torneo.</div>`;
    }
    if (listeContainer) listeContainer.innerHTML = '';
    return;
  }

  const { data: calendario, error } = await db
    .from('calendario_torneo')
    .select('*')
    .eq('fase_torneo', window.faseAttivaId)
    .order('data_ora', { ascending: true });

  if (error) {
    console.error("Errore caricamento calendario:", error);
    if (prossimoContainer) prossimoContainer.innerHTML = `<div class="text-xs text-rose-500 py-2">Errore nel caricamento.</div>`;
    return;
  }

  const [{ data: tuttiEventi }, { data: tuttePresenze }, { data: tuttePartiteSondaggio }] = await Promise.all([
    db.from('eventi_partita').select('*'),
    db.from('presenze').select('*').eq('stato', 'Presente'),
    db.from('partite').select('id, data_ora')
  ]);

  cacheCalendario = (calendario || []).map(p => {
    const sondaggio = (tuttePartiteSondaggio || []).find(s => s.data_ora === p.data_ora);
    const sondaggioId = sondaggio ? sondaggio.id : null;
    return {
      ...p,
      eventi: (tuttiEventi || []).filter(e => e.id_partita === p.id),
      convocati: (tuttePresenze || [])
                   .filter(pr => pr.id_partita === sondaggioId || pr.id_partita === p.id || pr.id_sondaggio === p.id || pr.partita_id === p.id)
                   .map(pr => pr.nome_utente)
    };
  });

  renderPartite();
}
function formattaDataPartita(dataOraStr) {
  if (!dataOraStr) return '';
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  const dataPartita = new Date(dataOraStr);
  if (isNaN(dataPartita.getTime())) return '';
  
  const dataPartitaSenzaOra = new Date(dataPartita);
  dataPartitaSenzaOra.setHours(0, 0, 0, 0);

  const diffGiorni = Math.round((dataPartitaSenzaOra - oggi) / (1000 * 60 * 60 * 24));

  if (diffGiorni === 0) return 'OGGI';
  if (diffGiorni === 1) return 'DOMANI';

  const giorno = dataPartita.toLocaleDateString('it-IT', { weekday: 'short' }).toUpperCase();
  const dataBreve = dataPartita.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).toUpperCase();
  return `${giorno} ${dataBreve}`;
}

function renderPartite() {
  const prossimoContainer = document.getElementById('prossimo-incontro-container');
  const listeContainer = document.getElementById('partite-precedenti-container');

  if (!prossimoContainer || !listeContainer) return;

  if (cacheCalendario.length === 0) {
    prossimoContainer.innerHTML = `<div class="text-xs text-slate-400 py-4 text-center">Nessuna partita in calendario per questa fase.</div>`;
    listeContainer.innerHTML = '';
    return;
  }

  const adesso = new Date();

  const passate = cacheCalendario
    .filter(p => p.completata || p.risultato || new Date(p.data_ora) <= adesso)
    .sort((a, b) => new Date(b.data_ora) - new Date(a.data_ora));

  const prossime = cacheCalendario
    .filter(p => !p.completata && !p.risultato && new Date(p.data_ora) > adesso)
    .sort((a, b) => new Date(a.data_ora) - new Date(b.data_ora));

  if (prossime.length > 0) {
    const p = prossime[0];
    const dataStr = formattaDataPartita(p.data_ora);
    const oraStr = p.data_ora ? new Date(p.data_ora).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';

   const btnRisultatoHtml = (typeof isAdmin !== 'undefined' && isAdmin) 
      ? `<div class="mt-3 pt-3 border-t border-slate-100">
           <button onclick="apriModalRisultato('${p.id}')" class="w-full py-2.5 bg-burgundy/10 text-burgundy font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-burgundy/20 transition-colors flex items-center justify-center gap-1.5">
             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
             ${p.risultato ? 'Modifica Risultato' : 'Inserisci Risultato'}
           </button>
         </div>` 
      : '';

    // Pulsante Formazione visibile a tutti nel Prossimo Incontro
    const btnFormazioneHtml = `
      <div class="mt-3 pt-3 border-t border-slate-100">
        <button onclick="apriSezioneFormazione()" class="w-full py-2.5 bg-slate-100 text-slate-700 font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5">
          <svg class="w-4 h-4 text-burgundy" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-8v16m-7-13h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2z"/></svg>
          Vedi Formazione
        </button>
      </div>
    `;

    const adminDeleteBtn = (typeof isAdmin !== 'undefined' && isAdmin) ? `
      <button onclick="eliminaPartitaTorneo('${p.id}')" class="text-slate-300 hover:text-rose-600 transition-colors p-1" title="Elimina Partita">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
    ` : '';

    prossimoContainer.innerHTML = `
      <div class="bg-white p-4 rounded-3xl shadow-md border-l-4 border-burgundy relative">
        <div class="flex justify-between items-center text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 border-b border-slate-100 pb-2">
          <span>${p.giornata || 'PROSSIMO MATCH'}</span>
          <div class="flex items-center gap-2">
            <span class="text-burgundy font-extrabold flex items-center gap-1">
              <svg class="w-3.5 h-3.5 inline-block -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> 
              ${dataStr} - ${oraStr}
            </span>
            ${adminDeleteBtn}
          </div>
        </div>
        
        <!-- INDICAZIONE CAMPO SPORTIVO -->
        <div class="text-[10px] font-bold text-slate-500 mb-3 flex items-center justify-center gap-1 bg-slate-50 py-1 px-2 rounded-lg border border-slate-100">
          <svg class="w-3 h-3 text-burgundy" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          <span>${p.luogo || 'Campo Sportivo'}</span>
        </div>

        <!-- SQUADRE E VS CENTRALE -->
        <div class="flex justify-between items-center py-2">
          <div class="flex flex-col items-center gap-1.5 w-2/5 min-w-0">
            <div class="w-10 h-10 rounded-full bg-burgundy/10 text-burgundy flex items-center justify-center font-black text-xs mb-1 shrink-0">${(p.squadra_casa || '').substring(0, 2).toUpperCase()}</div>
            <span class="font-bold text-sm text-slate-900 text-center leading-tight break-words w-full px-1">${p.squadra_casa}</span>
          </div>
          <div class="text-center font-black text-slate-300 text-base w-1/5 shrink-0">VS</div>
          <div class="flex flex-col items-center gap-1.5 w-2/5 min-w-0">
            <div class="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-black text-xs mb-1 shrink-0">${(p.squadra_trasferta || '').substring(0, 2).toUpperCase()}</div>
            <span class="font-bold text-sm text-slate-600 text-center leading-tight break-words w-full px-1">${p.squadra_trasferta}</span>
          </div>
        </div>

        <!-- FOOTER PULSANTI -->
        ${btnRisultatoHtml}
        ${btnFormazioneHtml}
      </div>
    `;
  } else {
    prossimoContainer.innerHTML = `<div class="text-xs text-slate-400 py-4 text-center">Nessun match imminente.</div>`;
  }

  const toggleHtml = `
    <div class="sticky top-[125px] z-20 py-2 mb-3 bg-transparent">
      <div class="flex bg-slate-200/90 backdrop-blur-sm p-1 rounded-[1.2rem] border border-slate-200/50 shadow-sm">
        <button onclick="setTabCalendario('giocate')" class="flex-1 py-2 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all ${tabCalendarioAttivo === 'giocate' ? 'bg-white text-burgundy shadow-sm' : 'text-slate-500 hover:text-slate-700'}">Partite Giocate</button>
        <button onclick="setTabCalendario('prossimi')" class="flex-1 py-2 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all ${tabCalendarioAttivo === 'prossimi' ? 'bg-white text-burgundy shadow-sm' : 'text-slate-500 hover:text-slate-700'}">Prossimi Impegni</button>
      </div>
    </div>
  `;

  let listaHtml = '';
  const restoProssime = prossime.slice(1);
  const listaDaMostrare = tabCalendarioAttivo === 'giocate' ? passate : restoProssime;

  if (listaDaMostrare.length === 0) {
    const msg = tabCalendarioAttivo === 'giocate' ? 'Nessuna partita giocata per ora.' : 'Nessun altro impegno futuro in calendario.';
    listaHtml = `<div class="text-xs text-slate-400 py-4 text-center font-medium">${msg}</div>`;
  } else {
    listaHtml = listaDaMostrare.map((p, index) => {
      const dateObj = new Date(p.data_ora);
      const dataStr = formattaDataPartita(p.data_ora);
      const oraStr = dateObj.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

      const isGiocate = (tabCalendarioAttivo === 'giocate');
      const isUltimaGiocata = (isGiocate && index === 0);
      const containerClass = isUltimaGiocata 
        ? "bg-white p-3.5 rounded-2xl shadow-md border-2 border-burgundy relative mb-3" 
        : "bg-white p-3.5 rounded-2xl shadow-sm border border-slate-100 mb-3";
      
      const badgeUltima = isUltimaGiocata
        ? `<span class="bg-burgundy text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Ultima Giocata</span>`
        : `<span class="uppercase">${p.giornata || 'PARTITA'}</span>`;

      // Gestione separata admin: per le giocate resta il blocco in alto, 
      // per le future (prossimi impegni) la X resta in alto e il tasto risultato va sotto il VS.
      let adminControlsTop = '';
      let adminRisultatoSottoVs = '';

      if (typeof isAdmin !== 'undefined' && isAdmin) {
        if (isGiocate) {
          adminControlsTop = `
            <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
              <button onclick="apriModalRisultato('${p.id}')" class="text-[9px] text-emerald-600 font-black uppercase tracking-widest hover:underline">
                ${p.risultato ? 'Modifica' : 'Risultato'}
              </button>
              <button onclick="eliminaPartitaTorneo('${p.id}')" class="text-xs text-slate-300 hover:text-rose-600 p-0.5" title="Elimina">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          `;
        } else {
          // Partite future (Prossimi Impegni): Solo la X in alto a destra, nessun tasto risultato
          adminControlsTop = `
            <button onclick="eliminaPartitaTorneo('${p.id}')" class="text-slate-300 hover:text-rose-600 transition-colors p-1" title="Elimina Partita">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          `;
          adminRisultatoSottoVs = ''; // Nessun pulsante sotto il VS per le partite future
        }
      }

      let areaDettagliHtml = '';
      const haConvocati = p.convocati && p.convocati.length > 0;
      const haEventi = p.eventi && p.eventi.length > 0;

      if (haConvocati || haEventi) {
        let convocatiHtml = '';
        if (haConvocati) {
          const listaPillole = p.convocati.map(n => `<span class="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[10px] capitalize font-bold border border-slate-200">${n}</span>`).join('');
          convocatiHtml = `
            <div class="mb-3">
              <span class="font-black text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                Convocati (${p.convocati.length})
              </span>
              <div class="flex flex-wrap gap-1.5">${listaPillole}</div>
            </div>
          `;
        }

        let eventiHtml = '';
        if (haEventi) {
          const gol = p.eventi.filter(e => e.tipo === 'gol').map(e => `<span class="capitalize">${e.nome_utente}</span>`).join(', ');
          const gialli = p.eventi.filter(e => e.tipo === 'giallo').map(e => `<span class="capitalize">${e.nome_utente}</span>`).join(', ');
          const rossi = p.eventi.filter(e => e.tipo === 'rosso').map(e => `<span class="capitalize">${e.nome_utente}</span>`).join(', ');

          eventiHtml = `
            <div>
              <span class="font-black text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                Eventi Match
              </span>
              <div class="space-y-1.5 text-[11px]">
                ${gol ? `<div class="flex items-center gap-2 text-slate-700 bg-emerald-50/50 px-2.5 py-1.5 rounded-lg border border-emerald-100"><svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 7l4.76 3.45l-1.76 5.55h-6l-1.76 -5.55l4.76 -3.45" /><path d="M12 7v-4m3 13l2.5 3m-.74 -8.55l3.74 -1.45m-11.44 7.05l-2.56 2.95m.74 -8.55l-3.74 -1.45" /></svg><span class="font-bold">${gol}</span></div>` : ''}
                ${gialli ? `<div class="flex items-center gap-2 text-slate-700 bg-amber-50/50 px-2.5 py-1.5 rounded-lg border border-amber-100"><svg class="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 24 24"><rect width="14" height="18" x="5" y="3" rx="2" /></svg><span class="font-bold">${gialli}</span></div>` : ''}
                ${rossi ? `<div class="flex items-center gap-2 text-slate-700 bg-rose-50/50 px-2.5 py-1.5 rounded-lg border border-rose-100"><svg class="w-3.5 h-3.5 text-rose-600 shrink-0" fill="currentColor" viewBox="0 0 24 24"><rect width="14" height="18" x="5" y="3" rx="2" /></svg><span class="font-bold">${rossi}</span></div>` : ''}
              </div>
            </div>
          `;
        }

        areaDettagliHtml = `
          <div class="mt-3 border-t border-slate-100">
            <div id="details-${p.id}" class="hidden pt-3 pb-1 transition-all duration-300 origin-top">
              ${convocatiHtml}
              ${eventiHtml}
            </div>
            <button onclick="toggleDettagliPartita('${p.id}')" id="btn-details-${p.id}" class="w-full flex justify-center items-center gap-1 py-2 mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-burgundy transition-colors">
              <span id="text-details-${p.id}">Espandi</span>
              <svg id="icon-details-${p.id}" class="w-3 h-3 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
          </div>
        `;
      }

      return `
        <div class="${containerClass}">
          <div class="flex justify-between items-center text-[10px] font-bold text-slate-400 mb-2">
            ${badgeUltima}
            <div class="flex items-center gap-2">
              <span class="flex items-center gap-1">
                <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
                ${p.luogo || 'Campo'} | ${dataStr} ${oraStr}
              </span>
              ${adminControlsTop}
            </div>
          </div>
          <div class="flex justify-between items-center py-1">
            <span class="font-bold text-xs sm:text-sm w-2/5 text-slate-800 break-words">${p.squadra_casa}</span>
            
            <div class="flex flex-col items-center w-1/5 min-w-[60px]">
              <div class="bg-slate-50 border border-slate-100 px-3 py-1 rounded-xl font-black text-slate-800 tracking-widest text-xs w-full text-center shadow-inner">
                ${p.risultato || 'VS'}
              </div>
              ${adminRisultatoSottoVs}
            </div>

            <span class="font-bold text-xs sm:text-sm w-2/5 text-right text-slate-600 break-words">${p.squadra_trasferta}</span>
          </div>
          ${areaDettagliHtml}
        </div>
      `;
    }).join('');
  
  }

  listeContainer.innerHTML = toggleHtml + listaHtml;
}
window.apriModalRisultato = async function(id) {
  window.idPartitaPerRisultato = id;
  const p = cacheCalendario.find(item => item.id === id);

  const inputRisultato = document.getElementById('admin-input-risultato');
  if (inputRisultato) {
    inputRisultato.value = p ? (p.risultato || '') : '';
  }

  const { data: eventi } = await db.from('eventi_partita').select('*').eq('id_partita', id);
  eventiPartitaCorrenti = eventi || [];

  const optionsGiocatore = document.getElementById('options-admin-select-giocatore-evento');
  if (optionsGiocatore) {
    let giocatori = [];
    const { data: dbGiocatori } = await db.from('giocatori').select('*');
    if (dbGiocatori && dbGiocatori.length > 0) {
      giocatori = dbGiocatori;
    } else if (typeof GIOCATORI_MOCK !== 'undefined') {
      giocatori = GIOCATORI_MOCK;
    }

    optionsGiocatore.innerHTML = giocatori.map(g => {
      const nome = g.nome_completo || g.nome;
      const nomeEscaped = nome.replace(/'/g, "\\'");
      return `<div onclick="selezionaOpzione('admin-select-giocatore-evento', '${nomeEscaped}', '${nomeEscaped}')" class="p-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-b-0 capitalize transition-colors">${nome}</div>`;
    }).join('');

    const displayEl = document.getElementById('display-admin-select-giocatore-evento');
    if (displayEl) {
      displayEl.innerText = 'Seleziona Giocatore...';
      displayEl.className = 'text-slate-400 text-xs';
    }
    const inputHidden = document.getElementById('admin-select-giocatore-evento');
    if (inputHidden) inputHidden.value = '';

    document.getElementById('admin-select-tipo-evento').value = 'gol';
    const displayTipo = document.getElementById('display-admin-select-tipo-evento');
    if (displayTipo) {
      displayTipo.innerHTML = `<svg class="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 7l4.76 3.45l-1.76 5.55h-6l-1.76 -5.55l4.76 -3.45" /><path d="M12 7v-4m3 13l2.5 3m-.74 -8.55l3.74 -1.45m-11.44 7.05l-2.56 2.95m.74 -8.55l-3.74 -1.45" /></svg> Gol`;
    }
  }

  renderEventiModal();

  const modal = document.getElementById('inserisci-risultato-modal');
  if (modal) modal.classList.remove('hidden');
};

window.chiudiModalRisultato = function() {
  const modal = document.getElementById('inserisci-risultato-modal');
  if (modal) modal.classList.add('hidden');
  window.idPartitaPerRisultato = null;
  eventiPartitaCorrenti = [];
};

window.aggiungiEventoModal = function() {
  const selectGiocatore = document.getElementById('admin-select-giocatore-evento');
  const selectTipo = document.getElementById('admin-select-tipo-evento');

  const nome = selectGiocatore ? selectGiocatore.value : '';
  const tipo = selectTipo ? selectTipo.value : 'gol';

  if (!nome) return mostraAlert("Seleziona prima un giocatore!");

  eventiPartitaCorrenti.push({ nome_utente: nome, tipo: tipo });
  renderEventiModal();
};

window.rimuoviEventoModal = function(index) {
  eventiPartitaCorrenti.splice(index, 1);
  renderEventiModal();
};

function renderEventiModal() {
  const container = document.getElementById('admin-lista-eventi-container');
  if (!container) return;

  if (eventiPartitaCorrenti.length === 0) {
    container.innerHTML = `<div class="text-[11px] text-slate-400 italic py-3 text-center">Nessun evento registrato per questo match.</div>`;
    return;
  }

  container.innerHTML = eventiPartitaCorrenti.map((ev, index) => {
    let style = 'bg-slate-100 text-slate-700 border-slate-200';
    let iconSvg = '';
    let label = 'Evento';

    if (ev.tipo === 'gol') {
      style = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      iconSvg = `<svg class="w-4 h-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 7l4.76 3.45l-1.76 5.55h-6l-1.76 -5.55l4.76 -3.45" /><path d="M12 7v-4m3 13l2.5 3m-.74 -8.55l3.74 -1.45m-11.44 7.05l-2.56 2.95m.74 -8.55l-3.74 -1.45" /></svg>`;
      label = 'Gol';
    } else if (ev.tipo === 'giallo') {
      style = 'bg-amber-50 text-amber-800 border-amber-200';
      iconSvg = `<svg class="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24"><rect width="14" height="18" x="5" y="3" rx="2" /></svg>`;
      label = 'Ammonizione';
    } else if (ev.tipo === 'rosso') {
      style = 'bg-rose-50 text-rose-800 border-rose-200';
      iconSvg = `<svg class="w-4 h-4 text-rose-600" fill="currentColor" viewBox="0 0 24 24"><rect width="14" height="18" x="5" y="3" rx="2" /></svg>`;
      label = 'Espulsione';
    }

    return `
      <div class="flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold ${style}">
        <div class="flex items-center gap-2">
          ${iconSvg}
          <span class="font-bold capitalize">${ev.nome_utente}</span>
          <span class="text-[10px] uppercase opacity-70">(${label})</span>
        </div>
        <button onclick="rimuoviEventoModal(${index})" class="text-slate-400 hover:text-rose-600 font-bold px-1.5 text-sm transition-colors">✕</button>
      </div>
    `;
  }).join('');
}

async function salvaRisultatoTorneo() {
  const matchId = window.idPartitaPerRisultato;
  if (!matchId) return;

  const risultato = document.getElementById('admin-input-risultato').value.trim();

  const { error: errPartita } = await db.from('calendario_torneo')
    .update({ 
      risultato: risultato, 
      completata: risultato !== '' 
    })
    .eq('id', matchId);

  if (errPartita) {
    console.error("Errore aggiornamento partita:", errPartita);
    return mostraAlert("Errore nel salvataggio del risultato.");
  }

  const { error: errDel } = await db.from('eventi_partita')
    .delete()
    .eq('id_partita', matchId);

  if (errDel) {
    console.error("Errore pulizia eventi precedenti:", errDel);
  }

  if (eventiPartitaCorrenti.length > 0) {
    const payload = eventiPartitaCorrenti.map(ev => ({
      id_partita: matchId,
      nome_utente: ev.nome_utente,
      tipo: ev.tipo
    }));

    const { error: errIns } = await db.from('eventi_partita').insert(payload);

    if (errIns) {
      console.error("Errore inserimento eventi:", errIns);
      return mostraAlert("Risultato salvato, ma si è verificato un errore nel salvataggio degli eventi.");
    }
  }

  chiudiModalRisultato();
  caricaPartite();
}

async function salvaPartitaTorneo() {
  if (!window.faseAttivaId) {
    return mostraAlert("Crea o seleziona prima una fase per salvare la partita!");
  }

  const giornata = document.getElementById('admin-torneo-giornata').value.trim();
  const casa = document.getElementById('admin-torneo-casa').value;
  const trasferta = document.getElementById('admin-torneo-trasferta').value;
  const data = document.getElementById('admin-torneo-data').value;
  const ora = document.getElementById('admin-torneo-ora').value;
  const luogo = document.getElementById('admin-torneo-luogo').value.trim() || 'Campo Sportivo';

  if (!casa || !trasferta || !data || !ora) return mostraAlert("Compila tutti i campi obbligatori!");

  let dataOraISO;
  try {
    const [gg, mm] = data.split('/');
    const annoCorrente = new Date().getFullYear();
    dataOraISO = new Date(`${annoCorrente}-${mm}-${gg}T${ora}:00`).toISOString();
  } catch (e) {
    dataOraISO = new Date(`${data}T${ora}`).toISOString();
  }

  const { error } = await db.from('calendario_torneo').insert([{
    giornata, 
    fase_torneo: window.faseAttivaId,
    squadra_casa: casa, 
    squadra_trasferta: trasferta, 
    data_ora: dataOraISO, 
    luogo, 
    completata: false
  }]);

  if (error) return mostraAlert("Errore nel salvataggio della partita.");

  chiudiModalPartitaTorneo();
  caricaPartite();
}

async function eliminaPartitaTorneo(id) {
  const confermato = await mostraConfirm("Vuoi eliminare questa partita definitivamente?");
  if (!confermato) return;

  const { error } = await db.from('calendario_torneo').delete().eq('id', id);
  if (error) {
    console.error(error);
    return mostraAlert("Errore durante l'eliminazione della partita.");
  }
  
  caricaPartite();
}

window.toggleDettagliPartita = function(id) {
  const detailsEl = document.getElementById(`details-${id}`);
  const textEl = document.getElementById(`text-details-${id}`);
  const iconEl = document.getElementById(`icon-details-${id}`);

  if (detailsEl.classList.contains('hidden')) {
    detailsEl.classList.remove('hidden');
    textEl.innerText = 'Contrai';
    iconEl.classList.add('rotate-180');
  } else {
    detailsEl.classList.add('hidden');
    textEl.innerText = 'Espandi';
    iconEl.classList.remove('rotate-180');
  }
};

window.selezionaOpzioneTipoEvento = function(valore, testo, iconHtml) {
  document.getElementById('admin-select-tipo-evento').value = valore;
  const displayEl = document.getElementById('display-admin-select-tipo-evento');
  if (displayEl) {
    displayEl.innerHTML = `${iconHtml} <span class="font-bold text-slate-800">${testo}</span>`;
  }
  document.getElementById('options-admin-select-tipo-evento').classList.add('hidden');
};