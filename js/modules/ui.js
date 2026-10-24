// -------------------------------------------------------------
// GESTIONE UI, INTERFACCIA E MODALI CUSTOM
// -------------------------------------------------------------

// UTILITY PER MODALI CUSTOM (Sostituiscono alert e confirm nativi)
window.mostraAlert = function(messaggio, titolo = "Attenzione") {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-custom-alert');
    const titleEl = document.getElementById('modal-alert-title');
    const msgEl = document.getElementById('modal-alert-msg');
    const btnOk = document.getElementById('modal-alert-btn-ok');

    if (!modal) { alert(messaggio); return resolve(); }

    titleEl.innerText = titolo;
    msgEl.innerText = messaggio;
    modal.classList.remove('hidden');

    btnOk.onclick = function() {
      modal.classList.add('hidden');
      resolve();
    };
  });
};

window.mostraConfirm = function(messaggio, titolo = "Conferma operazione") {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-custom-confirm');
    const titleEl = document.getElementById('modal-confirm-title');
    const msgEl = document.getElementById('modal-confirm-msg');
    const btnOk = document.getElementById('modal-confirm-btn-ok');
    const btnCancel = document.getElementById('modal-confirm-btn-cancel');
    const btnClose = document.getElementById('modal-confirm-btn-close');

    if (!modal) { return resolve(confirm(messaggio)); }

    titleEl.innerText = titolo;
    msgEl.innerText = messaggio;
    modal.classList.remove('hidden');

    const chiudiEResolvi = (valore) => {
      modal.classList.add('hidden');
      resolve(valore);
    };

    btnOk.onclick = () => chiudiEResolvi(true);
    btnCancel.onclick = () => chiudiEResolvi(false);
    if (btnClose) btnClose.onclick = () => chiudiEResolvi(false);
  });
};

// -------------------------------------------------------------
// GESTIONE TAB E NAVBAR
// -------------------------------------------------------------

async function switchTab(tabName) {
  if ((tabName === 'sondaggi' || tabName === 'messaggi') && !currentUser) {
    const loginModal = document.getElementById('login-modal');
    if (loginModal) loginModal.classList.remove('hidden');
    return;
  }

  // SALVA LA TAB ATTIVA IN LOCALSTORAGE
  localStorage.setItem('darsenal_active_tab', tabName);

  ['partite', 'classifica', 'sondaggi', 'saldo', 'messaggi', 'formazione', 'giocatori'].forEach(t => {
    const el = document.getElementById(`view-${t}`);
    if (el) el.classList.add('hidden');
  });

  ['partite', 'classifica', 'sondaggi', 'saldo', 'giocatori'].forEach(t => {
    const navBtn = document.getElementById(`nav-${t}`);
    if (navBtn) {
      navBtn.classList.remove('text-burgundy');
      navBtn.classList.add('text-slate-400');
    }
  });

  const viewEl = document.getElementById(`view-${tabName}`);
  if (viewEl) viewEl.classList.remove('hidden');
  
  if (tabName !== 'messaggi') {
    const activeBtn = document.getElementById(`nav-${tabName}`);
    if (activeBtn) {
      activeBtn.classList.add('text-burgundy');
      activeBtn.classList.remove('text-slate-400');
    }
  }

  if (tabName === 'partite') {
    if (typeof caricaFasi === 'function') caricaFasi();
    if (typeof caricaPartite === 'function') caricaPartite();
  }
  if (tabName === 'classifica') {
    if (typeof caricaFasi === 'function') caricaFasi();
    if (typeof caricaClassifica === 'function') caricaClassifica();
  }
  if (tabName === 'sondaggi' && typeof caricaSondaggi === 'function') caricaSondaggi();
  if (tabName === 'messaggi') {
    await caricaMessaggi();
    aggiornaBadgeMessaggi();
  }
  if (tabName === 'saldo' && typeof caricaSaldo === 'function') caricaSaldo();
}

// -------------------------------------------------------------
// GESTIONE MESSAGGI BACHECA
// -------------------------------------------------------------

