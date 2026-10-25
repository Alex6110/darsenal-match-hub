let partitaSelezionataAssenze = null;

// Carica e calcola le statistiche personali per il menu laterale dell'utente[cite: 98]
async function caricaStatisticheUtente(nomeUtente) {
  if (!nomeUtente) return;

  const nomeNorm = nomeUtente.toLowerCase().trim();

  try {
    const adesso = new Date();

    // 1. Carica calendario, presenze, eventi e sondaggi (partite) per allineare gli ID[cite: 98]
    const [{ data: calendario }, { data: presenze }, { data: eventi }, { data: tuttePartiteSondaggio }] = await Promise.all([
      db.from('calendario_torneo').select('*').order('data_ora', { ascending: false }),
      db.from('presenze').select('*'),
      db.from('eventi_partita').select('*'),
      db.from('partite').select('id, data_ora')
    ]);

    // Filtra solo le partite del torneo GIÀ GIOCATE dalla squadra[cite: 98]
    const partiteGiocateSquadra = (calendario || []).filter(p => 
      p.completata || p.risultato || new Date(p.data_ora) <= adesso
    );

    const numPartiteSquadra = partiteGiocateSquadra.length;
    
    // Mappa gli ID validi (sia id di calendario_torneo che id di partite/sondaggi collegati per data)[cite: 98]
    const validMatchIds = new Set();
    partiteGiocateSquadra.forEach(p => {
      validMatchIds.add(String(p.id));
      const sondaggio = (tuttePartiteSondaggio || []).find(s => s.data_ora === p.data_ora);
      if (sondaggio) {
        validMatchIds.add(String(sondaggio.id));
      }
    });

    // Filtra le presenze del giocatore per le partite giocate[cite: 98]
    const presenzeGiocatore = (presenze || []).filter(p => {
      const matchId = String(p.id_partita || p.id_sondaggio || p.partita_id);
      return (p.nome_utente || '').toLowerCase().trim() === nomeNorm && validMatchIds.has(matchId);
    });

    // Presenze effettive (nominatore) / Partite totali giocate dalla squadra (denominatore)[cite: 98]
    const presenzeTotali = presenzeGiocatore.filter(p => p.stato === 'Presente').length;
    const esclusioniTotali = presenzeGiocatore.filter(p => p.stato === 'Escluso').length;
    const assenzeTotali = Math.max(0, numPartiteSquadra - presenzeTotali);

    // Ultima giocata[cite: 98]
    const presenzeEffettive = presenzeGiocatore.filter(p => p.stato === 'Presente');
    let ultimaGiocataStr = '-';

    if (presenzeEffettive.length > 0) {
      for (const p of partiteGiocateSquadra) {
        const pIdStr = String(p.id);
        const eraPresente = presenzeEffettive.some(pr => {
          const mId = String(pr.id_partita || pr.id_sondaggio || pr.partita_id);
          const sondaggio = (tuttePartiteSondaggio || []).find(s => s.data_ora === p.data_ora);
          return mId === pIdStr || (sondaggio && mId === String(sondaggio.id));
        });
        if (eraPresente) {
          const avversario = p.squadra_casa.toLowerCase().includes('darsenal') ? p.squadra_trasferta : p.squadra_casa;
          const d = new Date(p.data_ora);
          const dataFormatted = !isNaN(d) ? d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : '';
          ultimaGiocataStr = `${avversario} (${dataFormatted})`;
          break;
        }
      }
    }

    // Gol e Cartellini[cite: 98]
    const eventiGiocatore = (eventi || []).filter(e => 
      (e.nome_utente || '').toLowerCase().trim() === nomeNorm && validMatchIds.has(String(e.id_partita))
    );

    const gol = eventiGiocatore.filter(e => e.tipo === 'gol').length;
    const gialli = eventiGiocatore.filter(e => e.tipo === 'giallo').length;
    const rossi = eventiGiocatore.filter(e => e.tipo === 'rosso').length;

    // Aggiorna UI del menu laterale (Presenze Totali formato Nominatore / Denominatore)[cite: 98]
    if (document.getElementById('stat-presenze')) document.getElementById('stat-presenze').innerText = `${presenzeTotali} / ${numPartiteSquadra}`;
    if (document.getElementById('stat-ultima')) document.getElementById('stat-ultima').innerText = ultimaGiocataStr;
    if (document.getElementById('stat-esclusioni')) document.getElementById('stat-esclusioni').innerText = `${esclusioniTotali} / ${assenzeTotali}`;
    if (document.getElementById('stat-gol')) document.getElementById('stat-gol').innerText = gol;
    if (document.getElementById('stat-gialli')) document.getElementById('stat-gialli').innerText = gialli;
    if (document.getElementById('stat-rossi')) document.getElementById('stat-rossi').innerText = rossi;

  } catch (err) {
    console.error("Errore caricamento statistiche utente:", err);
  }
}

