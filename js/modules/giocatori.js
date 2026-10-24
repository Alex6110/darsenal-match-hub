let partitaSelezionataAssenze = null;

// Carica e calcola le statistiche personali per il menu laterale dell'utente
async function caricaStatisticheUtente(nomeUtente) {
  if (!nomeUtente) return;

  const nomeNorm = nomeUtente.toLowerCase().trim();

  try {
    const adesso = new Date();

    // 1. Carica calendario, presenze, eventi e sondaggi (partite) per allineare gli ID
    const [{ data: calendario }, { data: presenze }, { data: eventi }, { data: tuttePartiteSondaggio }] = await Promise.all([
      db.from('calendario_torneo').select('*').order('data_ora', { ascending: false }),
      db.from('presenze').select('*'),
      db.from('eventi_partita').select('*'),
      db.from('partite').select('id, data_ora')
    ]);

    // Filtra solo le partite del torneo GIÀ GIOCATE dalla squadra
    const partiteGiocateSquadra = (calendario || []).filter(p => 
      p.completata || p.risultato || new Date(p.data_ora) <= adesso
    );

    const numPartiteSquadra = partiteGiocateSquadra.length;
    
    // Mappa gli ID validi (sia id di calendario_torneo che id di partite/sondaggi collegati per data)
    const validMatchIds = new Set();
    partiteGiocateSquadra.forEach(p => {
      validMatchIds.add(String(p.id));
      const sondaggio = (tuttePartiteSondaggio || []).find(s => s.data_ora === p.data_ora);
      if (sondaggio) {
        validMatchIds.add(String(sondaggio.id));
      }
    });

    // Filtra le presenze del giocatore per le partite giocate
    const presenzeGiocatore = (presenze || []).filter(p => {
      const matchId = String(p.id_partita || p.id_sondaggio || p.partita_id);
      return (p.nome_utente || '').toLowerCase().trim() === nomeNorm && validMatchIds.has(matchId);
    });

    // Presenze effettive (nominatore) / Partite totali giocate dalla squadra (denominatore)
    const presenzeTotali = presenzeGiocatore.filter(p => p.stato === 'Presente').length;
    const esclusioniTotali = presenzeGiocatore.filter(p => p.stato === 'Escluso').length;
    const assenzeTotali = Math.max(0, numPartiteSquadra - presenzeTotali);

    // Ultima giocata
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

    // Gol e Cartellini
    const eventiGiocatore = (eventi || []).filter(e => 
      (e.nome_utente || '').toLowerCase().trim() === nomeNorm && validMatchIds.has(String(e.id_partita))
    );

    const gol = eventiGiocatore.filter(e => e.tipo === 'gol').length;
    const gialli = eventiGiocatore.filter(e => e.tipo === 'giallo').length;
    const rossi = eventiGiocatore.filter(e => e.tipo === 'rosso').length;

    // Aggiorna UI del menu laterale (Presenze Totali formato Nominatore / Denominatore)
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

// Apre la sezione Giocatori come pagina principale (stile saldo.js)
function apriSezioneGiocatori() {
  switchTab('giocatori');
  switchTabGiocatori('info');
  
  // Mostra o nasconde la tab assenze in base ai permessi admin
  const btnTabAssenze = document.getElementById('btn-tab-giocatori-assenze');
  if (btnTabAssenze) {
    if (typeof isAdmin !== 'undefined' && isAdmin) {
      btnTabAssenze.classList.remove('hidden');
    } else {
      btnTabAssenze.classList.add('hidden');
    }
  }
}

// Gestione dei tab all'interno della pagina Giocatori / Assenze
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

// Rinomina la funzione di caricamento tabella rimuovendo i riferimenti alla modale
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

      // Alternanza colori righe tabella (pari bianco, dispari grigio chiaro)
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
          <td class="p-2.5 pl-3 w-[38%] truncate">
            <span class="font-bold text-slate-800 text-xs block leading-tight truncate">${cognome}</span>
            <span class="font-bold text-slate-600 text-xs block leading-tight truncate">${nomeProprio}</span>
          </td>
          <td class="p-2 text-center font-bold text-slate-700 w-[10%]">${presenzeFormatte}</td>
          <td class="p-2 text-center text-slate-500 font-semibold w-[10%]">${esclusioni} / ${assenzeTotali}</td>
          <td class="p-2 text-center text-slate-500 text-[11px] w-[22%]">${ultima}</td>
          <td class="p-2 text-center font-black text-burgundy w-[7%]">${gol}</td>
          <td class="p-2 text-center font-bold text-amber-500 w-[6%]">${gialli}</td>
          <td class="p-2 text-center font-bold text-rose-600 w-[7%]">${rossi}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error("Errore caricamento tabella giocatori:", err);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-xs text-rose-500 py-4">Errore caricamento dati.</td></tr>`;
  }
}

