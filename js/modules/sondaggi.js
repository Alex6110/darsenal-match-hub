// Helper per sanificare stringhe da inserire negli attributi HTML
function escapeHtmlAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;');
}

let categoriaAttivaSondaggi = 'torneo';

function cambiaCategoriaSondaggi(categoria) {
  categoriaAttivaSondaggi = categoria;
  aggiornaPannelloAdminSondaggi();
  caricaSondaggi();
}

function aggiornaPannelloAdminSondaggi() {
  const panel = document.getElementById('admin-panel');
  if (!panel) return;

  if (typeof isAdmin === 'undefined' || !isAdmin) {
    panel.classList.add('hidden');
    panel.innerHTML = '';
    return;
  }

  panel.classList.remove('hidden');

  if (categoriaAttivaSondaggi === 'amichevole') {
    panel.innerHTML = `
      <button onclick="apriModalAmichevole()" class="w-full py-2.5 bg-burgundy text-white font-bold rounded-xl text-xs shadow-md flex items-center justify-center gap-2 hover:bg-burgundy-dark transition-all">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
         Nuovo Sondaggio Amichevole
      </button>
    `;
  } else if (categoriaAttivaSondaggi === 'disponibilita') {
    panel.innerHTML = `
      <button onclick="apriModalSondaggioCustom()" class="w-full py-2.5 bg-amber-500 text-white font-bold rounded-xl text-xs shadow-md flex items-center justify-center gap-2 hover:bg-amber-600 transition-all">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
         Nuovo Sondaggio Custom / Altro
      </button>
    `;
  } else {
    panel.innerHTML = `
      <button onclick="apriModalSondaggioTorneo()" class="w-full py-2.5 bg-burgundy text-white font-bold rounded-xl text-xs shadow-md flex items-center justify-center gap-2 hover:bg-burgundy-dark transition-all">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
         Nuova Convocazione Torneo
      </button>
    `;
  }
}

async function creaSondaggioAmichevole() {
  const avversario = document.getElementById('admin-avversario').value.trim();
  const data = document.getElementById('admin-data').value;
  const ora = document.getElementById('admin-ora').value;
  const luogo = document.getElementById('admin-luogo').value.trim() || 'Campo Sportivo';

  if (!avversario || !data || !ora) return mostraAlert("Compila tutti i campi obbligatori (Squadra, Data e Ora).");

  const dataOraISO = new Date(`${data}T${ora}`).toISOString();

  const { error } = await db.from('partite').insert([{ 
    squadra_avversaria: avversario, 
    data_ora: dataOraISO, 
    luogo,
    tipo_sondaggio: 'amichevole' 
  }]);

  if (error) return mostraAlert("Impossibile salvare la partita: " + error.message);

  if (typeof chiudiModalAmichevole === 'function') chiudiModalAmichevole();
  caricaSondaggi();
}

async function eliminaSondaggio(idPartita) {
  const confermato = await mostraConfirm("Sei sicuro di voler eliminare questo sondaggio?");
  if (!confermato) return;
  
  const { error } = await db.from('partite').update({ tipo_sondaggio: 'annullato' }).eq('id', idPartita);
  if (error) return mostraAlert("Impossibile eliminare il sondaggio: " + error.message);

  caricaSondaggi();
}

async function gestisciAutomazioniSondaggi() {
  const adesso = new Date();

  // Recupera tutto il calendario ordinato cronologicamente per la fase attiva
  const { data: calendario } = await db
    .from('calendario_torneo')
    .select('*')
    .order('data_ora', { ascending: true });

  if (!calendario || calendario.length === 0) return;

  for (let i = 0; i < calendario.length; i++) {
    const partitaCorrente = calendario[i];
    const dataCorrente = new Date(partitaCorrente.data_ora);

    if (dataCorrente <= adesso) continue;

    let dataAttivazione;

    if (i === 0) {
      dataAttivazione = new Date(dataCorrente);
      dataAttivazione.setDate(dataAttivazione.getDate() - 4);
      dataAttivazione.setHours(10, 0, 0, 0);
    } else {
      const partitaPrecedente = calendario[i - 1];
      const dataPrecedente = new Date(partitaPrecedente.data_ora);
      
      dataAttivazione = new Date(dataPrecedente);
      dataAttivazione.setDate(dataAttivazione.getDate() + 1); // Il giorno dopo
      dataAttivazione.setHours(10, 0, 0, 0); // Alle 10:00
    }

    // Se abbiamo superato le 10:00 del giorno dopo l'ultima partita e il match non è iniziato
    if (adesso >= dataAttivazione && adesso < dataCorrente) {
      const avversario = partitaCorrente.squadra_casa.toLowerCase().includes('darsenal') 
        ? partitaCorrente.squadra_trasferta 
        : partitaCorrente.squadra_casa;

      // Controllo memorizzazione: verifica se esiste già per non ripetere l'inserimento
      const { data: esistente } = await db
        .from('partite')
        .select('id')
        .eq('squadra_avversaria', avversario)
        .eq('data_ora', partitaCorrente.data_ora);

      if (!esistente || esistente.length === 0) {
        await db.from('partite').insert([{
          squadra_avversaria: avversario,
          data_ora: partitaCorrente.data_ora,
          luogo: partitaCorrente.luogo || 'Campo Sportivo',
          tipo_sondaggio: 'torneo'
        }]);
        console.log(`Sondaggio creato automaticamente per la partita contro ${avversario}`);
      }
    }
  }
}