// Apre la sezione Giocatori come pagina principale (stile saldo.js)[cite: 98, 100]
function apriSezioneGiocatori() {
  switchTab('giocatori');
  switchTabGiocatori('info');
  
  // Mostra o nasconde la tab assenze in base ai permessi admin[cite: 98]
  const btnTabAssenze = document.getElementById('btn-tab-giocatori-assenze');
  if (btnTabAssenze) {
    if (typeof isAdmin !== 'undefined' && isAdmin) {
      btnTabAssenze.classList.remove('hidden');
    } else {
      btnTabAssenze.classList.add('hidden');
    }
  }
}

// Gestione dei tab all'interno della pagina Giocatori / Assenze[cite: 98]
function switchTabGiocatori(tab) {
  if (tab === 'assenze' && typeof isAdmin !== 'undefined' && !isAdmin) {
    tab = 'info';
  }

  const btnInfo = document.getElementById('btn-tab-giocatori-info');
  const btnAssenze = document.getElementById('btn-tab-giocatori-assenze');
  const viewInfo = document.getElementById('tab-giocatori-info-view');
  const viewAssenze = document.getElementById('tab-giocatori-assenze-view');

  if (tab === 'info') {
    if (viewInfo) viewInfo.classList.remove('hidden');
    if (viewAssenze) viewAssenze.classList.add('hidden');
    if (btnInfo) btnInfo.className = "flex-1 py-2 rounded-lg bg-white text-burgundy shadow-sm transition-all";
    if (btnAssenze) btnAssenze.className = "flex-1 py-2 rounded-lg text-slate-500 hover:text-slate-800 transition-all";
    caricaTabellaGiocatoriInfo();
  } else {
    if (viewInfo) viewInfo.classList.add('hidden');
    if (viewAssenze) viewAssenze.classList.remove('hidden');
    if (btnAssenze) btnAssenze.className = "flex-1 py-2 rounded-lg bg-white text-burgundy shadow-sm transition-all";
    if (btnInfo) btnInfo.className = "flex-1 py-2 rounded-lg text-slate-500 hover:text-slate-800 transition-all";
    caricaPartiteAssenzeSupabase();
  }
}

