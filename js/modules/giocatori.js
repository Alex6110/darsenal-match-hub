// js/modules/giocatori.js

// Carica e calcola le statistiche personali per il menu laterale dell'utente
async function caricaStatisticheUtente(nomeUtente) {
  if (!nomeUtente) return;

  const nomeNorm = nomeUtente.toLowerCase().trim();

  try {
    // 1. Carica presenze, eventi (gol, cartellini) e partite
    const [{ data: presenze }, { data: eventi }, { data: calendario }, { data: partite }] = await Promise.all([
      db.from('presenze').select('*'),
      db.from('eventi_partita').select('*'),
      db.from('calendario_torneo').select('id, data_ora'),
      db.from('partite').select('id, data_ora')
    ]);

    const tuttePartite = [...(calendario || []), ...(partite || [])];

    // Filtra presenze del giocatore
    const presenzeGiocatore = (presenze || []).filter(p => 
      (p.nome_utente || '').toLowerCase().trim() === nomeNorm
    );

    const presenzeTotali = presenzeGiocatore.filter(p => p.stato === 'Presente').length;
    const assenzeTotali = presenzeGiocatore.filter(p => p.stato === 'Assente').length;
    const esclusioniTotali = presenzeGiocatore.filter(p => p.stato === 'Escluso').length;

    // Ultima giocata
    const presenzeEffettive = presenzeGiocatore.filter(p => p.stato === 'Presente');
    let ultimaGiocataStr = '-';
    if (presenzeEffettive.length > 0) {
      // Trova la data più recente tra le partite in cui era presente
      const datePresente = presenzeEffettive.map(pr => {
        const matchId = pr.id_partita || pr.id_sondaggio || pr.partita_id;
        const m = tuttePartite.find(tp => String(tp.id) === String(matchId));
        return m ? new Date(m.data_ora) : null;
      }).filter(d => d && !isNaN(d));

      if (datePresente.length > 0) {
        const piuRecente = new Date(Math.max(...datePresente));
        ultimaGiocataStr = piuRecente.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      }
    }

    // Eventi (Gol, Gialli, Rossi)
    const eventiGiocatore = (eventi || []).filter(e => 
      (e.nome_utente || '').toLowerCase().trim() === nomeNorm
    );

    const gol = eventiGiocatore.filter(e => e.tipo === 'gol').length;
    const gialli = eventiGiocatore.filter(e => e.tipo === 'giallo').length;
    const rossi = eventiGiocatore.filter(e => e.tipo === 'rosso').length;

    // Aggiorna UI del menu laterale
    document.getElementById('stat-presenze').innerText = presenzeTotali;
    document.getElementById('stat-ultima').innerText = ultimaGiocataStr;
    document.getElementById('stat-assenze').innerText = assenzeTotali;
    document.getElementById('stat-esclusioni').innerText = esclusioniTotali;
    document.getElementById('stat-gol').innerText = gol;
    document.getElementById('stat-gialli').innerText = gialli;
    document.getElementById('stat-rossi').innerText = rossi;

  } catch (err) {
    console.error("Errore caricamento statistiche utente:", err);
  }
}