async function caricaSondaggi() {
  const container = document.getElementById('sondaggi-container');
  if (!container) return;

  if (typeof isAdmin !== 'undefined' && isAdmin) {
    try {
      await gestisciAutomazioniSondaggi();
    } catch (err) {
      console.warn("Automazione sondaggi non eseguita:", err.message);
    }
  }

  const { data: tuttePartite, error: errPartite } = await db
    .from('partite')
    .select('*')
    .order('data_ora', { ascending: true });

  if (errPartite) {
    container.innerHTML = `<div class="text-center text-xs text-rose-500 py-4">Errore caricamento sondaggi.</div>`;
    return;
  }

  const inizioOggi = new Date();
  inizioOggi.setHours(0, 0, 0, 0);

  const tuttiSondaggiFuturi = (tuttePartite || []).filter(p => new Date(p.data_ora) >= inizioOggi && p.tipo_sondaggio !== 'annullato');

  const { data: presenzeList } = await db.from('presenze').select('*');
  const tuttePresenze = presenzeList || [];

  let giocatori = GIOCATORI_MOCK;
  const { data: dbGiocatori } = await db.from('giocatori').select('*');
  if (dbGiocatori && dbGiocatori.length > 0) giocatori = dbGiocatori;

  const adesso = new Date();
  const presenzeStorichePassate = tuttePresenze.filter(pr => {
    const matchId = pr.id_partita || pr.id_sondaggio || pr.partita_id;
    const match = (tuttePartite || []).find(p => String(p.id) === String(matchId));
    if (!match || new Date(match.data_ora) > adesso) return false;
    const tipo = match.tipo_sondaggio;
    const isAmichevoleOcustom = tipo === 'amichevole' || tipo === 'disponibilita' || tipo === 'multi';
    return !isAmichevoleOcustom;
  });

  const { data: votiCustomList } = await db.from('voti_sondaggi').select('*');
  const tuttiVotiCustom = votiCustomList || [];

  aggiornaStatoTabFiltri(tuttiSondaggiFuturi, tuttePresenze, tuttiVotiCustom);
  aggiornaBadgeNavSondaggi(tuttiSondaggiFuturi, tuttePresenze, tuttiVotiCustom);

  let sondaggiVisibili = tuttiSondaggiFuturi.filter(partita => {
    if (categoriaAttivaSondaggi === 'disponibilita') {
      return partita.tipo_sondaggio === 'disponibilita' || partita.tipo_sondaggio === 'multi';
    } else if (categoriaAttivaSondaggi === 'torneo') {
      return partita.tipo_sondaggio === 'torneo' || !partita.tipo_sondaggio;
    } else {
      return partita.tipo_sondaggio === categoriaAttivaSondaggi;
    }
  });

  if (!sondaggiVisibili || sondaggiVisibili.length === 0) {
    container.innerHTML = `<div class="text-center text-xs text-slate-400 py-8 font-medium">Nessun sondaggio attivo in questa sezione.</div>`;
    return;
  }

  sondaggiVisibili.sort((a, b) => new Date(a.data_ora) - new Date(b.data_ora));

  container.innerHTML = sondaggiVisibili.map((partita) => {
    const isCustom = partita.tipo_sondaggio === 'disponibilita' || partita.tipo_sondaggio === 'multi';

    const adminDeleteBtn = (typeof isAdmin !== 'undefined' && isAdmin)
      ? `<button onclick="eliminaSondaggio('${partita.id}')" title="Elimina sondaggio" class="absolute top-4 right-4 text-slate-300 hover:text-rose-600 bg-white/80 p-1.5 rounded-full transition-colors z-10 shadow-sm"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>`
      : '';

    const dataFormatted = new Date(partita.data_ora).toLocaleString('it-IT', {
      weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });

    if (isCustom) {
      const opzioni = partita.opzioni_sondaggio || ['Opzione 1', 'Opzione 2'];
      const votiSondaggio = tuttiVotiCustom.filter(v => v.id_sondaggio === partita.id);
      const totaleVotiSondaggio = votiSondaggio.length;

      const HTMLOpzioni = opzioni.map(opzione => {
        const votiPerOpzione = votiSondaggio.filter(v => v.opzione_scelta === opzione);
        const numeroVoti = votiPerOpzione.length;
        const percentuale = totaleVotiSondaggio > 0 ? Math.round((numeroVoti / totaleVotiSondaggio) * 100) : 0;
        const hoVotatoQuesta = votiPerOpzione.some(v => v.nome_utente?.toLowerCase() === currentUser?.toLowerCase());
        const opzioneEscaped = escapeHtmlAttr(opzione);

        const iconaSelezione = hoVotatoQuesta
          ? `<div class="w-6 h-6 rounded-full bg-burgundy text-white flex items-center justify-center shrink-0 shadow-sm"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg></div>`
          : `<div class="w-6 h-6 rounded-full border-2 border-slate-300 shrink-0"></div>`;

        return `
          <div onclick="votaOpzioneCustom('${partita.id}', '${opzioneEscaped}', ${partita.max_scelte || 1})" class="cursor-pointer group relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 transition-all hover:border-burgundy/30">
            <div class="absolute top-0 left-0 bottom-0 bg-burgundy/10 transition-all duration-500 rounded-r-lg" style="width: ${percentuale}%;"></div>
            <div class="relative flex items-center justify-between gap-3 z-10">
              <div class="flex items-center gap-3">${iconaSelezione}<span class="text-sm font-bold text-slate-800">${opzione}</span></div>
              <span class="text-xs font-black text-slate-600">${numeroVoti}</span>
            </div>
          </div>`;
      }).join('');

      return `
        <div class="w-full mb-6" id="partita-${partita.id}>
          <div class="bg-white p-5 rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-400 to-burgundy"></div>
            ${adminDeleteBtn}
            <div class="flex items-center gap-2 mb-2 mt-1">
              <div class="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
                <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
              </div>
              <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">Sondaggio / Altro</span>
            </div>
            <div class="mb-4">
              <h3 class="text-lg font-black text-slate-800 tracking-tight leading-snug">${partita.squadra_avversaria || 'Sondaggio'}</h3>
              ${partita.descrizione_sondaggio ? `<p class="text-xs text-slate-500 font-medium mt-1 leading-normal">${partita.descrizione_sondaggio}</p>` : ''}
              <div class="text-[10px] font-semibold text-slate-400 mt-2 flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Scadenza: ${dataFormatted}
              </div>
            </div>
            <div class="space-y-2.5 mb-4">${HTMLOpzioni}</div>
            <button onclick="toggleVisualizzaVoti('${partita.id}')" class="w-full py-2.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5">
              <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg> Visualizza voti
            </button>
            <div id="dettaglio-voti-${partita.id}" class="hidden mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-2">
              ${opzioni.map(opzione => {
                const votanti = votiSondaggio.filter(v => v.opzione_scelta === opzione).map(v => v.nome_utente);
                return `<div class="border-b border-slate-200/60 pb-1.5 last:border-0 last:pb-0"><span class="font-bold text-slate-800">${opzione}:</span><span class="text-slate-600 font-medium ml-1">${votanti.length > 0 ? votanti.join(', ') : '<i class="text-slate-400">Nessun voto</i>'}</span></div>`;
              }).join('')}
            </div>
          </div>
        </div>`;
    }

    const presenzePartita = tuttePresenze.filter(p => p.id_partita === partita.id);
    const presenzeMap = {};
    presenzePartita.forEach(p => presenzeMap[p.nome_utente.toLowerCase()] = p.stato);

    const nonVotanti = [];
    giocatori.forEach(g => {
      const nomeCompleto = g.nome_completo || g.nome;
      if (!presenzeMap[nomeCompleto.toLowerCase()] || presenzeMap[nomeCompleto.toLowerCase()] === 'Non Votato') {
        nonVotanti.push(nomeCompleto);
      }
    });

    const presenti = presenzePartita.filter(p => p.stato === 'Presente');
    const assenti = presenzePartita.filter(p => p.stato === 'Assente');

    const haDefinitoAdmin = partita.scelte_admin && Array.isArray(partita.scelte_admin) && partita.scelte_admin.length === 12;

    let esito;
    if (haDefinitoAdmin) {
      esito = calcolaConvocazioniEParita(presenti, presenzeStorichePassate, partita.scelte_admin);
    } else if (presenti.length > 12) {
      esito = {
        convocati: presenti.map(p => p.nome_utente),
        inAttesa: [],
        inParita: [],
        haParita: true
      };
    } else {
      esito = calcolaConvocazioniEParita(presenti, presenzeStorichePassate, []);
    }

    const richiedeAzioneAdmin = isAdmin && (presenti.length > 12 || esito.haParita) && !haDefinitoAdmin;
    const effettoLampeggiante = richiedeAzioneAdmin ? 'ring-4 ring-amber-400 animate-pulse' : '';

    const btnSpareggioAdmin = richiedeAzioneAdmin
      ? `<button onclick="apriModalSpareggio('${partita.id}')" class="w-full my-3 py-3 bg-amber-500 text-white font-bold rounded-xl text-xs shadow-md flex items-center justify-center gap-2 hover:bg-amber-600 transition-all">
          <span class="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
          ⚡ Conferma Convocati 12 / Gestisci Esclusioni
        </button>`
      : '';

    const sezioneNonVotantiHtml = nonVotanti.length > 0 ? `
      <div class="text-xs border border-slate-100 rounded-xl p-2.5 bg-slate-50 mb-3">
        <button onclick="toggleDettaglioNonVotantiMatch('${partita.id}')" class="w-full flex justify-between items-center text-slate-500 font-bold hover:text-slate-800 transition-colors">
          <span class="flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>Ancora non hanno votato (${nonVotanti.length})</span>
          </span>
          <span id="icon-non-votanti-${partita.id}" class="text-xs">▼</span>
        </button>
        <div id="container-non-votanti-${partita.id}" class="hidden mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-700 font-medium">
          ${nonVotanti.join(', ')}
        </div>
      </div>
    ` : '';

    const mioVoto = presenzePartita.find(p => p.nome_utente?.toLowerCase() === currentUser?.toLowerCase());

    const btnCiSonoClass = mioVoto && mioVoto.stato === 'Presente'
      ? 'bg-emerald-500 text-white font-black shadow-lg shadow-emerald-500/30 border-2 border-emerald-500'
      : 'bg-white border-2 border-emerald-100 text-emerald-600 font-bold hover:bg-emerald-50 hover:border-emerald-200';

    const btnAssenteClass = mioVoto && mioVoto.stato === 'Assente'
      ? 'bg-rose-500 text-white font-black shadow-lg shadow-rose-500/30 border-2 border-rose-500'
      : 'bg-white border-2 border-rose-100 text-rose-500 font-bold hover:bg-rose-50 hover:border-rose-200';

    const avvisoConvocazioniChiuse = haDefinitoAdmin
      ? `<div class="mb-3 p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold rounded-xl text-center flex items-center justify-center gap-1.5">
           <svg class="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
           Convocazioni ufficiali 12 chiuse dall'Admin
         </div>`
      : '';

    const btnEditaPresenzeAdmin = (isAdmin)
      ? `<button onclick="apriModalModificaPresenzeAdmin('${partita.id}')" class="w-full my-2 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5">
          <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
          Modifica Presenze / Voti
        </button>`
      : '';

    return `
      <div class="w-full mb-6" id="partita-${partita.id}">
        <div class="bg-white p-5 rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 relative overflow-hidden transition-all ${effettoLampeggiante}">
          <div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-burgundy to-rose-400"></div>
          ${adminDeleteBtn}

          <div class="flex items-center gap-2 mb-3 mt-1">
            <div class="w-7 h-7 rounded-full bg-burgundy/10 flex items-center justify-center text-burgundy">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            </div>
            <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">${partita.tipo_sondaggio === 'amichevole' ? 'Amichevole' : 'Convocazione'}</span>
          </div>

          <div class="mb-4">
            <h3 class="text-xl font-black text-slate-800 tracking-tight">
              Darsenal <span class="text-slate-300 mx-1 font-medium text-lg">vs</span> ${partita.squadra_avversaria}
            </h3>
            <div class="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-2">
              <svg class="w-4 h-4 text-burgundy/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> 
              ${dataFormatted} <span class="text-slate-200 mx-1">|</span> ${partita.luogo || 'Campo'}
            </div>
          </div>

          ${avvisoConvocazioniChiuse}
          ${btnSpareggioAdmin}
          ${btnEditaPresenzeAdmin}
          ${sezioneNonVotantiHtml}

          <div class="grid grid-cols-2 gap-3 mb-5">
            <div class="bg-emerald-50/50 rounded-2xl p-3 border border-emerald-100/50">
              <div class="flex items-center justify-between border-b border-emerald-100/80 pb-2 mb-2">
                <span class="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Convocati (${esito.convocati.length})</span>
                <span class="bg-emerald-200 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded-full">${esito.convocati.length}</span>
              </div>
              <div class="space-y-1.5 text-emerald-700 font-semibold text-xs max-h-36 overflow-y-auto">
                ${esito.convocati.length ? esito.convocati.map(nome => {
                  return `<div class="truncate flex items-center gap-1.5"><div class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></div><span class="truncate">${nome}</span></div>`;
                }).join('') : '<div class="text-emerald-500/50 italic font-medium">Nessuno</div>'}
              </div>
            </div>

            <div class="bg-rose-50/50 rounded-2xl p-3 border border-rose-100/50">
              <div class="flex items-center justify-between border-b border-rose-100/80 pb-2 mb-2">
                <span class="text-[10px] font-black text-rose-800 uppercase tracking-widest">Assenti (${assenti.length})</span>
                <span class="bg-rose-200 text-rose-900 text-[10px] font-black px-2 py-0.5 rounded-full">${assenti.length}</span>
              </div>
              <div class="space-y-1.5 text-rose-700 font-semibold text-xs max-h-36 overflow-y-auto">
                ${assenti.length ? assenti.map(a => `<div class="truncate flex items-center gap-1.5"><div class="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"></div>${a.nome_utente}</div>`).join('') : '<div class="text-rose-500/50 italic font-medium">Nessuno</div>'}
              </div>
            </div>
          </div>

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

          ${(typeof isAdmin !== 'undefined' && isAdmin) ? `
          <div class="flex gap-2 mt-4 pt-4 border-t border-slate-100/80">
            <button onclick="generaDistintaPDF('${partita.id}')" class="flex-1 py-2.5 bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 hover:bg-slate-900 transition-all">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              PDF Distinta
            </button>
            <button onclick="copiaTestoWhatsApp('${partita.id}')" class="flex-1 py-2.5 bg-[#005c4b] text-white font-bold rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 hover:bg-[#004236] transition-all">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
              Copia per WA
            </button>
          </div>
          ` : ''}

        </div>
      </div>
    `;
  }).join('');
}

