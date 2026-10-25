let partitaSelezionataAssenze = null;
let partiteAssenzeCache = [];
let giocatoriAssentiCorrenti = [];
const MS_ORA = 60 * 60 * 1000;
const chiaveNome = (s) => String(s || '').toLowerCase().trim();

function trovaSondaggioIdPerPartita(p, sondaggi) {
  const t = new Date(p.data_ora).getTime();
  const s = (sondaggi || []).find(x => new Date(x.data_ora).getTime() === t && x.tipo_sondaggio !== 'annullato');
  return s ? String(s.id) : null;
}

// Carica e calcola le statistiche personali per il menu laterale dell'utente[cite: 98]
async function caricaStatisticheUtente(nomeUtente) {
  if (!nomeUtente) return;

  const nomeNorm = nomeUtente.toLowerCase().trim();

  try {
    const adesso = new Date();

    // 1. Carica calendario, presenze, eventi e sondaggi (partite) per allineare gli ID[cite: 98]
   const [{ data: calendario }, { data: presenze }, { data: eventi }, { data: tuttePartiteSondaggio }, { data: assenzeSalvate }] = await Promise.all([
    db.from('calendario_torneo').select('*').order('data_ora', { ascending: false }),
    db.from('presenze').select('*'),
    db.from('eventi_partita').select('*'),
    db.from('partite').select('id, data_ora'),
    db.from('assenze_partita').select('nome_utente, tipo')
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
    const esclusioniTotali = (assenzeSalvate || []).filter(a =>
        a.tipo === 'escluso' && chiaveNome(a.nome_utente) === nomeNorm
    ).length;         
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
    chiudiDettaglioPartitaAssenze();
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
      const esclusioni = (assenzeSalvate || []).filter(a =>
        a.tipo === 'escluso' && chiaveNome(a.nome_utente) === nomeNorm
      ).length;
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

  const { data: partite, error } = await db.from('calendario_torneo').select('*').order('data_ora', { ascending: true });
  if (error || !partite) {
    container.innerHTML = `<div class="text-center text-xs text-rose-500 py-4">Errore caricamento calendario.</div>`;
    return;
  }

  const partiteDarsenal = partite.filter(p =>
    (p.squadra_casa || '').toLowerCase().includes('darsenal') ||
    (p.squadra_trasferta || '').toLowerCase().includes('darsenal')
  );

  if (partiteDarsenal.length === 0) {
    container.innerHTML = `<div class="text-center text-xs text-slate-400 py-6">Nessuna partita trovata.</div>`;
    return;
  }

  const adesso = new Date();
  const soglia = new Date(adesso.getTime() - MS_ORA);
  // "Prossima" = prima partita (in ordine di data) non iniziata da più di un'ora
  const prossima = partiteDarsenal.find(p => new Date(p.data_ora) >= soglia);
  const prossimaId = prossima ? String(prossima.id) : null;

  partiteAssenzeCache = partiteDarsenal.map(p => {
    const d = new Date(p.data_ora);
    let stato;
    if (String(p.id) === prossimaId) stato = 'prossima';
    else if (d > adesso) stato = 'futura';
    else stato = p.assenze_salvate ? 'salvata' : 'da_registrare';
    const avversario = (p.squadra_casa || '').toLowerCase().includes('darsenal') ? p.squadra_trasferta : p.squadra_casa;
    return { ...p, stato, avversario };
  });

  container.innerHTML = partiteAssenzeCache.map(p => {
    const d = new Date(p.data_ora);
    const dataF = !isNaN(d) ? d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Data ignota';
    const oraF = !isNaN(d) ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';

    let badge, cardStyle, click = `onclick="clickPartitaAssenze('${p.id}')"`;
    if (p.stato === 'salvata') {
      badge = '<span class="text-[9px] bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">Giocata e Salvata</span>';
      cardStyle = 'bg-slate-50 border-slate-200 opacity-80 cursor-pointer';
    } else if (p.stato === 'prossima') {
      badge = '<span class="text-[9px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-black">Prossima</span>';
      cardStyle = 'bg-white border-slate-200 shadow-sm cursor-pointer';
    } else if (p.stato === 'da_registrare') {
      badge = '<span class="text-[9px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-black">Da Registrare</span>';
      cardStyle = 'bg-white border-burgundy border-2 shadow-md cursor-pointer';
    } else {
      badge = '<span class="text-[9px] bg-slate-200 text-slate-500 px-2.5 py-0.5 rounded-full font-bold">Da giocare</span>';
      cardStyle = 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed';
      click = '';
    }

    return `
      <div ${click} class="p-4 rounded-2xl border ${cardStyle} transition-all">
        <div class="flex justify-between items-center">
          <div>
            <p class="font-black text-xs text-slate-800">Darsenal vs ${p.avversario}</p>
            <p class="text-[10px] text-slate-400 font-bold">${dataF} alle ${oraF} ${p.giornata ? `- ${p.giornata}` : ''}</p>
          </div>
          ${badge}
        </div>
      </div>`;
  }).join('');
}

function clickPartitaAssenze(id) {
  const p = partiteAssenzeCache.find(x => String(x.id) === String(id));
  if (!p || p.stato === 'futura') return;

  if (p.stato === 'salvata') {
    mostraConfirm(
      "Partita già registrata",
      "Sei sicuro di voler accedere per visualizzare o modificare le assenze e le esclusioni registrate?",
      () => apriDettaglioPartitaAssenze(p.id)
    );
  } else {
    apriDettaglioPartitaAssenze(p.id); // prossima e da registrare: nessun popup
  }
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

// ---------------------------------------------------------
// DETTAGLIO PARTITA
// ---------------------------------------------------------
const ETICHETTE_ASSENZA = { non_disponibile: 'INDISPONIBILE (0)', escluso: 'ESCLUSO (+1)' };

async function apriDettaglioPartitaAssenze(partitaId) {
  const p = partiteAssenzeCache.find(x => String(x.id) === String(partitaId));
  if (!p) return;

  partitaSelezionataAssenze = { id: p.id };

  document.getElementById('vista-elenco-partite-assenze').classList.add('hidden');
  document.getElementById('vista-dettaglio-partita-assenze').classList.remove('hidden');
  document.getElementById('assenze-titolo-partita').innerText = `Darsenal vs ${p.avversario}`;
  const d = new Date(p.data_ora);
  document.getElementById('assenze-data-partita').innerText = !isNaN(d) ? d.toLocaleString('it-IT') : '';
  document.getElementById('assenze-num-assenti').innerText = '- Assenti';

  const container = document.getElementById('assenze-lista-giocatori');
  container.innerHTML = `<div class="text-center text-xs text-slate-400 py-4">Caricamento giocatori...</div>`;

  const [{ data: dbG }, { data: sondaggi }, { data: salvate }] = await Promise.all([
    db.from('giocatori').select('*'),
    db.from('partite').select('id, data_ora, tipo_sondaggio'),
    db.from('assenze_partita').select('nome_utente, tipo').eq('id_calendario', p.id)
  ]);

  const giocatori = (dbG && dbG.length > 0) ? dbG : (typeof GIOCATORI_MOCK !== 'undefined' ? GIOCATORI_MOCK : []);

  // convocati = presenti sia sull'id del calendario sia su quello del sondaggio collegato
  const ids = [String(p.id)];
  const sondaggioId = trovaSondaggioIdPerPartita(p, sondaggi);
  if (sondaggioId) ids.push(sondaggioId);

  const { data: presenti } = await db.from('presenze')
    .select('nome_utente').in('id_partita', ids).eq('stato', 'Presente');

  const convocati = new Set((presenti || []).map(x => chiaveNome(x.nome_utente)));
  const scelteSalvate = {};
  (salvate || []).forEach(s => { scelteSalvate[chiaveNome(s.nome_utente)] = s.tipo; });

  giocatoriAssentiCorrenti = giocatori
    .map(g => g.nome_completo || g.nome)
    .filter(nome => !convocati.has(chiaveNome(nome)))
    .sort((a, b) => a.localeCompare(b, 'it'));

  document.getElementById('assenze-num-assenti').innerText = `${giocatoriAssentiCorrenti.length} Assenti`;

  if (giocatoriAssentiCorrenti.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 font-medium">Nessun giocatore assente per questa partita.</div>`;
    return;
  }

  container.innerHTML = giocatoriAssentiCorrenti.map((nome, idx) => {
    const valore = scelteSalvate[chiaveNome(nome)] || '';   // vuoto = nessuna scelta di default
    const testo = valore ? ETICHETTE_ASSENZA[valore] : 'Seleziona...';
    const colore = valore ? 'text-slate-700' : 'text-slate-400';
    return `
      <div class="p-2.5 flex justify-between items-center text-xs gap-2" data-idx="${idx}">
        <span class="font-bold text-slate-700 truncate w-[45%]" style="font-size: 11px;">${nome}</span>
        <div class="custom-select-wrapper relative w-[55%]">
          <div onclick="toggleCustomSelect('stato-assenza-${idx}')" id="display-stato-assenza-${idx}" class="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold cursor-pointer flex justify-between items-center">
            <span class="truncate ${colore}">${testo}</span>
            <svg class="w-3 h-3 text-slate-400 shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
          <div id="options-stato-assenza-${idx}" class="custom-select-options hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden">
            <div onclick="selezionaStatoAssenza(${idx}, 'non_disponibile')" class="p-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer border-b border-slate-50">INDISPONIBILE (0)</div>
            <div onclick="selezionaStatoAssenza(${idx}, 'escluso')" class="p-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">ESCLUSO (+1)</div>
          </div>
          <input type="hidden" id="input-stato-assenza-${idx}" value="${valore}">
        </div>
      </div>`;
  }).join('');
}

window.selezionaStatoAssenza = function(idx, valore) {
  document.getElementById(`input-stato-assenza-${idx}`).value = valore;
  const span = document.querySelector(`#display-stato-assenza-${idx} span`);
  if (span) {
    span.innerText = ETICHETTE_ASSENZA[valore];
    span.classList.remove('text-slate-400');
    span.classList.add('text-slate-700');
  }
  document.getElementById(`options-stato-assenza-${idx}`)?.classList.add('hidden');
};

// ---------------------------------------------------------
// SALVATAGGIO: tocca SOLO assenze_partita e il flag assenze_salvate
// ---------------------------------------------------------
async function salvaAssenzePartita() {
  if (typeof isAdmin !== 'undefined' && !isAdmin) return;
  if (!partitaSelezionataAssenze) return;
  const idCal = partitaSelezionataAssenze.id;

  const righe = [];
  const mancanti = [];
  giocatoriAssentiCorrenti.forEach((nome, idx) => {
    const tipo = document.getElementById(`input-stato-assenza-${idx}`)?.value;
    if (!tipo) mancanti.push(nome);
    else righe.push({ id_calendario: idCal, nome_utente: nome, tipo });
  });

  if (mancanti.length > 0) {
    return mostraAlert(`Scegli Indisponibile o Escluso per: ${mancanti.join(', ')}`);
  }

  const { error: errDel } = await db.from('assenze_partita').delete().eq('id_calendario', idCal);
  if (errDel) return mostraAlert("Errore nel salvataggio: " + errDel.message);

  if (righe.length > 0) {
    const { error: errIns } = await db.from('assenze_partita').insert(righe);
    if (errIns) return mostraAlert("Errore nel salvataggio: " + errIns.message);
  }

  const { error: errFlag } = await db.from('calendario_torneo').update({ assenze_salvate: true }).eq('id', idCal);
  if (errFlag) return mostraAlert("Salvate le scelte, ma non il flag: " + errFlag.message);

  await mostraAlert("Assenze ed esclusioni salvate con successo!");
  chiudiDettaglioPartitaAssenze();
  caricaPartiteAssenzeSupabase();
  caricaTabellaGiocatoriInfo();
  if (typeof currentUser !== 'undefined' && currentUser) caricaStatisticheUtente(currentUser);
}

function chiudiDettaglioPartitaAssenze() {
  document.getElementById('vista-dettaglio-partita-assenze')?.classList.add('hidden');
  document.getElementById('vista-elenco-partite-assenze')?.classList.remove('hidden');
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

