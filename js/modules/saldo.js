let partitaSelezionataCassa = null;
let giocatoriCacheCassa = [];

function apriSezioneCassa() {
    switchTab('saldo');
    switchTabCassa('squadra');
    caricaDatiCassaSupabase();
}

function switchTabCassa(tab) {
  if (tab === 'squadra') {
    document.getElementById('tab-squadra-view').classList.remove('hidden');
    document.getElementById('tab-giocatore-view').classList.add('hidden');
    document.getElementById('btn-tab-squadra').className = "flex-1 py-2 rounded-lg bg-white text-burgundy shadow-sm transition-all";
    document.getElementById('btn-tab-giocatore').className = "flex-1 py-2 rounded-lg text-slate-500 hover:text-slate-800 transition-all flex items-center justify-center gap-1";
    caricaDatiCassaSupabase();
  } else {
    document.getElementById('tab-squadra-view').classList.add('hidden');
    document.getElementById('tab-giocatore-view').classList.remove('hidden');
    document.getElementById('btn-tab-giocatore').className = "flex-1 py-2 rounded-lg bg-white text-burgundy shadow-sm transition-all flex items-center justify-center gap-1";
    document.getElementById('btn-tab-squadra').className = "flex-1 py-2 rounded-lg text-slate-500 hover:text-slate-800 transition-all";
    caricaPartiteCassaSupabase();
  }
}

async function caricaDatiCassaSupabase() {
  const container = document.getElementById('lista-saldi-squadra');
  const displaySaldoTotale = document.getElementById('display-saldo-squadra');
  const numGiocatoriEl = document.getElementById('num-giocatori-saldo');
  if (!container) return;

  container.innerHTML = `<div class="text-center text-xs text-slate-400 py-6">Caricamento saldi...</div>`;

  // Carica giocatori
  let giocatori = typeof GIOCATORI_MOCK !== 'undefined' ? GIOCATORI_MOCK : [];
  const { data: dbG } = await db.from('giocatori').select('*');
  if (dbG && dbG.length > 0) giocatori = dbG;
  giocatoriCacheCassa = giocatori;

  if (numGiocatoriEl) numGiocatoriEl.innerText = `${giocatori.length} Giocatori`;

  // Carica movimenti cassa da Supabase
  const { data: movimenti, error } = await db.from('movimenti_cassa').select('*');
  if (error) {
    container.innerHTML = `<div class="text-center text-xs text-rose-500 py-4">Errore caricamento movimenti.</div>`;
    return;
  }

  // Calcola saldo per ogni giocatore e totale cassa
  const saldiMap = {};
  giocatori.forEach(g => {
    const nome = g.nome_completo || g.nome;
    saldiMap[nome.toLowerCase()] = 0;
  });

  let totaleCassa = 0;
  (movimenti || []).forEach(m => {
    const imp = parseFloat(m.importo) || 0;
    const nomeKey = (m.nome_giocatore || '').toLowerCase().trim();
    
    // Somma solo i soldi dovuti all'arrotondamento / cassa squadra
    if (nomeKey === 'cassa squadra' || (m.causale && m.causale.toLowerCase().includes('arrotondamento'))) {
      totaleCassa += imp;
    }

    if (saldiMap[nomeKey] !== undefined) {
      saldiMap[nomeKey] += imp;
    } else {
      const trovato = Object.keys(saldiMap).find(k => k.includes(nomeKey) || nomeKey.includes(k));
      if (trovato) saldiMap[trovato] += imp;
    }
  });

  if (displaySaldoTotale) {
    displaySaldoTotale.innerText = `${totaleCassa.toFixed(2)} €`;
  }

  container.innerHTML = giocatori.map(g => {
    const nome = g.nome_completo || g.nome;
    const saldo = saldiMap[nome.toLowerCase()] || 0;
    const saldoFormatted = saldo >= 0 ? `+${saldo.toFixed(2)} €` : `${saldo.toFixed(2)} €`;
    const colorClass = saldo > 0 ? 'text-emerald-600 font-black' : (saldo < 0 ? 'text-rose-600 font-black' : 'text-slate-400');

    return `
      <div class="p-3.5 flex justify-between items-center text-xs border-b border-slate-50 last:border-0">
        <span class="font-bold text-slate-700">${nome}</span>
        <span class="${colorClass}">${saldoFormatted}</span>
      </div>
    `;
  }).join('');
}