async function aggiornaBadgeMessaggi() {
  const badge = document.getElementById('messaggi-badge');
  if (!badge) return;

  if (!currentUser) {
    badge.innerText = '?';
    badge.classList.remove('hidden');
    return;
  }

  const { data: tuttiMessaggi } = await db.from('messaggi').select('id');
  const { data: letture } = await db.from('letture_messaggi').select('id_messaggio').eq('nome_utente', currentUser);
  
  const lettiIds = letture ? letture.map(l => l.id_messaggio) : [];
  const nonLetti = (tuttiMessaggi || []).filter(m => !lettiIds.includes(m.id)).length;
  
  if (nonLetti > 0) {
    badge.innerText = nonLetti;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

async function caricaMessaggi() {
  const container = document.getElementById('messaggi-container');
  if (!container) return;

  const { data: messaggi, error } = await db.from('messaggi').select('*').order('data_invio', { ascending: true });

  if (error || !messaggi || messaggi.length === 0) {
    container.innerHTML = `<div class="text-center text-xs text-slate-400 py-6">Nessun messaggio in bacheca.</div>`;
    return;
  }

  // Carica letture e reazioni
  const [{ data: tutteLetture }, { data: tutteReazioni }] = await Promise.all([
    db.from('letture_messaggi').select('*'),
    db.from('reazioni_messaggi').select('*')
  ]);

  let giocatoriList = typeof GIOCATORI_MOCK !== 'undefined' ? GIOCATORI_MOCK.map(g => g.nome_completo || g.nome) : [];
  const { data: dbGiocatori } = await db.from('giocatori').select('*');
  if (dbGiocatori && dbGiocatori.length > 0) {
    giocatoriList = dbGiocatori.map(g => g.nome_completo || g.nome);
  }

  let html = '';
  let lastDateStr = null;
  let unreadDividerInserted = false;

  const latestMessageId = messaggi[messaggi.length - 1]?.id;
  const lettiIdsUser = currentUser ? (tutteLetture || []).filter(l => l.nome_utente === currentUser).map(l => l.id_messaggio) : [];

  // Individua l'indice del primo messaggio non letto
  let primoNonLettoIndex = -1;
  if (currentUser) {
    for (let i = 0; i < messaggi.length; i++) {
      if (!lettiIdsUser.includes(messaggi[i].id)) {
        primoNonLettoIndex = i;
        break;
      }
    }
  }

  messaggi.forEach((msg, index) => {
    // Se troviamo il primo non letto, inseriamo un'ancora di scroll
    const isFirstUnread = (currentUser && primoNonLettoIndex !== -1 && index === primoNonLettoIndex);

    if (isFirstUnread && !unreadDividerInserted) {
      html += `
        <div id="primo-messaggio-non-letto" class="flex items-center my-4">
          <div class="flex-grow border-t border-rose-300"></div>
          <span class="mx-3 text-[10px] font-black uppercase tracking-wider text-rose-500 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 shadow-xs">Messaggi non letti</span>
          <div class="flex-grow border-t border-rose-300"></div>
        </div>
      `;
      unreadDividerInserted = true;
    }

    const dateObj = new Date(msg.data_invio);
    const oggi = new Date();
    let dataHeader = '';

    if (dateObj.toDateString() === oggi.toDateString()) {
      dataHeader = 'Oggi';
    } else {
      const ieri = new Date();
      ieri.setDate(oggi.getDate() - 1);
      dataHeader = (dateObj.toDateString() === ieri.toDateString()) ? 'Ieri' : dateObj.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    }

    if (dataHeader !== lastDateStr) {
      html += `
        <div class="flex items-center justify-center my-3">
          <span class="bg-slate-200/80 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-xs">${dataHeader}</span>
        </div>
      `;
      lastDateStr = dataHeader;
    }

    const isLatest = (msg.id === latestMessageId);
    const cardClass = isLatest 
      ? "bg-white p-4 rounded-2xl shadow-md border-2 border-burgundy relative transition-all"
      : "bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative transition-all";

    const lettureMsg = (tutteLetture || []).filter(l => l.id_messaggio === msg.id);
    const utentiLetti = lettureMsg.map(l => l.nome_utente);
    const utentiNonLetti = giocatoriList.filter(g => !utentiLetti.some(u => u.toLowerCase() === g.toLowerCase()));

    let sezioneLettureAdmin = '';
    if (isAdmin) {
      sezioneLettureAdmin = `
        <div class="mt-3 pt-2.5 border-t border-slate-100 text-[11px]">
          <button onclick="toggleDettagliLettura('${msg.id}')" class="w-full flex justify-between items-center text-slate-500 font-bold hover:text-slate-800 transition-colors">
            <span class="flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              Visualizzazioni (${utentiLetti.length}/${giocatoriList.length})
            </span>
            <span id="icon-read-${msg.id}" class="text-xs">▼</span>
          </button>
          <div id="read-details-${msg.id}" class="hidden mt-2 space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[10px]">
            <div><strong class="text-emerald-700">Visto da (${utentiLetti.length}):</strong> ${utentiLetti.length ? utentiLetti.join(', ') : 'Nessuno'}</div>
            <div><strong class="text-rose-600">Non visto da (${utentiNonLetti.length}):</strong> ${utentiNonLetti.length ? utentiNonLetti.join(', ') : 'Tutti hanno letto'}</div>
          </div>
        </div>
      `;
    }

    const reazioniMsg = (tutteReazioni || []).filter(r => r.id_messaggio === msg.id);
    const emojiDisponibili = ['👍', '❤️', '⚽', '🔥'];
    
    let reazioniHtml = emojiDisponibili.map(emoji => {
      const matchReazioni = reazioniMsg.filter(r => r.emoji === emoji);
      const count = matchReazioni.length;
      const haReagitoUtente = currentUser && matchReazioni.some(r => r.nome_utente?.toLowerCase() === currentUser?.toLowerCase());

      const badgeClass = haReagitoUtente 
        ? "bg-burgundy/10 border-burgundy text-burgundy font-black shadow-xs" 
        : "bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100/80";

      return `
        <button onclick="apriModalDettaglioReazione('${msg.id}', '${emoji}')" class="px-2.5 py-1 rounded-full border text-xs flex items-center gap-1.5 transition-all duration-150 active:scale-95 ${badgeClass}">
          <span class="text-sm">${emoji}</span>
          ${count > 0 ? `<span class="text-[10px] font-black">${count}</span>` : ''}
        </button>
      `;
    }).join('');

    const btnWhatsApp = isAdmin ? `
      <button onclick="copiaMessaggioBachecaWhatsApp(\`${msg.testo.replace(/`/g, '\\`')}\`)" title="Copia per WhatsApp" class="text-emerald-600 hover:text-emerald-700 transition-colors p-1 flex items-center gap-1 text-[11px] font-bold bg-emerald-50 px-2 py-1 rounded-lg">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
        Copia WA
      </button>
    ` : '';

    const btnElimina = isAdmin ? `
      <button onclick="eliminaMessaggio('${msg.id}')" title="Elimina messaggio" class="text-slate-300 hover:text-rose-500 transition-colors p-1">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
      </button>
    ` : '';

    html += `
      <div id="msg-${msg.id}" class="${cardClass}">
        <div class="text-[10px] font-bold text-slate-400 mb-2 flex justify-between items-center border-b border-slate-50 pb-1.5">
          <div class="flex items-center gap-2">
            <span class="flex items-center gap-1.5 text-burgundy font-black">
              <span class="w-2 h-2 rounded-full bg-burgundy"></span> Admin
            </span>
            ${isLatest ? '<span class="bg-burgundy text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Nuovo</span>' : ''}
          </div>
          <div class="flex items-center gap-2">
            <span>${dateObj.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
            ${btnWhatsApp}
            ${btnElimina}
          </div>
        </div>
        <div class="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed mb-3 select-text">${msg.testo}</div>
        
        <div class="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
          ${reazioniHtml}
        </div>

        ${sezioneLettureAdmin}
      </div>
    `;
  });

  container.innerHTML = html;

  // --- GESTIONE AUTOMATICA SCROLL (COMPORTAMENTO APP DI MESSAGGISTICA) ---
  setTimeout(() => {
    const targetNonLetto = document.getElementById('primo-messaggio-non-letto');
    if (targetNonLetto) {
      // Se ci sono messaggi non letti, posiziona lo scroll esattamente sopra il separatore "Messaggi non letti"
      targetNonLetto.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Se sono stati letti tutti, porta la visuale direttamente in fondo (sull'ultimo messaggio ricevuto)
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  }, 100);

  if (currentUser && messaggi.length > 0) {
    const lettureBulk = messaggi.map(msg => ({
      id_messaggio: msg.id,
      nome_utente: currentUser
    }));
    await db.from('letture_messaggi').upsert(lettureBulk, { onConflict: 'id_messaggio,nome_utente' });
  }
}

// Funzione per toggle delle reazioni
async function toggleReazioneMessaggio(idMessaggio, emoji) {
  if (!currentUser) return mostraAlert("Devi effettuare il login per reagire.");

  const { data: esistente } = await db.from('reazioni_messaggi')
    .select('*')
    .eq('id_messaggio', idMessaggio)
    .eq('nome_utente', currentUser)
    .eq('emoji', emoji);

  if (esistente && esistente.length > 0) {
    // Rimuovi reazione se già presente
    await db.from('reazioni_messaggi')
      .delete()
      .eq('id_messaggio', idMessaggio)
      .eq('nome_utente', currentUser)
      .eq('emoji', emoji);
  } else {
    // Aggiungi reazione
    await db.from('reazioni_messaggi')
      .insert([{ id_messaggio: idMessaggio, nome_utente: currentUser, emoji }]);
  }

  caricaMessaggi();
}

// Toggle dettagli lettura per l'Admin
function toggleDettagliLettura(id) {
  const el = document.getElementById(`read-details-${id}`);
  const icon = document.getElementById(`icon-read-${id}`);
  if (el) {
    el.classList.toggle('hidden');
    icon.innerText = el.classList.contains('hidden') ? '▼' : '▲';
  }
}

async function eliminaMessaggio(idMessaggio) {
  const confermato = await mostraConfirm("Vuoi davvero eliminare questo messaggio dalla bacheca?");
  if (!confermato) return;

  const { error } = await db.from('messaggi').delete().eq('id', idMessaggio);
  if (error) return mostraAlert("Impossibile eliminare il messaggio: " + error.message);

  await caricaMessaggi();
  await aggiornaBadgeMessaggi();
}

let unplayedMatchesCache = [];

// -------------------------------------------------------------
// INIZIALIZZAZIONE PICKERS E TENDINE CUSTOM
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', function() {
  if (typeof caricaFasi === 'function') caricaFasi();

  const configData = {
    locale: "it",
    dateFormat: "Y-m-d", 
    altInput: true,      
    altFormat: "d/m/Y",
    disableMobile: true
  };

  const configOra = {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    disableMobile: true,
    minuteIncrement: 5
  };

  if (document.getElementById('admin-torneo-data')) flatpickr("#admin-torneo-data", configData);
  if (document.getElementById('admin-torneo-ora')) flatpickr("#admin-torneo-ora", configOra);

  if (document.getElementById('admin-data')) flatpickr("#admin-data", configData);
  if (document.getElementById('admin-ora')) flatpickr("#admin-ora", configOra);

  if (document.getElementById('custom-data')) flatpickr("#custom-data", configData);
});