function toggleDettaglioNonVotantiMatch(partitaId) {
  const container = document.getElementById(`container-non-votanti-${partitaId}`);
  const icona = document.getElementById(`icon-non-votanti-${partitaId}`);
  if (container && icona) {
    const isHidden = container.classList.contains('hidden');
    container.classList.toggle('hidden');
    icona.innerText = isHidden ? '▲' : '▼';
  }
}

function toggleVisualizzaVoti(id) {
  const el = document.getElementById(`dettaglio-voti-${id}`);
  if (el) el.classList.toggle('hidden');
}

function aggiornaStatoTabFiltri(tuttiSondaggi, tuttePresenze, tuttiVotiCustom) {
  const categorie = ['torneo', 'amichevole', 'disponibilita'];

  categorie.forEach(cat => {
    const btn = document.getElementById(`filtro-${cat}`);
    if (!btn) return;

    const sondaggiCat = tuttiSondaggi.filter(p => {
      if (cat === 'disponibilita') return p.tipo_sondaggio === 'disponibilita' || p.tipo_sondaggio === 'multi';
      if (cat === 'torneo') return p.tipo_sondaggio === 'torneo' || !p.tipo_sondaggio;
      return p.tipo_sondaggio === cat;
    });

    const conteggio = sondaggiCat.length;
    let haSondaggiDaVotare = false;

    if (currentUser && sondaggiCat.length > 0) {
      haSondaggiDaVotare = sondaggiCat.some(p => {
        const isCustom = p.tipo_sondaggio === 'disponibilita' || p.tipo_sondaggio === 'multi';
        if (isCustom) {
          return !tuttiVotiCustom.some(v => v.id_sondaggio === p.id && v.nome_utente?.toLowerCase() === currentUser?.toLowerCase());
        } else {
          return !tuttePresenze.some(pr => pr.id_partita === p.id && pr.nome_utente?.toLowerCase() === currentUser?.toLowerCase());
        }
      });
    }

    const nomiTab = { torneo: 'Torneo', amichevole: 'Amichevoli', disponibilita: 'Altro' };
    const nomeTab = nomiTab[cat] || cat;
    const isAttivo = (cat === categoriaAttivaSondaggi);

    const notificandoDot = haSondaggiDaVotare
      ? `<span class="relative flex h-2.5 w-2.5 mr-1.5 shrink-0">
           <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
           <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
         </span>`
      : '';

    let badgeClass = 'bg-slate-200 text-slate-600';
    if (haSondaggiDaVotare) {
      badgeClass = 'bg-rose-500 text-white font-black animate-pulse shadow-sm shadow-rose-500/50';
    } else if (isAttivo) {
      badgeClass = 'bg-burgundy/10 text-burgundy';
    }

    const badgeHTML = conteggio > 0 
      ? `<span class="ml-1.5 text-[10px] px-2 py-0.5 rounded-full font-black transition-all ${badgeClass}">${conteggio}</span>`
      : '';

    let btnClasses = `flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center relative ${
      isAttivo 
        ? 'bg-white text-slate-800 shadow-sm' 
        : 'text-slate-500 hover:text-slate-800'
    }`;

    if (haSondaggiDaVotare && !isAttivo) {
      btnClasses += ' text-rose-600 font-black';
    }

    btn.className = btnClasses;
    btn.innerHTML = `${notificandoDot}<span>${nomeTab}</span>${badgeHTML}`;
  });
}