async function caricaPartiteCassaSupabase() {
  const container = document.getElementById('lista-partite-cassa');
  if (!container) return;

  container.innerHTML = `<div class="text-center text-xs text-slate-400 py-6">Caricamento partite...</div>`;

  // Leggiamo direttamente dal calendario ufficiale del torneo
  const { data: partite, error } = await db.from('calendario_torneo').select('*').order('data_ora', { ascending: false });
  if (error || !partite) {
    container.innerHTML = `<div class="text-center text-xs text-rose-500 py-4">Errore caricamento.</div>`;
    return;
  }

  // Filtriamo solo le partite in cui gioca il Darsenal
  const partiteDarsenal = partite.filter(p => {
    const casa = (p.squadra_casa || '').toLowerCase();
    const trasf = (p.squadra_trasferta || '').toLowerCase();
    return casa.includes('darsenal') || trasf.includes('darsenal');
  });

  if (partiteDarsenal.length === 0) {
    container.innerHTML = `<div class="text-center text-xs text-slate-400 py-6">Nessuna partita trovata in calendario.</div>`;
    return;
  }

  const adesso = new Date();

  container.innerHTML = partiteDarsenal.map(p => {
    const d = new Date(p.data_ora);
    const dataFormatted = !isNaN(d) ? d.toLocaleDateString('it-IT', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Data ignota';
    const isPassata = d <= adesso;
    const avversario = p.squadra_casa.toLowerCase().includes('darsenal') ? p.squadra_trasferta : p.squadra_casa;
    
    const badgeStato = isPassata 
      ? '<span class="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-black">Giocata</span>' 
      : '<span class="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-black">Da giocare</span>';

    return `
      <div onclick="apriDettaglioSpogliatoioPartita('${p.id}')" class="p-4 rounded-2xl border bg-white border-burgundy border-2 shadow-md cursor-pointer flex justify-between items-center transition-all hover:bg-slate-50">
        <div>
          <p class="font-black text-xs text-slate-800">Darsenal vs ${avversario}</p>
          <p class="text-[10px] text-slate-400 font-bold">${dataFormatted} ${p.giornata ? `- ${p.giornata}` : ''}</p>
        </div>
        <div class="flex items-center gap-2">
          ${badgeStato}
          <span class="text-[9px] bg-burgundy text-white px-2 py-0.5 rounded-full font-black">Spogliatoio</span>
        </div>
      </div>
    `;
  }).join('');
}

async function apriDettaglioSpogliatoioPartita(partitaId) {
  let { data: partita } = await db.from('partite').select('*').eq('id', partitaId).single();
  if (!partita) {
    const { data: cal } = await db.from('calendario_torneo').select('*').eq('id', partitaId).single();
    if (cal) {
      const avversario = cal.squadra_casa.toLowerCase().includes('darsenal') ? cal.squadra_trasferta : cal.squadra_casa;
      partita = {
        id: cal.id,
        squadra_avversaria: avversario,
        data_ora: cal.data_ora,
        luogo: cal.luogo
      };
    }
  }
  if (!partita) return;
  partitaSelezionataCassa = partita;

  partitaSelezionataCassa = partita;
  document.getElementById('vista-elenco-partite').classList.add('hidden');
  document.getElementById('vista-dettaglio-partita').classList.remove('hidden');

  document.getElementById('spog-titolo-partita').innerText = `Darsenal vs ${partita.squadra_avversaria}`;
  
  const dPartita = new Date(partita.data_ora);
  const dataOraFormatted = !isNaN(dPartita) ? dPartita.toLocaleString('it-IT', { timeZone: 'UTC' }) : '';
  document.getElementById('spog-data-partita').innerText = dataOraFormatted;

  // Recupera i presenti effettivi dal sondaggio SOLO per questo specifico ID partita
  const { data: presenze } = await db.from('presenze').select('*').eq('id_partita', partitaId).eq('stato', 'Presente');

  let presentiList = [];
  
  // Se l'admin ha salvato esplicitamente delle scelte (es. i 12 convocati ufficiali), usiamo quelle
  if (partita.scelte_admin && Array.isArray(partita.scelte_admin) && partita.scelte_admin.length > 0) {
    presentiList = partita.scelte_admin;
  } else if (presenze && presenze.length > 0) {
    // Altrimenti usiamo chi ha votato "Presente" nel sondaggio
    presentiList = presenze.map(pr => pr.nome_utente);
  } else {
    // Se la partita è futura e nessuno ha votato (o non c'è sondaggio), la lista deve essere VUOTA (0 giocatori, niente default a 12)
    presentiList = [];
  }

  const numPresenti = presentiList.length;
  const costoCampo = 50;
  const quotaEsatta = numPresenti > 0 ? costoCampo / numPresenti : 0;
  const quotaArrotondata = Math.ceil(quotaEsatta * 10) / 10;
  const cassaGenerata = numPresenti > 0 ? (quotaArrotondata * numPresenti) - costoCampo : 0;

  document.getElementById('spog-num-presenti').innerText = numPresenti;
  document.getElementById('spog-quota-testa').innerText = `${quotaArrotondata.toFixed(2)} €`;
  document.getElementById('spog-cassa-partita').innerText = `+${cassaGenerata.toFixed(2)} €`;

  const container = document.getElementById('spog-lista-giocatori');
  if (presentiList.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 font-medium">Nessun giocatore convocato o presente registrato per questa partita (il sondaggio non è ancora attivo o non ci sono voti).</div>`;
    return;
  }

  container.innerHTML = presentiList.map((nomeGiocatore, idx) => `
    <div class="p-2.5 grid grid-cols-12 items-center text-xs gap-1" data-giocatore="${escapeHtmlAttr(nomeGiocatore)}">
      <span class="col-span-4 font-bold text-slate-700 truncate">${nomeGiocatore}</span>
      <input type="number" step="0.10" id="input-dati-${idx}" oninput="calcolaRestoRow(${idx}, ${quotaArrotondata})" placeholder="${quotaArrotondata.toFixed(2)}" class="col-span-3 p-1.5 bg-slate-50 border rounded-lg text-center font-bold text-xs">
      <input type="number" step="0.10" id="input-resto-${idx}" oninput="calcolaRestoRow(${idx}, ${quotaArrotondata})" placeholder="0.00" class="col-span-3 p-1.5 bg-slate-50 border rounded-lg text-center font-bold text-xs">
      <span id="saldo-res-${idx}" class="col-span-2 text-center font-black text-slate-400">0.00 €</span>
    </div>
  `).join('');
}

function calcolaRestoRow(idx, quota) {
  const dati = parseFloat(document.getElementById(`input-dati-${idx}`).value) || 0;
  const restoDato = parseFloat(document.getElementById(`input-resto-${idx}`).value) || 0;
  
  const risultato = (dati - restoDato) - quota;
  const display = document.getElementById(`saldo-res-${idx}`);

  if (risultato > 0) {
    display.innerText = `+${risultato.toFixed(2)} €`;
    display.className = "col-span-2 text-center font-black text-emerald-600";
  } else if (risultato < 0) {
    display.innerText = `${risultato.toFixed(2)} €`;
    display.className = "col-span-2 text-center font-black text-rose-600";
  } else {
    display.innerText = `0.00 €`;
    display.className = "col-span-2 text-center font-black text-slate-400";
  }
}

async function salvaIncassoPartita() {
  if (!partitaSelezionataCassa) return;

  const rows = document.querySelectorAll('#spog-lista-giocatori > div');
  const movimentiDaInserire = [];

  let numPresenti = 0;
  rows.forEach((row, idx) => {
    const nome = row.getAttribute('data-giocatore');
    const dati = parseFloat(document.getElementById(`input-dati-${idx}`).value) || 0;
    const resto = parseFloat(document.getElementById(`input-resto-${idx}`).value) || 0;
    const quota = parseFloat(document.getElementById('spog-quota-testa').innerText) || 0;

    const importoVersatoNetto = (dati - resto);
    const movimentoNetto = importoVersatoNetto - quota;

    if (importoVersatoNetto > 0) {
      numPresenti++;
      movimentiDaInserire.push({
        nome_giocatore: nome,
        importo: movimentoNetto,
        causale: `Partita vs ${partitaSelezionataCassa.squadra_avversaria}`
      });
    }
  });

  // Calcolo e inserimento specifico dell'arrotondamento per la cassa squadra
  const costoCampo = 50;
  const quotaEsatta = numPresenti > 0 ? costoCampo / numPresenti : 0;
  const quotaArrotondata = Math.ceil(quotaEsatta * 10) / 10;
  const cassaGenerata = numPresenti > 0 ? (quotaArrotondata * numPresenti) - costoCampo : 0;

  if (cassaGenerata > 0) {
    movimentiDaInserire.push({
      nome_giocatore: 'Cassa Squadra',
      importo: cassaGenerata,
      causale: `Arrotondamento Partita vs ${partitaSelezionataCassa.squadra_avversaria}`
    });
  }

  if (movimentiDaInserire.length > 0) {
    const { error } = await db.from('movimenti_cassa').insert(movimentiDaInserire);
    if (error) return mostraAlert("Errore salvataggio movimenti: " + error.message);
  }

  mostraAlert("Incasso registrato con successo e saldi aggiornati!");
  chiudiDettaglioPartita();
  caricaDatiCassaSupabase();
}

function chiudiDettaglioPartita() {
  document.getElementById('vista-dettaglio-partita').classList.add('hidden');
  document.getElementById('vista-elenco-partite').classList.remove('hidden');
}