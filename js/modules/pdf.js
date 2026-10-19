// -------------------------------------------------------------
// GENERAZIONE E GESTIONE DISTINTA DIGITALE "EPIC CUP 2026/27"
// -------------------------------------------------------------

async function generaDistintaPDF(partitaId = null) {
  try {
    let sondaggioAttivo = null;

    if (partitaId) {
      const { data, error } = await db.from('partite').select('*').eq('id', partitaId).single();
      if (!error && data) sondaggioAttivo = data;
    }

    if (!sondaggioAttivo) {
      const dataLimite = new Date();
      dataLimite.setHours(dataLimite.getHours() - 12); 
      const limiteISO = dataLimite.toISOString();

      const { data: sondaggi, error: errSondaggi } = await db
        .from('partite')
        .select('*')
        .gte('data_ora', limiteISO)
        .order('data_ora', { ascending: true })
        .limit(1);

      if (errSondaggi || !sondaggi || sondaggi.length === 0) {
        return mostraAlert("Nessun sondaggio attivo trovato per le partite odierne o future.");
      }
      sondaggioAttivo = sondaggi[0];
    }

    const idSondaggio = sondaggioAttivo.id;
    let nomiGiocatoriConvocati = [];

    // 1. Lettura dei convocati
    if (sondaggioAttivo.scelte_admin && Array.isArray(sondaggioAttivo.scelte_admin) && sondaggioAttivo.scelte_admin.length > 0) {
      nomiGiocatoriConvocati = sondaggioAttivo.scelte_admin;
    } else {
      const { data: presenti, error: errPresenti } = await db
        .from('presenze')
        .select('nome_utente')
        .eq('id_partita', idSondaggio)
        .eq('stato', 'Presente');

      if (!errPresenti && presenti) {
        nomiGiocatoriConvocati = presenti.map(p => p.nome_utente);
      }
    }

    const normalizzaNome = (nome) => nome?.toLowerCase().trim().split(/\s+/).sort().join(' ');
    const nomiConvocatiNorm = nomiGiocatoriConvocati.map(n => normalizzaNome(n));

    // Caricamento rosa completa
    let rosaCompleta = (typeof GIOCATORI_MOCK !== 'undefined' && Array.isArray(GIOCATORI_MOCK)) 
      ? [...GIOCATORI_MOCK] 
      : [];
    rosaCompleta.sort((a, b) => (a.nome_completo || a.nome).localeCompare(b.nome_completo || b.nome));

    // 2. Inserimento Squadre
    let testoCasa = "DARSENAL"; 
    let testoFuoriCasa = (sondaggioAttivo.squadra_avversaria || '').toUpperCase();

    const { data: matchCalendario } = await db
      .from('calendario_torneo')
      .select('*')
      .eq('data_ora', sondaggioAttivo.data_ora)
      .limit(1);

    if (matchCalendario && matchCalendario.length > 0) {
      testoCasa = matchCalendario[0].squadra_casa.toUpperCase();
      testoFuoriCasa = matchCalendario[0].squadra_trasferta.toUpperCase();
    }

    const elCasa = document.getElementById('pdf-casa-name');
    const elFCasa = document.getElementById('pdf-fcasa-name');
    if (elCasa) elCasa.innerText = testoCasa;
    if (elFCasa) elFCasa.innerText = testoFuoriCasa;

    // 3. Inserimento Data e Ora
    if (sondaggioAttivo.data_ora) {
      const d = new Date(sondaggioAttivo.data_ora);
      const gg = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const aa = d.getFullYear();
      const oraStr = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

      const elData = document.getElementById('pdf-data-text');
      const elOra = document.getElementById('pdf-ora-text');
      if (elData) elData.innerText = `${gg} / ${mm} / ${aa}`;
      if (elOra) elOra.innerText = oraStr;
    }

    // 4. Popolamento Tabella con la struttura corretta della distinta
    const tbody = document.getElementById('pdf-table-giocatori-body');
    if (tbody) {
      let rowsHTML = '';
      const totaleRighe = Math.max(20, rosaCompleta.length);

      for (let i = 0; i < totaleRighe; i++) {
        const g = rosaCompleta[i];
        const nomeGiocatore = g ? (g.nome_completo || g.nome) : '';
        const isPresente = g ? nomiConvocatiNorm.includes(normalizzaNome(nomeGiocatore)) : false;

        const numMagliaTxt = (g && isPresente) ? (g.numero_maglia || '') : '';
        const dataTxt = (g && isPresente) ? (g.data_nascita || '') : '';

        rowsHTML += `
          <tr>
            <td class="num text-center">${i + 1}</td>
            <td contenteditable="true" class="text-center">${numMagliaTxt}</td>
            <td contenteditable="true" class="name">${nomeGiocatore}</td>
            <td contenteditable="true" class="text-center">${dataTxt}</td>
            <td contenteditable="true" class="text-center"></td>
            <td contenteditable="true" class="text-center"></td>
          </tr>
        `;
      }
      tbody.innerHTML = rowsHTML;
    }

    apriModalEditorPDF();

  } catch (error) {
    console.error("Errore generazione distinta:", error);
    mostraAlert("Errore durante la creazione della distinta.");
  }
}

function apriModalEditorPDF() {
  const modal = document.getElementById('modal-editor-pdf');
  if (modal) {
    modal.classList.remove('hidden');
    initZoom();
  }
}

function chiudiEditorPDF() {
  const modal = document.getElementById('modal-editor-pdf');
  if (modal) modal.classList.add('hidden');
}

function stampaESalvaPDF() {
  window.print();
}

function svuotaCampiDistinta() {
  location.reload();
}

// -------------------------------------------------------------
// GESTIONE ZOOM E CONTROLLO
// -------------------------------------------------------------
let currentZoomScale = 1.0;


function cambiaZoom(delta) {
  currentZoomScale = Math.round((currentZoomScale + delta) * 100) / 100;
  if (currentZoomScale < 0.35) currentZoomScale = 0.35;
  if (currentZoomScale > 2.5) currentZoomScale = 2.5;
  applicaZoom();
}

const A4_PX = 210 * 96 / 25.4; // ≈ 794px

function initZoom() {
  const wrap = document.querySelector('.a4-page-wrapper');
  const disponibile = (wrap ? wrap.clientWidth : window.innerWidth) - 32;
  currentZoomScale = Math.min(1, Math.round((disponibile / A4_PX) * 100) / 100);
  applicaZoom();
}

function applicaZoom() {
  const paper = document.getElementById('distinta-paper');
  const label = document.getElementById('zoom-level-label');
  if (paper) paper.style.zoom = currentZoomScale;
  if (label) label.innerText = `${Math.round(currentZoomScale * 100)}%`;
}