// -------------------------------------------------------------
// MODALE EDIT PRESENZE MANUALE ADMIN
// -------------------------------------------------------------
let partitaIdModificaPresenze = null;

async function apriModalModificaPresenzeAdmin(partitaId) {
  partitaIdModificaPresenze = partitaId;
  const modal = document.getElementById('modal-modifica-presenze-admin');
  const container = document.getElementById('lista-presenze-admin-edit');
  if (!modal || !container) return;

  const { data: presenzePartita } = await db.from('presenze').select('*').eq('id_partita', partitaId);
  const presenzeMap = {};
  (presenzePartita || []).forEach(p => presenzeMap[p.nome_utente.toLowerCase()] = p.stato);

  let giocatori = GIOCATORI_MOCK;
  const { data: dbGiocatori } = await db.from('giocatori').select('*');
  if (dbGiocatori && dbGiocatori.length > 0) giocatori = dbGiocatori;

  container.innerHTML = giocatori.map(g => {
    const nomeCompleto = g.nome_completo || g.nome;
    const statoAttuale = presenzeMap[nomeCompleto.toLowerCase()] || 'Non Votato';

    return `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 gap-2">
        <span class="text-xs font-bold text-slate-800 capitalize">${nomeCompleto}</span>
        <div class="flex bg-slate-200/70 p-1 rounded-xl text-[11px] font-bold gap-1 group-stato-presenza" data-giocatore="${escapeHtmlAttr(nomeCompleto)}">
          <button type="button" onclick="selezionaStatoPresenzaAdmin(this, 'Presente')" class="btn-stato flex-1 sm:flex-initial px-2.5 py-1 rounded-lg transition-all ${statoAttuale === 'Presente' ? 'bg-emerald-500 text-white font-black shadow-sm' : 'text-slate-600 hover:text-slate-900'}">Ci sono</button>
          <button type="button" onclick="selezionaStatoPresenzaAdmin(this, 'Assente')" class="btn-stato flex-1 sm:flex-initial px-2.5 py-1 rounded-lg transition-all ${statoAttuale === 'Assente' ? 'bg-rose-500 text-white font-black shadow-sm' : 'text-slate-600 hover:text-slate-900'}">Non ci sono</button>
          <button type="button" onclick="selezionaStatoPresenzaAdmin(this, 'Non Votato')" class="btn-stato flex-1 sm:flex-initial px-2.5 py-1 rounded-lg transition-all ${statoAttuale === 'Non Votato' ? 'bg-slate-400 text-white font-black shadow-sm' : 'text-slate-600 hover:text-slate-900'}">Reset</button>
        </div>
      </div>
    `;
  }).join('');

  modal.classList.remove('hidden');
}

