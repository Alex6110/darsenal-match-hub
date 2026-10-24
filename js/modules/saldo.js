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
    saldiMap[nome.toLowerCase().trim()] = 0;
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
    const saldo = saldiMap[nome.toLowerCase().trim()] || 0;
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

  // MODIFICA PUNTO 2: Ordinamento crescente (ascending: true) -> Prima giocata in alto, ultima in basso
  const { data: partite, error } = await db.from('calendario_torneo').select('*').order('data_ora', { ascending: true });
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

  // Carica tutti i movimenti per capire quali partite sono già state registrate/salvate
  const { data: tuttiMovimenti } = await db.from('movimenti_cassa').select('causale');
  const causaliSalvate = (tuttiMovimenti || []).map(m => (m.causale || '').toLowerCase());

  container.innerHTML = partiteDarsenal.map(p => {
    const d = new Date(p.data_ora);
    const dataFormatted = !isNaN(d) ? d.toLocaleDateString('it-IT', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Data ignota';
    const isPassata = d <= adesso;
    const avversario = p.squadra_casa.toLowerCase().includes('darsenal') ? p.squadra_trasferta : p.squadra_casa;
    const giaSalvata = causaliSalvate.some(c => c.includes(avversario.toLowerCase().trim()));

    let badgeStato = '';
    let cardStyle = '';

    // MODIFICA PUNTO 3: Protezioni visive sulle card
    if (giaSalvata) {
      badgeStato = '<span class="text-[9px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">Giocata e Salvata</span>';
      cardStyle = 'bg-slate-50 border-slate-200 opacity-90 cursor-pointer';
    } else if (isPassata) {
      badgeStato = '<span class="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-black">Da Registrare</span>';
      cardStyle = 'bg-white border-burgundy border-2 shadow-md cursor-pointer';
    } else {
      badgeStato = '<span class="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-black">Prossima</span>';
      cardStyle = 'bg-white border-slate-200 shadow-sm cursor-pointer';
    }

    return `
      <div onclick="confermaEDettaglioPartita('${p.id}', ${giaSalvata})" class="p-4 rounded-2xl border ${cardStyle} transition-all hover:scale-[1.01]">
        <div class="flex justify-between items-center">
          <div>
            <p class="font-black text-xs text-slate-800">Darsenal vs ${avversario}</p>
            <p class="text-[10px] text-slate-400 font-bold">${dataFormatted} ${p.giornata ? `- ${p.giornata}` : ''}</p>
          </div>
          <div class="flex items-center gap-2">
            ${badgeStato}
            <span class="text-[9px] bg-burgundy text-white px-2 py-0.5 rounded-full font-black">Spogliatoio</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// MODIFICA PUNTO 3: Funzione di protezione prima dell'apertura
function confermaEDettaglioPartita(partitaId, giaSalvata) {
  if (giaSalvata) {
    if (typeof mostraConfirm === 'function') {
      mostraConfirm("Sei sicuro di voler accedere per visualizzare o modificare una partita con incasso già salvato?", () => {
        apriDettaglioSpogliatoioPartita(partitaId);
      });
    } else if (confirm("Sei sicuro di voler accedere per visualizzare o modificare una partita con incasso già salvato?")) {
      apriDettaglioSpogliatoioPartita(partitaId);
    }
  } else {
    apriDettaglioSpogliatoioPartita(partitaId);
  }
}

async function apriDettaglioSpogliatoioPartita(partitaId) {
  let { data: partita } = await db.from('partite').select('*').eq('id', partitaId).single();
  let actualPartitaId = partitaId;

  if (!partita) {
    const { data: cal } = await db.from('calendario_torneo').select('*').eq('id', partitaId).single();
    if (cal) {
      const avversario = cal.squadra_casa.toLowerCase().includes('darsenal') ? cal.squadra_trasferta : cal.squadra_casa;
      
      const { data: matchPartite } = await db.from('partite').select('*');
      if (matchPartite && matchPartite.length > 0) {
        const found = matchPartite.find(p => 
          (p.squadra_avversaria || '').toLowerCase().trim() === avversario.toLowerCase().trim() ||
          (p.squadra_avversaria || '').toLowerCase().includes(avversario.toLowerCase()) ||
          avversario.toLowerCase().includes((p.squadra_avversaria || '').toLowerCase())
        );
        if (found) {
          partita = found;
          actualPartitaId = found.id;
        }
      }

      if (!partita) {
        partita = {
          id: cal.id,
          squadra_avversaria: avversario,
          data_ora: cal.data_ora,
          luogo: cal.luogo
        };
        actualPartitaId = cal.id;
      }
    }
  } else {
    actualPartitaId = partita.id;
  }

  if (!partita) return;
  partitaSelezionataCassa = partita;

  document.getElementById('vista-elenco-partite').classList.add('hidden');
  document.getElementById('vista-dettaglio-partita').classList.remove('hidden');

  document.getElementById('spog-titolo-partita').innerText = `Darsenal vs ${partita.squadra_avversaria}`;
  
  const dPartita = new Date(partita.data_ora);
  const dataOraFormatted = !isNaN(dPartita) ? dPartita.toLocaleString('it-IT', { timeZone: 'UTC' }) : '';
  document.getElementById('spog-data-partita').innerText = dataOraFormatted;

  // Recupera i presenti effettivi dal sondaggio
  const { data: presenze } = await db.from('presenze').select('*').eq('id_partita', actualPartitaId).eq('stato', 'Presente');

  let presentiList = [];
  if (partita.scelte_admin && Array.isArray(partita.scelte_admin) && partita.scelte_admin.length > 0) {
    presentiList = partita.scelte_admin;
  } else if (presenze && presenze.length > 0) {
    presentiList = presenze.map(pr => pr.nome_utente);
  } else {
    presentiList = [];
  }

  // MODIFICA PUNTO 3: Logica Arrotondamento dall'HTML di prova
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
    container.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 font-medium">Nessun giocatore convocato o presente registrato per questa partita.</div>`;
    return;
  }

  // MODIFICA PUNTO 1: Carichiamo i movimenti salvati in precedenza per pre-compilare gli input
  const { data: movimentiEsistenti } = await db.from('movimenti_cassa')
    .select('*')
    .ilike('causale', `%Partita vs ${partita.squadra_avversaria}%`);

  const movimentiMap = {};
  if (movimentiEsistenti && movimentiEsistenti.length > 0) {
    movimentiEsistenti.forEach(m => {
      movimentiMap[(m.nome_giocatore || '').toLowerCase().trim()] = m;
    });
  }

  container.innerHTML = presentiList.map((nomeGiocatore, idx) => {
    const key = nomeGiocatore.toLowerCase().trim();
    const mov = movimentiMap[key];
    
    // Se la partita era già salvata, calcoliamo a ritroso il dato versato rispetto alla quota
    let valDati = '';
    let valResto = '';

    if (mov) {
      const imp = parseFloat(mov.importo) || 0;
      const versatoCalcolato = imp + quotaArrotondata;
      if (versatoCalcolato > 0) {
        valDati = versatoCalcolato.toFixed(2);
      }
    }

    return `
      <div class="p-2.5 grid grid-cols-12 items-center text-xs gap-1" data-giocatore="${escapeHtmlAttr(nomeGiocatore)}">
        <span class="col-span-4 font-bold text-slate-700 truncate">${nomeGiocatore}</span>
        <input type="number" step="0.10" id="input-dati-${idx}" value="${valDati}" oninput="calcolaRestoRow(${idx}, ${quotaArrotondata})" placeholder="${quotaArrotondata.toFixed(2)}" class="col-span-3 p-1.5 bg-slate-50 border rounded-xl text-center font-bold text-xs">
        <input type="number" step="0.10" id="input-resto-${idx}" value="${valResto}" oninput="calcolaRestoRow(${idx}, ${quotaArrotondata})" placeholder="0.00" class="col-span-3 p-1.5 bg-slate-50 border rounded-xl text-center font-bold text-xs">
        <span id="saldo-res-${idx}" class="col-span-2 text-center font-black text-slate-400">0.00 €</span>
      </div>
    `;
  }).join('');

  // Eseguiamo il calcolo iniziale per aggiornare le etichette dei saldi
  presentiList.forEach((_, idx) => {
    calcolaRestoRow(idx, quotaArrotondata);
  });
}

function calcolaRestoRow(idx, quota) {
  const datiInput = document.getElementById(`input-dati-${idx}`);
  const restoInput = document.getElementById(`input-resto-${idx}`);
  if (!datiInput || !restoInput) return;

  const dati = parseFloat(datiInput.value) || 0;
  const restoDato = parseFloat(restoInput.value) || 0;
  
  const risultato = (dati - restoDato) - quota;
  const display = document.getElementById(`saldo-res-${idx}`);
  if (!display) return;

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

  const causalePartita = `Partita vs ${partitaSelezionataCassa.squadra_avversaria}`;

  // Eliminiamo i vecchi movimenti di questa partita per sovrascrivere pulito
  await db.from('movimenti_cassa').delete().ilike('causale', `%${causalePartita}%`);

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

    if (dati > 0 || resto > 0 || importoVersatoNetto > 0) {
      numPresenti++;
      movimentiDaInserire.push({
        nome_giocatore: nome,
        importo: movimentoNetto,
        causale: causalePartita
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
      causale: `Arrotondamento ${causalePartita}`
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