function toggleCustomSelect(selectId) {
  const optionsContainer = document.getElementById(`options-${selectId}`);
  document.querySelectorAll('.custom-select-options').forEach(el => {
    if (el.id !== `options-${selectId}`) el.classList.add('hidden');
  });
  if (optionsContainer) optionsContainer.classList.toggle('hidden');
}

function selezionaOpzione(selectId, valore, testo) {
  const displayEl = document.getElementById(`display-${selectId}`);
  if (displayEl) {
    displayEl.innerText = testo;
    displayEl.classList.remove('text-slate-400');
    displayEl.classList.add('text-slate-800', 'font-bold');
  }
  
  if (document.getElementById(selectId)) document.getElementById(selectId).value = valore;
  const optionsContainer = document.getElementById(`options-${selectId}`);
  if (optionsContainer) optionsContainer.classList.add('hidden');

  if (selectId === 'admin-torneo-select-partita') {
    autoCompilaDaCalendario(valore);
  }
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.custom-select-wrapper')) {
    document.querySelectorAll('.custom-select-options, [id^="menu-fasi-"]').forEach(el => el.classList.add('hidden'));
  }
});

// -------------------------------------------------------------
// MODALI PARTITE, CLASSIFICA E SONDAGGI
// -------------------------------------------------------------