function selezionaStatoPresenzaAdmin(btn, stato) {
  const container = btn.closest('.group-stato-presenza');
  if (!container) return;

  const buttons = container.querySelectorAll('.btn-stato');
  buttons.forEach(b => {
    b.className = 'btn-stato flex-1 sm:flex-initial px-2.5 py-1 rounded-lg transition-all text-slate-600 hover:text-slate-900';
  });

  if (stato === 'Presente') {
    btn.className = 'btn-stato flex-1 sm:flex-initial px-2.5 py-1 rounded-lg transition-all bg-emerald-500 text-white font-black shadow-sm';
  } else if (stato === 'Assente') {
    btn.className = 'btn-stato flex-1 sm:flex-initial px-2.5 py-1 rounded-lg transition-all bg-rose-500 text-white font-black shadow-sm';
  } else {
    btn.className = 'btn-stato flex-1 sm:flex-initial px-2.5 py-1 rounded-lg transition-all bg-slate-400 text-white font-black shadow-sm';
  }
  container.setAttribute('data-stato-selezionato', stato);
}

async function salvaModificaPresenzeAdmin() {
  if (!partitaIdModificaPresenze) return;

  const gruppi = document.querySelectorAll('.group-stato-presenza');
  for (const g of gruppi) {
    const nome = g.getAttribute('data-giocatore');
    let stato = g.getAttribute('data-stato-selezionato');

    if (!stato) {
      const activeBtn = g.querySelector('.bg-emerald-500, .bg-rose-500, .bg-slate-400');
      if (activeBtn) {
        if (activeBtn.textContent.includes('Ci sono')) stato = 'Presente';
        else if (activeBtn.textContent.includes('Non ci sono')) stato = 'Assente';
        else stato = 'Non Votato';
      }
    }

    if (stato === 'Non Votato') {
      await db.from('presenze').delete().eq('id_partita', partitaIdModificaPresenze).eq('nome_utente', nome);
    } else if (stato) {
      await db.from('presenze').upsert({ id_partita: partitaIdModificaPresenze, nome_utente: nome, stato }, { onConflict: 'id_partita,nome_utente' });
    }
  }

  document.getElementById('modal-modifica-presenze-admin').classList.add('hidden');
  caricaSondaggi();
}

