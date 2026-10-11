// js/modules/convocazioni.js

// Recupera la posizione in campo del giocatore dal mock
function getPosizioneGiocatore(nome) {
  if (typeof GIOCATORI_MOCK === 'undefined') return 'Giocatore';
  const norm = (str) => str?.toLowerCase().trim().split(/\s+/).sort().join(' ');
  const g = GIOCATORI_MOCK.find(item => norm(item.nome_completo) === norm(nome));
  return g ? (g.posizione || 'Giocatore') : 'Giocatore';
}

// Algoritmo Convocazioni con Limiti Massimi, Protezioni Minime e Turnover Presenze
function calcolaConvocazioniEParita(presenti, tuttePresenzeStorico, scelteManualAdmin = []) {
  if (!presenti || presenti.length === 0) {
    return { convocati: [], inAttesa: [], inParita: [], haParita: false };
  }

  // Fino a 12 presenti: tutti convocati normalmente
  if (presenti.length <= 12) {
    return { convocati: presenti.map(p => p.nome_utente), inAttesa: [], inParita: [], haParita: false };
  }

  // Mappatura giocatori con posizione e presenze totali
  const listaMappata = presenti.map(p => {
    const presenzeTotali = tuttePresenzeStorico.filter(
      st => st.nome_utente?.toLowerCase() === p.nome_utente?.toLowerCase() && st.stato === 'Presente'
    ).length;

    return {
      nome: p.nome_utente,
      posizione: getPosizioneGiocatore(p.nome_utente),
      presenzeTotali
    };
  });

  // Se l'Admin ha già confermato manualmente i 12 convocati
  if (scelteManualAdmin && scelteManualAdmin.length === 12) {
    const convocati = Array.from(new Set(scelteManualAdmin));
    const esclusi = listaMappata.filter(g => !convocati.includes(g.nome)).map(g => g.nome);
    return { convocati, inAttesa: esclusi, inParita: [], haParita: false };
  }

  let candidati = [...listaMappata];
  const sortByPres = (arr) => arr.sort((a, b) => a.presenzeTotali - b.presenzeTotali);

  // 1. APPLICAZIONE LIMITI MASSIMI
  // Portiere: Max 1 (chi ha più presenze viene escluso dai candidati)
  const portieri = sortByPres(candidati.filter(g => g.posizione === 'Portiere'));
  if (portieri.length > 1) {
    const portieriEsclusi = portieri.slice(1);
    candidati = candidati.filter(g => !portieriEsclusi.includes(g));
  }

  // Centrocampisti: Max 2
  const centro = sortByPres(candidati.filter(g => g.posizione === 'Centrocampista'));
  if (centro.length > 2) {
    const centroEsclusi = centro.slice(2);
    candidati = candidati.filter(g => !centroEsclusi.includes(g));
  }

  // Attaccanti: Max 2
  const att = sortByPres(candidati.filter(g => g.posizione === 'Attaccante'));
  if (att.length > 2) {
    const attEsclusi = att.slice(2);
    candidati = candidati.filter(g => !attEsclusi.includes(g));
  }

  // Se dopo l'applicazione dei limiti massimi rimangono esattamente 12 o meno
  if (candidati.length <= 12) {
    const convocati = candidati.map(g => g.nome);
    const inAttesa = listaMappata.filter(g => !convocati.includes(g.nome)).map(g => g.nome);
    return { convocati, inAttesa, inParita: [], haParita: false };
  }

  // 2. GARANZIA REQUISITI MINIMI (Almeno 2 Difensori, 2 Esterni, 1 Centrocampista, 1 Portiere)
  let protetti = [];
  const dif = sortByPres(candidati.filter(g => g.posizione === 'Difensore'));
  if (dif.length >= 2) protetti.push(...dif.slice(0, 2));

  const est = sortByPres(candidati.filter(g => g.posizione === 'Esterno'));
  if (est.length >= 2) protetti.push(...est.slice(0, 2));

  const cen = sortByPres(candidati.filter(g => g.posizione === 'Centrocampista'));
  if (cen.length >= 1 && !protetti.some(g => g.posizione === 'Centrocampista')) protetti.push(cen[0]);

  const por = candidati.find(g => g.posizione === 'Portiere');
  if (por && !protetti.includes(por)) protetti.push(por);

  // 3. CONFRONTO INCROCIATO PRESENZE PURE SUI POSTI RIMANENTI
  let nonProtetti = candidati.filter(g => !protetti.includes(g));
  nonProtetti.sort((a, b) => a.presenzeTotali - b.presenzeTotali);

  const postiRimanenti = 12 - protetti.length;
  const cutoffPresenze = nonProtetti[postiRimanenti - 1]?.presenzeTotali;

  if (cutoffPresenze !== undefined) {
    const inSoglia = nonProtetti.filter(g => g.presenzeTotali === cutoffPresenze);
    const sottoSoglia = nonProtetti.filter(g => g.presenzeTotali < cutoffPresenze);
    const postiDaScegliereInSoglia = postiRimanenti - sottoSoglia.length;

    if (inSoglia.length > postiDaScegliereInSoglia) {
      // Parità rilevata: richiede la scelta dell'Admin
      return {
        convocati: Array.from(new Set([...protetti.map(g => g.nome), ...sottoSoglia.map(g => g.nome)])),
        inAttesa: listaMappata.filter(g => !candidati.includes(g)).map(g => g.nome),
        inParita: inSoglia.map(g => g.nome),
        postiDaScegliere: postiDaScegliereInSoglia,
        haParita: true
      };
    }
  }

  const sceltiNonProtetti = nonProtetti.slice(0, postiRimanenti);
  const convocati = Array.from(new Set([...protetti.map(g => g.nome), ...sceltiNonProtetti.map(g => g.nome)]));
  const inAttesa = listaMappata.filter(g => !convocati.includes(g.nome)).map(g => g.nome);

  return { convocati, inAttesa, inParita: [], haParita: false };
}