// Apre la pagina/modale con le info di tutti i giocatori (per tutti gli utenti / admin)
async function apriPaginaAdminGiocatori() {
  const modal = document.getElementById('admin-giocatori-modal');
  const tbody = document.getElementById('admin-giocatori-tbody');
  const tabAdminContainer = document.getElementById('container-tab-giocatori-admin');

  if (!modal || !tbody) return;

  // Mostra o nasconde i tab di gestione assenze a seconda dei permessi admin
  if (tabAdminContainer) {
    if (typeof isAdmin !== 'undefined' && isAdmin) {
      tabAdminContainer.classList.remove('hidden');
    } else {
      tabAdminContainer.classList.add('hidden');
    }
  }

  tbody.innerHTML = `<tr><td colspan="7" class="text-center text-xs text-slate-400 py-6">Caricamento statistiche...</td></tr>`;
  modal.classList.remove('hidden');

  try {
    // Carica anagrafica giocatori
    let giocatori = typeof GIOCATORI_MOCK !== 'undefined' ? GIOCATORI_MOCK : [];
    const { data: dbG } = await db.from('giocatori').select('*');
    if (dbG && dbG.length > 0) giocatori = dbG;

    const [{ data: presenze }, { data: eventi }, { data: calendario }, { data: partite }] = await Promise.all([
      db.from('presenze').select('*'),
      db.from('eventi_partita').select('*'),
      db.from('calendario_torneo').select('id, data_ora'),
      db.from('partite').select('id, data_ora')
    ]);

    const tuttePartite = [...(calendario || []), ...(partite || [])];

    tbody.innerHTML = giocatori.map(g => {
      const nome = g.nome_completo || g.nome;
      const nomeNorm = nome.toLowerCase().trim();

      const pList = (presenze || []).filter(p => (p.nome_utente || '').toLowerCase().trim() === nomeNorm);
      const pres = pList.filter(p => p.stato === 'Presente').length;
      const ass = pList.filter(p => p.stato === 'Assente' || p.stato === 'Escluso').length;

      // Ultima giocata
      const presEffettive = pList.filter(p => p.stato === 'Presente');
      let ultima = '-';
      if (presEffettive.length > 0) {
        const dateP = presEffettive.map(pr => {
          const matchId = pr.id_partita || pr.id_sondaggio || pr.partita_id;
          const m = tuttePartite.find(tp => String(tp.id) === String(matchId));
          return m ? new Date(m.data_ora) : null;
        }).filter(d => d && !isNaN(d));

        if (dateP.length > 0) {
          ultima = new Date(Math.max(...dateP)).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
        }
      }

      const eList = (eventi || []).filter(e => (e.nome_utente || '').toLowerCase().trim() === nomeNorm);
      const gol = eList.filter(e => e.tipo === 'gol').length;
      const gialli = eList.filter(e => e.tipo === 'giallo').length;
      const rossi = eList.filter(e => e.tipo === 'rosso').length;

      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="p-3 font-bold text-slate-800 capitalize">${nome}</td>
          <td class="p-3 text-center font-bold text-slate-700">${pres}</td>
          <td class="p-3 text-center text-slate-500">${ass}</td>
          <td class="p-3 text-center text-slate-500">${ultima}</td>
          <td class="p-3 text-center font-black text-burgundy">${gol}</td>
          <td class="p-3 text-center font-bold text-amber-500">${gialli}</td>
          <td class="p-3 text-center font-bold text-rose-600">${rossi}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error("Errore caricamento tabella giocatori:", err);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-xs text-rose-500 py-4">Errore caricamento dati.</td></tr>`;
  }
}

// Gestione tab all'interno del modale admin (Info / Assenze)
function switchTabGiocatoriAdmin(tab) {
  const btnInfo = document.getElementById('btn-tab-giocatori-info');
  const btnAssenze = document.getElementById('btn-tab-giocatori-assenze');
  const viewInfo = document.getElementById('tab-giocatori-info-view');
  const viewAssenze = document.getElementById('tab-giocatori-assenze-view');

  if (tab === 'info') {
    btnInfo?.classList.add('bg-white', 'text-burgundy', 'shadow-sm');
    btnInfo?.classList.remove('text-slate-500');
    btnAssenze?.classList.remove('bg-white', 'text-burgundy', 'shadow-sm');
    btnAssenze?.classList.add('text-slate-500');
    viewInfo?.classList.remove('hidden');
    viewAssenze?.classList.add('hidden');
  } else {
    btnAssenze?.classList.add('bg-white', 'text-burgundy', 'shadow-sm');
    btnAssenze?.classList.remove('text-slate-500');
    btnInfo?.classList.remove('bg-white', 'text-burgundy', 'shadow-sm');
    btnInfo?.classList.add('text-slate-500');
    viewAssenze?.classList.remove('hidden');
    viewInfo?.classList.add('hidden');
  }
}