async function votaPresenza(partitaId, presente) {
  if (!currentUser) return mostraAlert("Devi prima effettuare il login.");

  const { data: partita } = await db.from('partite').select('*').eq('id', partitaId).single();
  const haScelteAdmin = partita?.scelte_admin && partita.scelte_admin.length > 0;

  if (presente && haScelteAdmin && !isAdmin) {
    return mostraAlert("Le convocazioni per questa partita sono già state chiuse e definite dall'Admin.");
  }

  const nuovoStato = presente ? 'Presente' : 'Assente';

  const { error } = await db
    .from('presenze')
    .upsert(
      { id_partita: partitaId, nome_utente: currentUser, stato: nuovoStato },
      { onConflict: 'id_partita,nome_utente' }
    );

  if (error) return mostraAlert(`Impossibile registrare il voto: ${error.message || JSON.stringify(error)}`);

  caricaSondaggi();
}

async function votaOpzioneCustom(sondaggioId, opzione, maxScelte) {
  if (!currentUser) return mostraAlert("Devi prima effettuare il login.");

  const { data: votiEsistenti } = await db
    .from('voti_sondaggi')
    .select('*')
    .eq('id_sondaggio', sondaggioId)
    .eq('nome_utente', currentUser);

  const giaVotatoQuesta = (votiEsistenti || []).some(v => v.opzione_scelta === opzione);

  if (giaVotatoQuesta) {
    await db
      .from('voti_sondaggi')
      .delete()
      .eq('id_sondaggio', sondaggioId)
      .eq('nome_utente', currentUser)
      .eq('opzione_scelta', opzione);
  } else {
    if (maxScelte === 1 && votiEsistenti && votiEsistenti.length > 0) {
      await db
        .from('voti_sondaggi')
        .delete()
        .eq('id_sondaggio', sondaggioId)
        .eq('nome_utente', currentUser);
    }
    await db
      .from('voti_sondaggi')
      .insert([{ id_sondaggio: sondaggioId, nome_utente: currentUser, opzione_scelta: opzione }]);
  }

  caricaSondaggi();
}