// Aggiornamento container partite assenze per puntare a 'lista-partite-assenze'
async function caricaPartiteAssenzeSupabase() {
  const container = document.getElementById('lista-partite-assenze');
  if (!container) return;

  container.innerHTML = `<div class="text-center text-xs text-slate-400 py-6">Caricamento partite...</div>`;

  const { data: partite, error } = await db.from('calendario_torneo').select('*').order('data_ora', { ascending: true });
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

  container.innerHTML = partiteDarsenal.map(p => {
    const d = new Date(p.data_ora);
    const dataFormatted = !isNaN(d) ? d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const oraFormatted = !isNaN(d) ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
    const avversario = p.squadra_casa.toLowerCase().includes('darsenal') ? p.squadra_trasferta : p.squadra_casa;

    return `
      <div onclick="apriDettaglioPartitaAssenze('${p.id}', '${escapeHtmlAttr(avversario)}', '${p.data_ora}')" class="p-4 rounded-2xl border bg-white border-slate-200 shadow-sm cursor-pointer transition-all hover:scale-[1.01]">
        <div class="flex justify-between items-center">
          <div>
            <p class="font-black text-xs text-slate-800">Darsenal vs ${avversario}</p>
            <p class="text-[10px] text-slate-400 font-bold">${dataFormatted} alle ${oraFormatted}</p>
          </div>
          <span class="text-[9px] bg-burgundy/10 text-burgundy px-2.5 py-0.5 rounded-full font-black">Gestisci Assenze</span>
        </div>
      </div>
    `;
  }).join('');
}

// Mostra il dettaglio con i giocatori non presenti e i selettori Indisponibile / Escluso
async function apriDettaglioPartitaAssenze(partitaId, avversario, dataOra) {
  partitaSelezionataAssenze = { id: partitaId, avversario, dataOra };

  document.getElementById('vista-elenco-partite-assenze').classList.add('hidden');
  document.getElementById('vista-dettaglio-partita-assenze').classList.remove('hidden');

  document.getElementById('assenze-titolo-partita').innerText = `Darsenal vs ${avversario}`;
  const d = new Date(dataOra);
  document.getElementById('assenze-data-partita').innerText = !isNaN(d) ? d.toLocaleString('it-IT') : '';

  const container = document.getElementById('assenze-lista-giocatori');
  container.innerHTML = `<div class="text-center text-xs text-slate-400 py-4">Caricamento giocatori...</div>`;

  // Carica tutti i giocatori della rosa
  let giocatori = typeof GIOCATORI_MOCK !== 'undefined' ? GIOCATORI_MOCK : [];
  const { data: dbG } = await db.from('giocatori').select('*');
  if (dbG && dbG.length > 0) giocatori = dbG;

  // Carica le presenze registrate per questa partita
  const { data: presenze } = await db.from('presenze').select('*').eq('id_partita', partitaId);
  const presenzeMap = {};
  (presenze || []).forEach(pr => {
    presenzeMap[(pr.nome_utente || '').toLowerCase().trim()] = pr.stato; // 'Presente', 'Assente', 'Escluso'
  });

  // Filtra SOLO i giocatori che NON sono presenti (quindi Assenti o Esclusi o non registrati)
  const giocatoriNonPresenti = giocatori.filter(g => {
    const nome = g.nome_completo || g.nome;
    const stato = presenzeMap[nome.toLowerCase().trim()];
    return stato !== 'Presente';
  });

  if (giocatoriNonPresenti.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 font-medium">Tutti i giocatori sono stati presenti a questa partita!</div>`;
    return;
  }

  container.innerHTML = giocatoriNonPresenti.map((g, idx) => {
    const nome = g.nome_completo || g.nome;
    const statoCorrente = presenzeMap[nome.toLowerCase().trim()];
    // Se lo stato salvato è 'Escluso' usiamo quello, altrimenti default 'Assente' (Indisponibile)
    const isEscluso = statoCorrente === 'Escluso';

    return `
      <div class="p-3 flex justify-between items-center text-xs gap-2" data-giocatore-assente="${escapeHtmlAttr(nome)}">
        <span class="font-bold text-slate-700 truncate w-1/2">${nome}</span>
        <select id="select-assenza-${idx}" class="w-1/2 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-burgundy cursor-pointer">
          <option value="Assente" ${!isEscluso ? 'selected' : ''}>Indisponibilità</option>
          <option value="Escluso" ${isEscluso ? 'selected' : ''}>Esclusione (+1 pt)</option>
        </select>
      </div>
    `;
  }).join('');
}

function chiudiDettaglioPartitaAssenze() {
  document.getElementById('vista-dettaglio-partita-assenze').classList.add('hidden');
  document.getElementById('vista-elenco-partite-assenze').classList.remove('hidden');
}

// Salva le decisioni e aggiorna il database e le statistiche esclusioni
async function salvaAssenzePartita() {
  if (!partitaSelezionataAssenze) return;

  const rows = document.querySelectorAll('#assenze-lista-giocatori > div');
  const partiteId = partitaSelezionataAssenze.id;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const nome = row.getAttribute('data-giocatore-assente');
    const selectEl = document.getElementById(`select-assenza-${idx}`);
    const nuovoStato = selectEl ? selectEl.value : 'Assente'; // 'Escluso' o 'Assente'

    if (nome) {
      // Verifica se esiste già un record presenze per questo utente e partita
      const { data: esiste } = await db.from('presenze')
        .select('*')
        .eq('id_partita', partiteId)
        .ilike('nome_utente', nome);

      if (esiste && esiste.length > 0) {
        await db.from('presenze')
          .update({ stato: nuovoStato })
          .eq('id_partita', partiteId)
          .ilike('nome_utente', nome);
      } else {
        await db.from('presenze').insert([{
          id_partita: partiteId,
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

// Helper di sicurezza per attributi HTML
function escapeHtmlAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}