// Calcolo automatico giornata e gestione squadre senza Darsenal
async function apriModalPartitaTorneo() {
  if (!window.faseAttivaId) {
    return mostraAlert("Crea o seleziona prima una fase!");
  }

  const { count } = await db.from('calendario_torneo').select('*', { count: 'exact', head: true }).eq('fase_torneo', window.faseAttivaId);
  const prossimaGiornata = (count || 0) + 1;
  const inputGiornata = document.getElementById('admin-torneo-giornata');
  if (inputGiornata) {
    inputGiornata.value = `GIORNATA ${prossimaGiornata}`;
  }

  if (document.getElementById('admin-torneo-data')) document.getElementById('admin-torneo-data')._flatpickr?.clear();
  if (document.getElementById('admin-torneo-ora')) document.getElementById('admin-torneo-ora')._flatpickr?.clear();
  if (document.getElementById('admin-torneo-luogo')) document.getElementById('admin-torneo-luogo').value = '';
  
  ['admin-torneo-casa', 'admin-torneo-trasferta'].forEach(id => {
    const el = document.getElementById(`display-${id}`);
    if(el) {
      el.innerText = id.includes('casa') ? 'Squadra Casa...' : 'Squadra Trasferta...';
      el.className = 'text-slate-400';
    }
    if (document.getElementById(id)) document.getElementById(id).value = '';
  });

  const { data: classifica, error } = await db.from('classifica').select('squadra').order('squadra');
  if (!error && classifica) {
    const squadreAvversarie = classifica.filter(c => c.squadra.toLowerCase() !== 'darsenal');
    const optionsSquadre = squadreAvversarie.map(c => {
      const sq = c.squadra.replace(/'/g, "\\'");
      return `<div onclick="selezionaSquadraTorneo('NOME_SELECT', '${sq}')" class="p-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-b-0 transition-colors">${c.squadra}</div>`;
    }).join('');
    
    if (document.getElementById('options-admin-torneo-casa')) 
      document.getElementById('options-admin-torneo-casa').innerHTML = optionsSquadre.replace(/NOME_SELECT/g, 'admin-torneo-casa');
    if (document.getElementById('options-admin-torneo-trasferta')) 
      document.getElementById('options-admin-torneo-trasferta').innerHTML = optionsSquadre.replace(/NOME_SELECT/g, 'admin-torneo-trasferta');
  }

  document.getElementById('partita-torneo-modal')?.classList.remove('hidden');
}

window.selezionaSquadraTorneo = function(selectId, squadraScelta) {
  document.getElementById(selectId).value = squadraScelta;
  const dispEl = document.getElementById(`display-${selectId}`);
  if (dispEl) {
    dispEl.innerText = squadraScelta;
    dispEl.classList.remove('text-slate-400');
    dispEl.classList.add('text-slate-800', 'font-bold');
  }
  document.getElementById(`options-${selectId}`).classList.add('hidden');

  // Posiziona automaticamente "Darsenal" nella sezione opposta
  if (selectId === 'admin-torneo-casa') {
    document.getElementById('admin-torneo-trasferta').value = 'Darsenal';
    const dispTrasf = document.getElementById('display-admin-torneo-trasferta');
    if (dispTrasf) {
      dispTrasf.innerText = 'Darsenal';
      dispTrasf.classList.remove('text-slate-400');
      dispTrasf.classList.add('text-slate-800', 'font-bold');
    }
  } else if (selectId === 'admin-torneo-trasferta') {
    document.getElementById('admin-torneo-casa').value = 'Darsenal';
    const dispCasa = document.getElementById('display-admin-torneo-casa');
    if (dispCasa) {
      dispCasa.innerText = 'Darsenal';
      dispCasa.classList.remove('text-slate-400');
      dispCasa.classList.add('text-slate-800', 'font-bold');
    }
  }
};

function autoCompilaDaCalendario(partitaId) {
  if (!partitaId) {
     if (document.getElementById('admin-torneo-giornata')) document.getElementById('admin-torneo-giornata').value = '';
     
     ['admin-torneo-casa', 'admin-torneo-trasferta'].forEach(id => {
       const el = document.getElementById(`display-${id}`);
       if(el) {
         el.innerText = id.includes('casa') ? 'Squadra Casa...' : 'Squadra Trasferta...';
         el.className = 'text-slate-400';
       }
       if (document.getElementById(id)) document.getElementById(id).value = '';
     });
     
     if (document.getElementById('admin-torneo-data')) document.getElementById('admin-torneo-data')._flatpickr?.clear();
     if (document.getElementById('admin-torneo-ora')) document.getElementById('admin-torneo-ora')._flatpickr?.clear();
     if (document.getElementById('admin-torneo-luogo')) document.getElementById('admin-torneo-luogo').value = '';
     return;
  }

  if (!unplayedMatchesCache) return;
  const match = unplayedMatchesCache.find(p => p.id == partitaId);
  if (!match) return;

  if (document.getElementById('admin-torneo-giornata')) document.getElementById('admin-torneo-giornata').value = match.giornata || '';
  
  if (match.squadra_casa) {
    document.getElementById('admin-torneo-casa').value = match.squadra_casa;
    const dispCasa = document.getElementById('display-admin-torneo-casa');
    if(dispCasa) { dispCasa.innerText = match.squadra_casa; dispCasa.className = 'text-slate-800 font-bold'; }
  }
  if (match.squadra_trasferta) {
    document.getElementById('admin-torneo-trasferta').value = match.squadra_trasferta;
    const dispTrasf = document.getElementById('display-admin-torneo-trasferta');
    if(dispTrasf) { dispTrasf.innerText = match.squadra_trasferta; dispTrasf.className = 'text-slate-800 font-bold'; }
  }

  if (match.data_ora) {
    const d = new Date(match.data_ora);
    const anno = d.getFullYear();
    const mese = String(d.getMonth() + 1).padStart(2, '0');
    const giorno = String(d.getDate()).padStart(2, '0');
    const dataLocaleISO = `${anno}-${mese}-${giorno}`;
    
    const oraStr = d.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
    
    const dateInput = document.getElementById('admin-torneo-data');
    if (dateInput && dateInput._flatpickr) dateInput._flatpickr.setDate(dataLocaleISO);
    else if (dateInput) dateInput.value = dataLocaleISO;

    const timeInput = document.getElementById('admin-torneo-ora');
    if (timeInput && timeInput._flatpickr) timeInput._flatpickr.setDate(oraStr);
    else if (timeInput) timeInput.value = oraStr;
  }
  
  if (document.getElementById('admin-torneo-luogo') && match.luogo) {
    document.getElementById('admin-torneo-luogo').value = match.luogo;
  }
}

function chiudiModalPartitaTorneo() { 
  document.getElementById('partita-torneo-modal')?.classList.add('hidden'); 
}

function apriModalGestioneClassifica() { 
  window.squadraInModifica = null;
  const sqInput = document.getElementById('admin-classifica-squadra');
  if (sqInput) {
    sqInput.value = '';
    sqInput.readOnly = false;
  }
  if (document.getElementById('admin-classifica-punti')) document.getElementById('admin-classifica-punti').value = '0'; 
  if (document.getElementById('admin-classifica-punti-add')) document.getElementById('admin-classifica-punti-add').value = '';
  if (document.getElementById('admin-classifica-dr')) document.getElementById('admin-classifica-dr').value = '0';
  if (document.getElementById('admin-classifica-giocate')) document.getElementById('admin-classifica-giocate').value = '0';
  document.getElementById('classifica-modal')?.classList.remove('hidden'); 
}

function apriModalModificaSquadra(id, squadra, punti, dr, giocate) {
  window.squadraInModifica = id;
  
  const sqInput = document.getElementById('admin-classifica-squadra');
  if (sqInput) {
    sqInput.value = squadra;
    sqInput.readOnly = false;
  }
  if (document.getElementById('admin-classifica-punti')) document.getElementById('admin-classifica-punti').value = punti ?? 0; 
  if (document.getElementById('admin-classifica-punti-add')) document.getElementById('admin-classifica-punti-add').value = '';
  if (document.getElementById('admin-classifica-dr')) document.getElementById('admin-classifica-dr').value = dr ?? 0;
  if (document.getElementById('admin-classifica-giocate')) document.getElementById('admin-classifica-giocate').value = giocate ?? 0;
  
  document.getElementById('classifica-modal')?.classList.remove('hidden');
}

function chiudiModalGestioneClassifica() { 
  document.getElementById('classifica-modal')?.classList.add('hidden'); 
  window.squadraInModifica = null;
}

function apriModalAmichevole() {
  document.getElementById('amichevole-modal')?.classList.remove('hidden');
}

function chiudiModalAmichevole() {
  document.getElementById('amichevole-modal')?.classList.add('hidden');
  if (document.getElementById('admin-avversario')) document.getElementById('admin-avversario').value = '';
  if (document.getElementById('admin-data')) document.getElementById('admin-data')._flatpickr?.clear();
  if (document.getElementById('admin-ora')) document.getElementById('admin-ora')._flatpickr?.clear();
  if (document.getElementById('admin-luogo')) document.getElementById('admin-luogo').value = '';
}

function apriModalNuovoMessaggio() {
  document.getElementById('modal-nuovo-messaggio')?.classList.remove('hidden');
}

function chiudiModalNuovoMessaggio() {
  document.getElementById('modal-nuovo-messaggio')?.classList.add('hidden');
  if (document.getElementById('msg-testo')) document.getElementById('msg-testo').value = '';
}

async function inviaMessaggio() {
  const el = document.getElementById('msg-testo');
  const testo = el ? el.value.trim() : '';
  if (!testo) return mostraAlert("Inserisci il testo del messaggio.");

  const { error } = await db.from('messaggi').insert([{ testo }]);
  if (error) return mostraAlert("Errore durante l'invio del messaggio: " + error.message);

  chiudiModalNuovoMessaggio();
  await caricaMessaggi();
  await aggiornaBadgeMessaggi();
}
// Gestione Modale Sondaggio Torneo da Calendario
async function apriModalSondaggioTorneo() {
  const selectContainer = document.getElementById('options-admin-sondaggio-torneo-id');
  const displayEl = document.getElementById('display-admin-sondaggio-torneo-id');
  const inputHidden = document.getElementById('admin-sondaggio-torneo-id');
  
  if (displayEl) {
    displayEl.innerText = 'Seleziona giornata...';
    displayEl.className = 'text-slate-400 truncate pr-2 text-xs';
  }
  if (inputHidden) inputHidden.value = '';

  if (selectContainer) {
    selectContainer.innerHTML = '<div class="p-3 text-xs text-slate-500 text-center">Caricamento giornate...</div>';
    
    const adesso = new Date().toISOString();
    
    // Recupera solo le partite future della fase attiva che non sono completate e senza risultato inserito
    const { data: partiteFuture, error } = await db
      .from('calendario_torneo')
      .select('*')
      .gte('data_ora', adesso)
      .is('completata', false)
      .order('data_ora', { ascending: true });

    if (error) {
      selectContainer.innerHTML = '<div class="p-3 text-xs text-rose-500 text-center">Errore nel caricamento del calendario.</div>';
      return;
    }

    const unplayed = (partiteFuture || []).filter(p => !p.risultato);

    if (unplayed.length > 0) {
      selectContainer.innerHTML = unplayed.map(p => {
        const d = new Date(p.data_ora);
        const dataStr = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const etichettaGiornata = p.giornata ? p.giornata.toUpperCase() : 'PARTITA';
        const testoOpzione = `${etichettaGiornata}: ${p.squadra_casa} vs ${p.squadra_trasferta}`;
        const escapedTesto = testoOpzione.replace(/'/g, "\\'");
        
        return `
          <div onclick="selezionaOpzioneSondaggioTorneo('${p.id}', '${escapedTesto} (${dataStr})')" class="p-3 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-b-0">
            <span class="font-bold text-burgundy block">${etichettaGiornata}</span>
            <span class="font-semibold text-slate-800 block">${p.squadra_casa} vs ${p.squadra_trasferta}</span>
            <span class="text-[10px] text-slate-400">${dataStr} | ${p.luogo || 'Campo Sportivo'}</span>
          </div>
        `;
      }).join('');
    } else {
      selectContainer.innerHTML = '<div class="p-3 text-xs text-slate-400 italic text-center">Nessuna partita da giocare disponibile.</div>';
    }
  }

  document.getElementById('sondaggio-torneo-modal')?.classList.remove('hidden');
}

async function salvaSondaggioTorneoDaCalendario() {
  const matchId = document.getElementById('admin-sondaggio-torneo-id').value;
  if (!matchId) return mostraAlert("Seleziona prima una giornata dal menu a tendina!");

  const { data: match, error } = await db.from('calendario_torneo').select('*').eq('id', matchId).single();
  if (error || !match) return mostraAlert("Partita non trovata nel calendario.");

  // Determina la squadra avversaria rispetto al Darsenal
  const avversario = match.squadra_casa.toLowerCase().includes('darsenal') ? match.squadra_trasferta : match.squadra_casa;

  const { error: errIns } = await db.from('partite').insert([{
    squadra_avversaria: avversario,
    data_ora: match.data_ora,
    luogo: match.luogo || 'Campo Sportivo',
    tipo_sondaggio: 'torneo'
  }]);

  if (errIns) return mostraAlert("Errore durante la creazione del sondaggio: " + errIns.message);

  chiudiModalSondaggioTorneo();
  caricaSondaggi();
}
function apriModalSondaggioCustom() {
  document.getElementById('modal-nuovo-sondaggio-custom')?.classList.remove('hidden');
}

function chiudiModalSondaggioCustom() {
  document.getElementById('modal-nuovo-sondaggio-custom')?.classList.add('hidden');
  if (document.getElementById('custom-titolo')) document.getElementById('custom-titolo').value = '';
  if (document.getElementById('custom-descrizione')) document.getElementById('custom-descrizione').value = '';
  if (document.getElementById('custom-data')) document.getElementById('custom-data')._flatpickr?.clear();
  if (document.getElementById('custom-opzioni')) document.getElementById('custom-opzioni').value = '';
  if (document.getElementById('custom-max-scelte')) {
    document.getElementById('custom-max-scelte').value = '99';
    const disp = document.getElementById('display-custom-max-scelte');
    if (disp) {
      disp.innerText = 'Scelta Multipla';
      disp.classList.remove('text-slate-400');
      disp.classList.add('text-slate-800', 'font-bold');
    }
  }
}

async function creaSondaggioCustom() {
  const titolo = document.getElementById('custom-titolo')?.value.trim();
  const descrizione = document.getElementById('custom-descrizione')?.value.trim();
  const data = document.getElementById('custom-data')?.value;
  const opzioniRaw = document.getElementById('custom-opzioni')?.value;
  const maxScelte = parseInt(document.getElementById('custom-max-scelte')?.value || '1', 10);

  if (!titolo || !data || !opzioniRaw) {
    return mostraAlert("Compila i campi obbligatori (Titolo, Data Scadenza e Opzioni).");
  }

  const opzioni = opzioniRaw.split(',').map(o => o.trim()).filter(o => o.length > 0);
  if (opzioni.length < 2) {
    return mostraAlert("Inserisci almeno 2 opzioni separate da virgola.");
  }

  const dataOraISO = new Date(`${data}T23:59:59`).toISOString();

  const { error } = await db.from('partite').insert([{
    squadra_avversaria: titolo,
    descrizione_sondaggio: descrizione,
    data_ora: dataOraISO,
    tipo_sondaggio: 'disponibilita',
    opzioni_sondaggio: opzioni,
    max_scelte: maxScelte
  }]);

  if (error) return mostraAlert("Errore durante la creazione del sondaggio: " + error.message);

  chiudiModalSondaggioCustom();
  if (typeof caricaSondaggi === 'function') caricaSondaggi();
}

function selezionaOpzioneSondaggioTorneo(idPartita, testo) {
  document.getElementById('admin-sondaggio-torneo-id').value = idPartita;
  const displayEl = document.getElementById('display-admin-sondaggio-torneo-id');
  if (displayEl) {
    displayEl.innerText = testo;
    displayEl.classList.remove('text-slate-400');
    displayEl.classList.add('text-slate-800', 'font-bold');
  }
  document.getElementById('options-admin-sondaggio-torneo-id').classList.add('hidden');
}

function chiudiModalSondaggioTorneo() {
  document.getElementById('sondaggio-torneo-modal')?.classList.add('hidden');
}


// -------------------------------------------------------------
// MENÙ LATERALE UTENTE & STATISTICHE
// -------------------------------------------------------------

function apriMenuUtente() {
  const overlay = document.getElementById('overlay-menu');
  const menu = document.getElementById('side-menu');
  
  if (overlay && menu) {
    overlay.classList.remove('hidden');
    setTimeout(() => {
      menu.classList.remove('-translate-x-full');
    }, 10);
  }

  const utenteLoggato = window.currentUser || localStorage.getItem('utente_nome');
  if (utenteLoggato) {
    caricaStatisticheUtente(utenteLoggato);
  }
}
window.apriMenuUtente = apriMenuUtente;

function chiudiMenuUtente() {
  const overlay = document.getElementById('overlay-menu');
  const menu = document.getElementById('side-menu');
  
  if (menu) menu.classList.add('-translate-x-full');
  setTimeout(() => {
    if (overlay) overlay.classList.add('hidden');
  }, 300);
}

function getIniziali(nomeCompleto) {
  if (!nomeCompleto) return "--";
  const parole = nomeCompleto.trim().split(" ");
  if (parole.length === 1) return parole[0].substring(0, 2).toUpperCase();
  return (parole[0][0] + parole[parole.length - 1][0]).toUpperCase();
}


async function copiaMessaggioBachecaWhatsApp(testoMessaggio) {
  if (!testoMessaggio) return;

  let anteprima = testoMessaggio.trim();
  if (anteprima.length > 90) {
    anteprima = anteprima.substring(0, 90) + '...';
  }

  const testoWA = `📢 *COMUNICAZIONE DARSENAL* 🔴⚽\n\n${anteprima}\n\n🔗 Leggi tutto sull'app:\nhttps://darsenal-info.netlify.app/`;

  try {
    await navigator.clipboard.writeText(testoWA);
    await mostraAlert("Anteprima del messaggio copiata negli appunti!", "Copiato");
  } catch (err) {
    console.error("Errore copia messaggio:", err);
  }
}

// -------------------------------------------------------------
// GESTIONE FASI DINAMICHE TORNEO
// -------------------------------------------------------------

window.faseAttivaId = null;

window.toggleMenuFasi = function(sezione, event) {
  if (event) event.stopPropagation();

  const menu = document.getElementById(`menu-fasi-${sezione}`);
  
  document.querySelectorAll('.custom-select-options, [id^="menu-fasi-"]').forEach(el => {
    if (el.id !== `menu-fasi-${sezione}`) el.classList.add('hidden');
  });
  
  if (menu) menu.classList.toggle('hidden');
};

window.selezionaFase = function(id, nome, sezione) {
  window.faseAttivaId = id;

  localStorage.setItem('darsenal_fase_attiva_id', id);
  
  const displayPartite = document.getElementById('display-fase-corrente-partite');
  const displayClassifica = document.getElementById('display-fase-corrente-classifica');
  
  if (displayPartite) displayPartite.innerText = nome;
  if (displayClassifica) displayClassifica.innerText = nome;

  const menu = document.getElementById(`menu-fasi-${sezione}`);
  if (menu) menu.classList.add('hidden');

  if (sezione === 'partite' && typeof caricaPartite === 'function') caricaPartite();
  if (sezione === 'classifica' && typeof caricaClassifica === 'function') caricaClassifica();
};

// Inizio file ui_7.js (o dove è definita)
window.faseAttivaId = localStorage.getItem('darsenal_fase_attiva_id') || null;

window.caricaFasi = async function() {
  const { data: fasi } = await db.from('fasi_torneo').select('*').order('created_at', { ascending: true });
  const fasiDb = fasi || [];

  const displayPartite = document.getElementById('display-fase-corrente-partite');
  const displayClassifica = document.getElementById('display-fase-corrente-classifica');

  if (fasiDb.length === 0) {
    window.faseAttivaId = null;
    localStorage.removeItem('darsenal_fase_attiva_id');
    if (displayPartite) displayPartite.innerText = "Nessuna Fase";
    if (displayClassifica) displayClassifica.innerText = "Nessuna Fase";
    window.renderListaFasi([], 'partite');
    window.renderListaFasi([], 'classifica');
    return;
  }

  // RIPRISTINO FASE SALVATA
  const salvataId = localStorage.getItem('darsenal_fase_attiva_id');
  const esisteSalvata = fasiDb.find(f => f.id === salvataId);

  if (esisteSalvata) {
    window.faseAttivaId = salvataId;
  } else {
    window.faseAttivaId = fasiDb[0].id;
    localStorage.setItem('darsenal_fase_attiva_id', window.faseAttivaId);
  }

  const faseCorrente = fasiDb.find(f => f.id === window.faseAttivaId);
  const nomeFaseAttiva = faseCorrente ? faseCorrente.nome : "Nessuna Fase";

  if (displayPartite) displayPartite.innerText = nomeFaseAttiva;
  if (displayClassifica) displayClassifica.innerText = nomeFaseAttiva;

  window.renderListaFasi(fasiDb, 'partite');
  const gironiClassifica = fasiDb.filter(f => !f.eliminazione_diretta);
  window.renderListaFasi(gironiClassifica, 'classifica');
};

window.renderListaFasi = function(fasi, sezione) {
  const container = document.getElementById(`lista-fasi-${sezione}`);
  const btnCrea = document.getElementById(`btn-crea-fase-${sezione}`);
  
  if (!container) return;

  if (btnCrea) {
    (typeof isAdmin !== 'undefined' && isAdmin) 
      ? btnCrea.classList.remove('hidden') 
      : btnCrea.classList.add('hidden');
  }

  if (!fasi || fasi.length === 0) {
    container.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center italic">Ancora nessuna info sul torneo</div>`;
    return;
  }

  container.innerHTML = fasi.map(fase => {
    const adminControls = (typeof isAdmin !== 'undefined' && isAdmin) ? `
      <div class="flex items-center gap-1 pr-3">
        <button onclick="modificaNomeFase('${fase.id}', '${fase.nome.replace(/'/g, "\\'")}', event)" class="p-1.5 text-slate-300 hover:text-emerald-500 transition-colors" title="Rinomina">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
        </button>
        <button onclick="eliminaFase('${fase.id}', event)" class="p-1.5 text-slate-300 hover:text-rose-600 transition-colors" title="Elimina">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
    ` : '';

    return `
      <div class="flex items-center justify-between border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
        <div onclick="selezionaFase('${fase.id}', '${fase.nome.replace(/'/g, "\\'")}', '${sezione}')" class="flex-1 p-3 text-xs font-semibold text-slate-700 cursor-pointer truncate">
          ${fase.nome}
        </div>
        ${adminControls}
      </div>
    `;
  }).join('');
};

window.apriModalNuovaFase = function() {
  const modal = document.getElementById('nuova-fase-modal');
  if (modal) modal.classList.remove('hidden');
  const inputNome = document.getElementById('input-nome-fase');
  if (inputNome) inputNome.value = '';
  const inputTipo = document.getElementById('input-tipo-fase');
  if (inputTipo) inputTipo.checked = false;
};

window.chiudiModalNuovaFase = function() {
  const modal = document.getElementById('nuova-fase-modal');
  if (modal) modal.classList.add('hidden');
};

window.salvaNuovaFase = async function() {
  const inputNome = document.getElementById('input-nome-fase');
  const inputTipo = document.getElementById('input-tipo-fase');
  const nome = inputNome ? inputNome.value.trim() : '';
  const eliminazioneDiretta = inputTipo ? inputTipo.checked : false;

  if (!nome) return mostraAlert("Inserisci il nome della fase!");

  const { data, error } = await db.from('fasi_torneo').insert([{
    nome: nome,
    eliminazione_diretta: eliminazioneDiretta
  }]).select();

  if (error) return mostraAlert("Errore durante il salvataggio della nuova fase.");

  if (data && data.length > 0) {
    window.faseAttivaId = data[0].id;
  }

  chiudiModalNuovaFase();
  await caricaFasi();
  if (typeof caricaPartite === 'function') caricaPartite();
  if (typeof caricaClassifica === 'function') caricaClassifica();
};

window.modificaNomeFase = function(id, nomeAttuale, event) {
  if (event) event.stopPropagation();
  
  const modal = document.getElementById('modifica-fase-modal');
  const inputId = document.getElementById('input-modifica-fase-id');
  const inputNome = document.getElementById('input-modifica-fase-nome');

  if (modal && inputId && inputNome) {
    inputId.value = id;
    inputNome.value = nomeAttuale;
    modal.classList.remove('hidden');
  }
};

window.chiudiModalModificaFase = function() {
  const modal = document.getElementById('modifica-fase-modal');
  if (modal) modal.classList.add('hidden');
};

window.salvaModificaFase = async function() {
  const id = document.getElementById('input-modifica-fase-id')?.value;
  const nuovoNome = document.getElementById('input-modifica-fase-nome')?.value.trim();

  if (!id || !nuovoNome) {
    return mostraAlert("Inserisci un nome valido per la fase.");
  }

  const { error } = await db.from('fasi_torneo').update({ nome: nuovoNome }).eq('id', id);
  if (error) {
    return mostraAlert("Errore durante l'aggiornamento della fase.");
  }

  chiudiModalModificaFase();
  await caricaFasi();

  if (typeof caricaPartite === 'function') caricaPartite();
  if (typeof caricaClassifica === 'function') caricaClassifica();
};

window.eliminaFase = async function(id, event) {
  if (event) event.stopPropagation();
  const confermato = await mostraConfirm("Sei sicuro di voler eliminare questa fase e tutti i dati associati?");
  if (!confermato) return;

  const { error } = await db.from('fasi_torneo').delete().eq('id', id);
  if (error) return mostraAlert("Errore durante l'eliminazione della fase.");

  if (window.faseAttivaId === id) {
    window.faseAttivaId = null;
  }

  await caricaFasi();
  if (typeof caricaPartite === 'function') caricaPartite();
  if (typeof caricaClassifica === 'function') caricaClassifica();
};



let messaggioIdCorrenteReazione = null;
let emojiCorrenteReazione = null;

window.apriModalDettaglioReazione = function(idMessaggio, emoji) {
  messaggioIdCorrenteReazione = idMessaggio;
  emojiCorrenteReazione = emoji;

  const modal = document.getElementById('modal-dettaglio-reazione');
  const emojiEl = document.getElementById('modal-reazione-emoji');
  const countEl = document.getElementById('modal-reazione-count');
  const listEl = document.getElementById('modal-reazione-utenti-list');
  const btnToggle = document.getElementById('modal-reazione-btn-toggle');

  if (!modal) return;

  // Recupera le reazioni aggiornate
  db.from('reazioni_messaggi').select('*').eq('id_messaggio', idMessaggio).eq('emoji', emoji).then(({ data: reazioni }) => {
    const lista = reazioni || [];
    emojiEl.innerText = emoji;
    countEl.innerText = `${lista.length} voti`;

    if (lista.length === 0) {
      listEl.innerHTML = `<div class="text-slate-400 italic text-center py-2 text-[11px]">Nessuna reazione con ${emoji}</div>`;
    } else {
      listEl.innerHTML = lista.map(r => `
        <div class="flex items-center gap-2 p-1.5 bg-slate-50 rounded-lg">
          <span class="w-2 h-2 rounded-full bg-burgundy"></span>
          <span class="capitalize font-bold text-slate-800">${r.nome_utente}</span>
        </div>
      `).join('');
    }

    const haGiaVotato = currentUser && lista.some(r => r.nome_utente?.toLowerCase() === currentUser?.toLowerCase());
    btnToggle.innerText = haGiaVotato ? `Rimuovi ${emoji}` : `Aggiungi ${emoji}`;
    modal.classList.remove('hidden');
  });
};

window.toggleReazioneCorrenteDallaModal = async function() {
  if (!messaggioIdCorrenteReazione || !emojiCorrenteReazione) return;
  await toggleReazioneMessaggio(messaggioIdCorrenteReazione, emojiCorrenteReazione);
  document.getElementById('modal-dettaglio-reazione').classList.add('hidden');
};

async function inviaMessaggioDaBarraWhatsApp() {
  const inputEl = document.getElementById('whatsapp-input-msg');
  if (!inputEl) return;
  const testo = inputEl.value.trim();
  if (!testo) return mostraAlert("Scrivi un testo per il messaggio.");

  const { error } = await db.from('messaggi').insert([{ testo }]);
  if (error) return mostraAlert("Errore durante l'invio: " + error.message);

  inputEl.value = '';
  await caricaMessaggi();
  await aggiornaBadgeMessaggi();
}

// All'interno di switchTab(tabName), gestisci la visibilità della barra WhatsApp:
async function switchTab(tabName) {
  if ((tabName === 'sondaggi' || tabName === 'messaggi') && !currentUser) {
    const loginModal = document.getElementById('login-modal');
    if (loginModal) loginModal.classList.remove('hidden');
    return;
  }

  localStorage.setItem('darsenal_active_tab', tabName);

  ['partite', 'classifica', 'sondaggi', 'saldo', 'messaggi', 'formazione', 'giocatori'].forEach(t => {
    const el = document.getElementById(`view-${t}`);
    if (el) el.classList.add('hidden');
  });

  ['partite', 'classifica', 'sondaggi', 'giocatori', 'formazione', 'messaggi', 'saldo'].forEach(t => {
    const navBtn = document.getElementById(`nav-${t}`);
    if (navBtn) {
      navBtn.classList.remove('text-burgundy');
      navBtn.classList.add('text-slate-400');
    }
  });

  const viewEl = document.getElementById(`view-${tabName}`);
  if (viewEl) viewEl.classList.remove('hidden');

  // Mostra la barra WhatsApp dell'admin solo se siamo nella tab messaggi ed è admin
  const whatsappBar = document.getElementById('admin-whatsapp-bar');
  if (whatsappBar) {
    if (tabName === 'messaggi' && typeof isAdmin !== 'undefined' && isAdmin) {
      whatsappBar.classList.remove('hidden');
    } else {
      whatsappBar.classList.add('hidden');
    }
  }

  if (tabName !== 'messaggi') {
    const activeBtn = document.getElementById(`nav-${tabName}`);
    if (activeBtn) {
      activeBtn.classList.add('text-burgundy');
      activeBtn.classList.remove('text-slate-400');
    }
  }

  if (tabName === 'partite') {
    if (typeof caricaFasi === 'function') caricaFasi();
    if (typeof caricaPartite === 'function') caricaPartite();
  }
  if (tabName === 'classifica') {
    if (typeof caricaFasi === 'function') caricaFasi();
    if (typeof caricaClassifica === 'function') caricaClassifica();
  }
  if (tabName === 'sondaggi' && typeof caricaSondaggi === 'function') caricaSondaggi();
  if (tabName === 'messaggi') {
    await caricaMessaggi();
    aggiornaBadgeMessaggi();
  }
}

document.addEventListener('input', function (e) {
  if (e.target && e.target.id === 'whatsapp-input-msg') {
    e.target.style.height = 'auto';
    e.target.style.height = (e.target.scrollHeight) + 'px';
  }
});