async function copiaTestoWhatsApp(partitaId = null) {
  try {
    let sondaggioAttivo = null;

    if (partitaId) {
      const { data, error } = await db.from('partite').select('*').eq('id', partitaId).single();
      if (!error) sondaggioAttivo = data;
    }

    if (!sondaggioAttivo) {
      const dataLimite = new Date();
      dataLimite.setHours(dataLimite.getHours() - 12); 
      const { data: sondaggi } = await db
        .from('partite')
        .select('*')
        .gte('data_ora', dataLimite.toISOString())
        .order('data_ora', { ascending: true })
        .limit(1);

      if (sondaggi && sondaggi.length > 0) sondaggioAttivo = sondaggi[0];
    }

    if (!sondaggioAttivo) {
      return mostraAlert("Nessun sondaggio trovato per generare il messaggio.");
    }

    const { data: presenti } = await db
      .from('presenze')
      .select('nome_utente')
      .eq('id_partita', sondaggioAttivo.id)
      .eq('stato', 'Presente');

    const dataPartita = new Date(sondaggioAttivo.data_ora);
    const dataFormattata = dataPartita.toLocaleString('it-IT', {
      weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit'
    });

    const listaNomi = presenti && presenti.length > 0 
      ? presenti.map((p, i) => `${i + 1}. ${p.nome_utente}`).join('\n')
      : "Nessun giocatore ha ancora confermato.";

    const testoWhatsApp = `*CONVOCAZIONI DARSENAL* 🔴⚽\n\n` +
                          `🆚 *Avversario:* ${sondaggioAttivo.squadra_avversaria}\n` +
                          `📅 *Quando:* ${dataFormattata}\n` +
                          `📍 *Dove:* ${sondaggioAttivo.luogo || 'Campo Sportivo'}\n\n` +
                          `*Presenti (${presenti ? presenti.length : 0}):*\n${listaNomi}\n\n` +
                          `🔗 Vota subito qui:\nhttps://darsenal-info.netlify.app/`;

    await navigator.clipboard.writeText(testoWhatsApp);
    await mostraAlert("Testo del sondaggio copiato negli appunti con il link del sito!", "Copiato");
    
  } catch (error) {
    console.error("Errore copia testo WhatsApp:", error);
    await mostraAlert("Si è verificato un errore durante la generazione del testo.");
  }
}