let datiSpareggioCorrente = null;

// Modale Admin Riprogettata suddivisa per Ruoli con Contatori
async function apriModalSpareggio(partitaId) {
  datiSpareggioCorrente = { partitaId };

  const modal = document.getElementById('modal-spareggio-admin');
  const container = document.getElementById('spareggio-lista-giocatori');
  if (!modal || !container) return;

  // Recupera presenze, partite e calendario per associare la data ad ogni voto
  const [{ data: presenzePartita }, { data: tuttePresenze }, { data: tuttePartite }, { data: calendario }] = await Promise.all([
    db.from('presenze').select('*').eq('id_partita', partitaId).eq('stato', 'Presente'),
    db.from('presenze').select('*').eq('stato', 'Presente'),
    db.from('partite').select('id, data_ora'),
    db.from('calendario_torneo').select('id, data_ora')
  ]);

  // Mappa id_partita -> data_ora
  const dateMap = {};
  (tuttePartite || []).forEach(p => { dateMap[String(p.id)] = p.data_ora; });
  (calendario || []).forEach(c => { dateMap[String(c.id)] = c.data_ora; });

  const adesso = new Date();

 // Mantiene solo i voti 'Presente' riferiti a partite di TORNEO con data_ora passata (esclude amichevoli/custom)
  const tipoPartitaMap = {};
  (tuttePartite || []).forEach(p => { tipoPartitaMap[String(p.id)] = p.tipo_sondaggio; });

  const presenzePassate = (tuttePresenze || []).filter(pr => {
    const matchId = pr.id_partita || pr.id_sondaggio || pr.partita_id;
    const dataOra = dateMap[String(matchId)];
    const tipo = tipoPartitaMap[String(matchId)];
    const isAmichevoleOcustom = tipo === 'amichevole' || tipo === 'disponibilita' || tipo === 'multi';
    return dataOra && new Date(dataOra) <= adesso && !isAmichevoleOcustom;
  });

  const presenti = presenzePartita || [];
  const ruoli = ['Portiere', 'Difensore', 'Centrocampista', 'Esterno', 'Attaccante'];

  const ruoliHTML = ruoli.map(ruolo => {
    const giocatoriRuolo = presenti.filter(p => getPosizioneGiocatore(p.nome_utente) === ruolo);
    if (giocatoriRuolo.length === 0) return '';

    const items = giocatoriRuolo.map(p => {
      const presTot = presenzePassate.filter(st => st.nome_utente?.toLowerCase() === p.nome_utente?.toLowerCase()).length;
      return `
        <label class="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-burgundy/40 transition-colors">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-800">${p.nome_utente}</span>
            <span class="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">${presTot} pres</span>
          </div>
          <input type="checkbox" name="spareggio-check" data-ruolo="${ruolo}" value="${escapeHtmlAttr(p.nome_utente)}" onchange="aggiornaContatoriSpareggio()" class="w-4 h-4 accent-burgundy rounded">
        </label>
      `;
    }).join('');

    return `
      <div class="space-y-1.5 mb-3">
        <div class="flex justify-between items-center px-1">
          <span class="text-[11px] font-black uppercase tracking-wider text-slate-400">${ruolo}</span>
          <span id="cnt-ruolo-${ruolo}" class="text-[10px] font-bold text-burgundy bg-burgundy/10 px-2 py-0.5 rounded-full">0 scelti</span>
        </div>
        <div class="space-y-1.5">${items}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = ruoliHTML;
  aggiornaContatoriSpareggio();
  modal.classList.remove('hidden');
}

function aggiornaContatoriSpareggio() {
  const ruoli = ['Portiere', 'Difensore', 'Centrocampista', 'Esterno', 'Attaccante'];
  let totaleSelezionati = 0;

  ruoli.forEach(ruolo => {
    const checked = document.querySelectorAll(`input[data-ruolo="${ruolo}"]:checked`).length;
    totaleSelezionati += checked;
    const badge = document.getElementById(`cnt-ruolo-${ruolo}`);
    if (badge) badge.innerText = `${checked} scelti`;
  });

  const txtTotale = document.getElementById('spareggio-totale-scelti');
  const btnConferma = document.getElementById('btn-conferma-spareggio');

  if (txtTotale) txtTotale.innerText = `Selezionati: ${totaleSelezionati} / 12`;

  if (btnConferma) {
    if (totaleSelezionati === 12) {
      btnConferma.disabled = false;
      btnConferma.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
      btnConferma.disabled = true;
      btnConferma.classList.add('opacity-50', 'cursor-not-allowed');
    }
  }
}

async function confermaSpareggioAdmin() {
  if (!datiSpareggioCorrente) return;

  const selezionati = Array.from(document.querySelectorAll('input[name="spareggio-check"]:checked')).map(cb => cb.value);

  if (selezionati.length !== 12) {
    return mostraAlert("Devi selezionare esattamente 12 giocatori per chiudere le convocazioni.");
  }

  // Salva la scelta dell'Admin nel DB
  const { error } = await db
    .from('partite')
    .update({ scelte_admin: selezionati })
    .eq('id', datiSpareggioCorrente.partitaId);

  if (error) return mostraAlert("Errore nel salvataggio: " + error.message);

  // Sposta tutti gli esclusi automaticamente in 'Assente'
  const { data: presentiAttuali } = await db.from('presenze').select('nome_utente').eq('id_partita', datiSpareggioCorrente.partitaId).eq('stato', 'Presente');
  const esclusi = (presentiAttuali || []).filter(p => !selezionati.includes(p.nome_utente));

  for (const escluso of esclusi) {
    await db.from('presenze').update({ stato: 'Assente' }).eq('id_partita', datiSpareggioCorrente.partitaId).eq('nome_utente', escluso.nome_utente);
  }

  document.getElementById('modal-spareggio-admin').classList.add('hidden');
  caricaSondaggi();
}