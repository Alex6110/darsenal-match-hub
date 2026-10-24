// js/modules/giocatori.js

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

// Apre la modale e popola la tabella con le info di tutti i giocatori
async function apriPaginaAdminGiocatori() {
  const modal = document.getElementById('admin-giocatori-modal');
  const tbody = document.getElementById('admin-giocatori-tbody');
  const tabAdminContainer = document.getElementById('container-tab-giocatori-admin');

  if (!modal || !tbody) return;

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

    tbody.innerHTML = giocatori.map(g => {
      const nome = g.nome_completo || g.nome;
      const nomeNorm = nome.toLowerCase().trim();

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
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="p-3 font-bold text-slate-800 capitalize">${nome}</td>
          <td class="p-3 text-center font-bold text-slate-700">${presenzeFormatte}</td>
          <td class="p-3 text-center text-slate-500 font-bold">${esclusioni} / ${assenzeTotali}</td>
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