function aggiornaBadgeNavSondaggi(tuttiSondaggi, tuttePresenze, tuttiVotiCustom) {
  const navSondaggiBtn = document.getElementById('nav-sondaggi');
  if (!navSondaggiBtn) return;

  let haSondaggiDaVotare = false;
  if (currentUser && tuttiSondaggi && tuttiSondaggi.length > 0) {
    haSondaggiDaVotare = tuttiSondaggi.some(p => {
      const isCustom = p.tipo_sondaggio === 'disponibilita' || p.tipo_sondaggio === 'multi';
      if (isCustom) {
        return !tuttiVotiCustom.some(v => v.id_sondaggio === p.id && v.nome_utente?.toLowerCase() === currentUser?.toLowerCase());
      } else {
        return !tuttePresenze.some(pr => pr.id_partita === p.id && pr.nome_utente?.toLowerCase() === currentUser?.toLowerCase());
      }
    });
  }

  let dot = navSondaggiBtn.querySelector('.sondaggi-nav-dot');
  if (haSondaggiDaVotare) {
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'sondaggi-nav-dot absolute top-1 right-3 w-2.5 h-2.5 bg-rose-600 rounded-full ring-2 ring-white animate-pulse';
      navSondaggiBtn.style.position = 'relative';
      navSondaggiBtn.appendChild(dot);
    }
  } else {
    if (dot) dot.remove();
  }
}


async function aggiornaBadgeNavSondaggiIniziale() {
  if (!currentUser) return;
  try {
    const { data: tuttePartite } = await db.from('partite').select('*');
    const { data: presenzeList } = await db.from('presenze').select('*');
    const { data: votiCustomList } = await db.from('voti_sondaggi').select('*');

    const inizioOggi = new Date();
    inizioOggi.setHours(0, 0, 0, 0);

    const tuttiSondaggiFuturi = (tuttePartite || []).filter(p => new Date(p.data_ora) >= inizioOggi && p.tipo_sondaggio !== 'annullato');
    
    if (typeof aggiornaBadgeNavSondaggi === 'function') {
      aggiornaBadgeNavSondaggi(tuttiSondaggiFuturi, presenzeList || [], votiCustomList || []);
    }
  } catch (err) {
    console.warn("Impossibile aggiornare badge nav iniziale:", err);
  }
}