// Rinomina la funzione di caricamento tabella rimuovendo i riferimenti alla modale[cite: 98]
async function caricaTabellaGiocatoriInfo() {
  const tbody = document.getElementById('admin-giocatori-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="text-center text-xs text-slate-400 py-6">Caricamento statistiche...</td></tr>`;

  try {
    const adesso = new Date();

    let giocatori = typeof GIOCATORI_MOCK !== 'undefined' ? GIOCATORI_MOCK : [];
    const { data: dbG } = await db.from('giocatori').select('*');
    if (dbG && dbG.length > 0) giocatori = dbG;

    const [{ data: calendario }, { data: presenze }, { data: eventi }, { data: tuttePartiteSondaggio }] = await Promise.all([
      db.from('calendario_torneo').select('*').order('data_ora', { ascending: false }),
      db.from('presenze').select('*'),
      db.from('eventi_partita').select('*'),
      db.from('partite').select('id, data_ora')
    ]);

    const partiteGiocateSquadra = (calendario || []).filter(p => 
      p.completata || p.risultato || new Date(p.data_ora) <= adesso
    );

    const numPartiteSquadra = partiteGiocateSquadra.length;
    
    const validMatchIds = new Set();
    partiteGiocateSquadra.forEach(p => {
      validMatchIds.add(String(p.id));
      const sondaggio = (tuttePartiteSondaggio || []).find(s => s.data_ora === p.data_ora);
      if (sondaggio) {
        validMatchIds.add(String(sondaggio.id));
      }
    });

    tbody.innerHTML = giocatori.map((g, idx) => {
      const nomeCompleto = g.nome_completo || g.nome;
      const partiNome = nomeCompleto.trim().split(/\s+/);
      const cognome = partiNome[partiNome.length - 1];
      const nomeProprio = partiNome.slice(0, partiNome.length - 1).join(' ');
      const nomeNorm = nomeCompleto.toLowerCase().trim();

      const bgRowClass = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80';

      const pList = (presenze || []).filter(p => {
        const matchId = String(p.id_partita || p.id_sondaggio || p.partita_id);
        return (p.nome_utente || '').toLowerCase().trim() === nomeNorm && validMatchIds.has(matchId);
      });

      const pres = pList.filter(p => p.stato === 'Presente').length;
      const assenzeTotali = Math.max(0, numPartiteSquadra - pres);
      const esclusioni = pList.filter(p => p.stato === 'Escluso').length;

      const presenzeFormatte = `${pres} / ${numPartiteSquadra}`;

      const presEffettive = pList.filter(p => p.stato === 'Presente');
      let ultima = '-';

      if (presEffettive.length > 0) {
        for (const p of partiteGiocateSquadra) {
          const pIdStr = String(p.id);
          const eraPresente = presEffettive.some(pr => {
            const mId = String(pr.id_partita || pr.id_sondaggio || pr.partita_id);
            const sondaggio = (tuttePartiteSondaggio || []).find(s => s.data_ora === p.data_ora);
            return mId === pIdStr || (sondaggio && mId === String(sondaggio.id));
          });
          if (eraPresente) {
            const avversario = p.squadra_casa.toLowerCase().includes('darsenal') ? p.squadra_trasferta : p.squadra_casa;
            const d = new Date(p.data_ora);
            const dataFormatted = !isNaN(d) ? d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : '';
            ultima = `${avversario} (${dataFormatted})`;
            break;
          }
        }
      }

      const eList = (eventi || []).filter(e => 
        (e.nome_utente || '').toLowerCase().trim() === nomeNorm && validMatchIds.has(String(e.id_partita))
      );

      const gol = eList.filter(e => e.tipo === 'gol').length;
      const gialli = eList.filter(e => e.tipo === 'giallo').length;
      const rossi = eList.filter(e => e.tipo === 'rosso').length;

      return `
        <tr class="${bgRowClass} hover:bg-slate-100/80 transition-colors">
          <td class="p-2.5 pl-3 w-[36%]">
            <span class="font-bold text-slate-800 text-xs block leading-tight">${cognome}</span>
            <span class="font-bold text-slate-600 text-xs block leading-tight">${nomeProprio}</span>
          </td>
          <td class="p-2 text-center font-bold text-slate-700 w-[10%]">${presenzeFormatte}</td>
          <td class="p-2 text-center text-slate-500 font-semibold w-[11%] whitespace-nowrap">${esclusioni} / ${assenzeTotali}</td>
          <td class="p-2 text-center text-slate-500 text-[11px] w-[19%]">${ultima}</td>
          <td class="p-2 text-center font-black text-burgundy w-[8%]">${gol}</td>
          <td class="p-2 text-center font-bold text-amber-500 w-[8%]">${gialli}</td>
          <td class="p-2 text-center font-bold text-rose-600 w-[8%]">${rossi}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error("Errore caricamento tabella giocatori:", err);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-xs text-rose-500 py-4">Errore caricamento dati.</td></tr>`;
  }
}

async function caricaPartiteAssenzeSupabase() {
  const container = document.getElementById('lista-partite-assenze');
  if (!container) return;

  container.innerHTML = `<div class="text-center text-xs text-slate-400 py-6">Caricamento partite...</div>`;

  // MODIFICA QUI: Aggiunto il recupero di partite (sondaggi)
  const [{ data: partite, error }, { data: tuttePresenze }, { data: tuttePartiteSondaggio }] = await Promise.all([
    db.from('calendario_torneo').select('*').order('data_ora', { ascending: true }),
    db.from('presenze').select('id_partita, stato'),
    db.from('partite').select('id, data_ora, squadra_avversaria')
  ]);

  if (error || !partite) {
    container.innerHTML = `<div class="text-center text-xs text-rose-500 py-4">Errore caricamento calendario.</div>`;
    return;
  }

  const partiteDarsenal = partite.filter(p => {
    const casa = (p.squadra_casa || '').toLowerCase();
    const trasf = (p.squadra_trasferta || '').toLowerCase();
    return casa.includes('darsenal') || trasf.includes('darsenal');
  });

  if (partiteDarsenal.length === 0) {
    container.innerHTML = `<div class="text-center text-xs text-slate-400 py-6">Nessuna partita trovata.</div>`;
    return;
  }

  const idsPresenzeSalvate = new Set(
    (tuttePresenze || [])
      .filter(pr => pr.stato === 'Assente' || pr.stato === 'Escluso')
      .map(pr => String(pr.id_partita))
  );

  const adesso = new Date();
  // Calcoliamo la soglia di 1 ora dopo l'inizio per la partita in corso/prossima
  const sogliaUnOraFa = new Date(adesso.getTime() - 60 * 60 * 1000);

  // Individuiamo prima qual è la "prossima" partita valida (la più vicina nel futuro o iniziata da meno di un'ora)
  let prossimaPartitaId = null;
  const partiteFutureORecenti = partiteDarsenal.filter(p => new Date(p.data_ora) >= sogliaUnOraFa);
  if (partiteFutureORecenti.length > 0) {
    // Ordina per vicinanza temporale alla data odierna
    partiteFutureORecenti.sort((a, b) => Math.abs(new Date(a.data_ora) - adesso) - Math.abs(new Date(b.data_ora) - adesso));
    prossimaPartitaId = String(partiteFutureORecenti[0].id);
  }

  let indexProssimaTrovata = false;

  container.innerHTML = partiteDarsenal.map(p => {
    const d = new Date(p.data_ora);
    const dataFormatted = !isNaN(d) ? d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Data ignota';
    const oraFormatted = !isNaN(d) ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';

    const isPassata = d <= adesso;
    const isProssimaRegola = String(p.id) === prossimaPartitaId;
    const avversario = p.squadra_casa.toLowerCase().includes('darsenal') ? p.squadra_trasferta : p.squadra_casa;

    let sondaggioId = null;
    if (tuttePartiteSondaggio) {
      const sondaggioTrovato = tuttePartiteSondaggio.find(s => 
        (p.data_ora && s.data_ora === p.data_ora) || 
        (avversario && (s.squadra_avversaria || '').toLowerCase().includes(avversario.toLowerCase()))
      );
      if (sondaggioTrovato) sondaggioId = sondaggioTrovato.id;
    }

    // Se è la partita identificata come "Prossima" (o futura), forziamo giaSalvata a false
    let giaSalvata = false;
    if (!isProssimaRegola) {
      giaSalvata = idsPresenzeSalvate.has(String(p.id)) || (sondaggioId && idsPresenzeSalvate.has(String(sondaggioId)));
    }

    let badgeStato = '';
    let cardStyle = '';
    let clickAction = '';

    if (giaSalvata) {
      badgeStato = '<span class="text-[9px] bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">Giocata e Salvata</span>';
      cardStyle = 'bg-slate-50 border-slate-200 opacity-90 cursor-pointer';
      clickAction = `onclick="confermaEDettaglioPartitaAssenze('${p.id}', true, '${escapeHtmlAttr(avversario)}', '${p.data_ora}')"`;
    } else if (isProssimaRegola) {
      // È la prossima incontro ufficiale (o entro un'ora dall'inizio)
      badgeStato = '<span class="text-[9px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-black font-black">Prossima</span>';
      cardStyle = 'bg-white border-slate-200 shadow-sm cursor-pointer';
      clickAction = `onclick="confermaEDettaglioPartitaAssenze('${p.id}', false, '${escapeHtmlAttr(avversario)}', '${p.data_ora}')"`;
    } else if (isPassata) {
      badgeStato = '<span class="text-[9px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-black font-black">Da Registrare</span>';
      cardStyle = 'bg-white border-burgundy border-2 shadow-md cursor-pointer';
      clickAction = `onclick="confermaEDettaglioPartitaAssenze('${p.id}', false, '${escapeHtmlAttr(avversario)}', '${p.data_ora}')"`;
    } else {
      badgeStato = '<span class="text-[9px] bg-slate-200 text-slate-500 px-2.5 py-0.5 rounded-full font-bold">Da giocare</span>';
      cardStyle = 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed';
      clickAction = '';
    }

    return `
      <div ${clickAction} class="p-4 rounded-2xl border ${cardStyle} transition-all hover:scale-[1.01]">
        <div class="flex justify-between items-center">
          <div>
            <p class="font-black text-xs text-slate-800">Darsenal vs ${avversario}</p>
            <p class="text-[10px] text-slate-400 font-bold">${dataFormatted} alle ${oraFormatted} ${p.giornata ? `- ${p.giornata}` : ''}</p>
          </div>
          <div class="flex items-center gap-2">
            ${badgeStato}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function confermaEDettaglioPartitaAssenze(partitaId, giaSalvata, avversario, dataOra) {
  if (giaSalvata) {
    mostraConfirm(
      "Partita già registrata",
      "Sei sicuro di voler accedere per visualizzare o modificare le assenze e le esclusioni registrate?",
      function() {
        apriDettaglioPartitaAssenze(partitaId, avversario, dataOra);
      }
    );
  } else {
    apriDettaglioPartitaAssenze(partitaId, avversario, dataOra);
  }
}

// Mostra il dettaglio con i giocatori assenti/esclusi e il menu a tendina personalizzato in stile sito
async function apriDettaglioPartitaAssenze(partitaId, avversario, dataOra) {
  // 1. Trova l'eventuale ID del sondaggio corrispondente nella tabella partite per allineare gli ID
  let sondaggioId = null;
  const { data: tuttePartiteSondaggio } = await db.from('partite').select('id, data_ora, squadra_avversaria');
  if (tuttePartiteSondaggio) {
    const sondaggioTrovato = tuttePartiteSondaggio.find(s => 
      (dataOra && s.data_ora === dataOra) || 
      (avversario && (s.squadra_avversaria || '').toLowerCase().includes(avversario.toLowerCase()))
    );
    if (sondaggioTrovato) sondaggioId = sondaggioTrovato.id;
  }

  partitaSelezionataAssenze = { id: partitaId, sondaggioId, avversario, dataOra };

  document.getElementById('vista-elenco-partite-assenze').classList.add('hidden');
  document.getElementById('vista-dettaglio-partita-assenze').classList.remove('hidden');

  document.getElementById('assenze-titolo-partita').innerText = `Darsenal vs ${avversario}`;
  const d = new Date(dataOra);
  document.getElementById('assenze-data-partita').innerText = !isNaN(d) ? d.toLocaleString('it-IT') : '';

  const container = document.getElementById('assenze-lista-giocatori');
  container.innerHTML = `<div class="text-center text-xs text-slate-400 py-4">Caricamento giocatori...</div>`;

  let giocatori = typeof GIOCATORI_MOCK !== 'undefined' ? GIOCATORI_MOCK : [];
  const { data: dbG } = await db.from('giocatori').select('*');
  if (dbG && dbG.length > 0) giocatori = dbG;

  // 2. Raccoglie tutti gli ID possibili per intercettare correttamente le presenze ovunque siano salvate
  const idsPossibili = [String(partitaId)];
  if (sondaggioId) idsPossibili.push(String(sondaggioId));

  const { data: tutteLePresenze } = await db.from('presenze').select('*');

  const presenzeMatch = (tutteLePresenze || []).filter(pr => {
    const mId = String(pr.id_partita || pr.id_sondaggio || pr.partita_id);
    return idsPossibili.includes(mId);
  });

  const presenzeMap = {};
  presenzeMatch.forEach(pr => {
    presenzeMap[(pr.nome_utente || '').toLowerCase().trim()] = pr.stato;
  });

  // 3. Logica inversa: mostra tutti i giocatori tranne chi ha votato 'Presente'
  const giocatoriNonPresenti = giocatori.filter(g => {
    const nome = g.nome_completo || g.nome;
    const stato = presenzeMap[nome.toLowerCase().trim()];
    return stato !== 'Presente';
  });

  // Contatore dei giocatori assenti nell'intestazione (rettangolo azzurro)
  let headerContatore = document.getElementById('assenze-num-assenti');
  if (!headerContatore) {
    const headerContainer = document.querySelector('#vista-dettaglio-partita-assenze .bg-white.p-4.rounded-2xl, #vista-dettaglio-partita-assenze div > .flex.justify-between') || document.getElementById('assenze-titolo-partita').parentElement;
    if (headerContainer) {
      const badgeDiv = document.createElement('div');
      badgeDiv.className = "text-right";
      badgeDiv.innerHTML = `<span id="assenze-num-assenti" class="text-[10px] bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-black">${giocatoriNonPresenti.length} Assenti</span>`;
      headerContainer.appendChild(badgeDiv);
    }
  } else {
    headerContatore.innerText = `${giocatoriNonPresenti.length} Assenti`;
  }

  if (giocatoriNonPresenti.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 font-medium">Nessun giocatore assente o escluso registrato per questa partita.</div>`;
    return;
  }

  container.innerHTML = giocatoriNonPresenti.map((g, idx) => {
    const nome = g.nome_completo || g.nome;
    const nomeNorm = nome.toLowerCase().trim();
    const statoCorrente = presenzeMap[nomeNorm];
    const isEscluso = statoCorrente === 'Escluso';
    const statoSelezionato = isEscluso ? 'Escluso' : 'Assente';

    // Calcolo storico assenze/esclusioni
    const storicoGiocatore = (tutteLePresenze || []).filter(pr => (pr.nome_utente || '').toLowerCase().trim() === nomeNorm);
    const numAssenzeStoriche = storicoGiocatore.filter(pr => pr.stato === 'Assente').length;
    const numEsclusioniStoriche = storicoGiocatore.filter(pr => pr.stato === 'Escluso').length;

    const testoSelezionato = statoSelezionato === 'Escluso' 
      ? `ESCLUSO (+1)` 
      : `INDISPONIBILE (0)`;

    return `
      <div class="p-2.5 flex justify-between items-center text-xs gap-2 border-b border-slate-50 last:border-0" data-giocatore-assente="${escapeHtmlAttr(nome)}">
        <span class="font-bold text-slate-700 truncate w-[45%]" style="font-size: 11px;">${nome}</span>
        
        <!-- Menu a tendina custom in stile sito -->
        <div class="custom-select-wrapper relative w-[55%]">
          <div onclick="toggleCustomSelect('stato-assenza-${idx}')" id="display-stato-assenza-${idx}" class="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 cursor-pointer flex justify-between items-center">
            <span class="truncate">${testoSelezionato}</span>
            <svg class="w-3 h-3 text-slate-400 shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
          <div id="options-stato-assenza-${idx}" class="custom-select-options hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden">
            <div onclick="selezionaStatoAssenza(${idx}, 'Assente', 'INDISPONIBILE (0)')" class="p-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer border-b border-slate-50 transition-colors">
              INDISPONIBILE (0)
            </div>
            <div onclick="selezionaStatoAssenza(${idx}, 'Escluso', 'ESCLUSO (+1)')" class="p-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
              ESCLUSO (+1)
            </div>
          </div>
          <input type="hidden" id="input-stato-assenza-${idx}" value="${statoSelezionato}">
        </div>
      </div>
    `;
  }).join('');
}

// Funzione per gestire la selezione del menu custom in stile sito
window.selezionaStatoAssenza = function(idx, valore, testo) {
  const inputEl = document.getElementById(`input-stato-assenza-${idx}`);
  if (inputEl) inputEl.value = valore;

  const displayEl = document.getElementById(`display-stato-assenza-${idx}`);
  if (displayEl) {
    const span = displayEl.querySelector('span');
    if (span) span.innerText = testo;
  }

  const optionsContainer = document.getElementById(`options-stato-assenza-${idx}`);
  if (optionsContainer) optionsContainer.classList.add('hidden');
};

// Salvataggio basato sull'ID corretto (sondaggio o calendario)
async function salvaAssenzePartita() {
  if (!partitaSelezionataAssenze) return;

  const rows = document.querySelectorAll('#assenze-lista-giocatori > div');
  const targetId = partitaSelezionataAssenze.sondaggioId || partitaSelezionataAssenze.id;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const nome = row.getAttribute('data-giocatore-assente');
    const inputEl = document.getElementById(`input-stato-assenza-${idx}`);
    const nuovoStato = inputEl ? inputEl.value : 'Assente';

    if (nome) {
      const { data: esiste } = await db.from('presenze')
        .select('*')
        .eq('id_partita', targetId)
        .ilike('nome_utente', nome);

      if (esiste && esiste.length > 0) {
        await db.from('presenze')
          .update({ stato: nuovoStato })
          .eq('id_partita', targetId)
          .ilike('nome_utente', nome);
      } else {
        await db.from('presenze').insert([{
          id_partita: targetId,
          nome_utente: nome,
          stato: nuovoStato
        }]);
      }
    }
  }

  mostraAlert("Assenze ed esclusioni salvate con successo!");
  chiudiDettaglioPartitaAssenze();
  caricaPartiteAssenzeSupabase();
}

function chiudiDettaglioPartitaAssenze() {
  document.getElementById('vista-dettaglio-partita-assenze').classList.add('hidden');
  document.getElementById('vista-elenco-partite-assenze').classList.remove('hidden');
}


// Helper di sicurezza per attributi HTML[cite: 98]
function escapeHtmlAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}