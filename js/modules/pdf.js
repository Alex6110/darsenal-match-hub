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

    // Priorità ai 12 convocati confermati dall'admin
    if (sondaggioAttivo.scelte_admin && Array.isArray(sondaggioAttivo.scelte_admin) && sondaggioAttivo.scelte_admin.length === 12) {
      nomiGiocatoriConvocati = sondaggioAttivo.scelte_admin;
    } else {
      // Preleva tutti i presenti del sondaggio
      const { data: presenti, error: errPresenti } = await db
        .from('presenze')
        .select('nome_utente')
        .eq('id_partita', idSondaggio)
        .eq('stato', 'Presente');

      if (errPresenti || !presenti || presenti.length === 0) {
        return mostraAlert("Nessun giocatore ha votato 'Ci sono' a questo sondaggio.");
      }
      nomiGiocatoriConvocati = presenti.map(p => p.nome_utente);
    }

    const normalizzaNome = (nome) => nome?.toLowerCase().trim().split(/\s+/).sort().join(' ');

    // Mappatura con dati anagrafici (GIOCATORI_MOCK / DB)
    let giocatoriLista = nomiGiocatoriConvocati.map(nomeUtente => {
      const nomeDB = normalizzaNome(nomeUtente);
      const mockData = (typeof GIOCATORI_MOCK !== 'undefined') 
        ? GIOCATORI_MOCK.find(g => normalizzaNome(g.nome_completo) === nomeDB || normalizzaNome(g.nome) === nomeDB) 
        : null;
      
      return {
        nome_da_stampare: mockData ? (mockData.nome_completo || mockData.nome) : nomeUtente,
        data_nascita: mockData ? mockData.data_nascita : '',
        numero_maglia: mockData && mockData.numero_maglia ? parseInt(mockData.numero_maglia) : ''
      };
    });

    // ORDINAMENTO ALFABETICO O PER MAGLIA
    giocatoriLista.sort((a, b) => a.nome_da_stampare.localeCompare(b.nome_da_stampare));

    // Gestione Squadre e Date
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

    // Compilazione Intestazione (CASA, F.CASA, DATA, ORA)
    const inputCasa = document.getElementById('pdf-input-casa');
    const inputFCasa = document.getElementById('pdf-input-fcasa');
    if (inputCasa) inputCasa.value = testoCasa;
    if (inputFCasa) inputFCasa.value = testoFuoriCasa;

    if (sondaggioAttivo.data_ora) {
      const d = new Date(sondaggioAttivo.data_ora);
      const gg = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const aa = d.getFullYear();
      const oraStr = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

      const inputDataGg = document.getElementById('pdf-input-data-gg');
      const inputDataMm = document.getElementById('pdf-input-data-mm');
      const inputDataAa = document.getElementById('pdf-input-data-aa');
      const inputOra = document.getElementById('pdf-input-ora');

      if (inputDataGg) inputDataGg.value = gg;
      if (inputDataMm) inputDataMm.value = mm;
      if (inputDataAa) inputDataAa.value = aa;
      if (inputOra) inputOra.value = oraStr;
    }

    // GENERAZIONE RIGHE TABELLA (Esattamente 20 righe numerate come nel PDF)
    const tbody = document.getElementById('pdf-table-giocatori-body');
    if (tbody) {
      let rowsHTML = '';
      const totaleRighe = 20;

      for (let i = 0; i < totaleRighe; i++) {
        const g = giocatoriLista[i];

        const numMagliaTxt = g ? g.numero_maglia : '';
        const nomeTxt = g ? g.nome_da_stampare.toUpperCase() : '';
        const dataTxt = g ? (g.data_nascita || '') : '';

        // Struttura a 6 colonne esatte: N°, MAGLIA, COGNOME E NOME, DATA NASCITA, GOL, ASSIST
        rowsHTML += `
          <tr>
            <td class="col-n-prog text-center font-bold">${i + 1}</td>
            <td class="col-maglia text-center">
              <input type="text" class="pdf-input text-center font-bold" value="${numMagliaTxt}">
            </td>
            <td class="col-nome">
              <input type="text" class="pdf-input font-bold uppercase" value="${nomeTxt}">
            </td>
            <td class="col-nascita text-center">
              <input type="text" class="pdf-input text-center" value="${dataTxt}">
            </td>
            <td class="col-gol text-center">
              <input type="text" class="pdf-input text-center">
            </td>
            <td class="col-assist text-center">
              <input type="text" class="pdf-input text-center">
            </td>
          </tr>
        `;
      }

      tbody.innerHTML = rowsHTML;
    }

    apriModalEditorPDF();

  } catch (error) {
    console.error("Errore inizializzazione distinta PDF:", error);
    mostraAlert("Si è verificato un errore durante la creazione della distinta PDF.");
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

// STAMPA / SALVATAGGIO IN PDF CON SINCRONIZZAZIONE E PROPORZIONI PERFETTE
function stampaESalvaPDF() {
  const elementoDaStampare = document.getElementById('distinta-paper');
  if (!elementoDaStampare) return;

  // Sincronizza i valori degli input nel DOM prima della stampa
  elementoDaStampare.querySelectorAll('input').forEach(input => {
    input.setAttribute('value', input.value);
  });

  const styles = Array.from(document.querySelectorAll('style')).map(s => s.innerHTML).join('\n');

  const finestraStampa = window.open('', '', 'height=900,width=800');
  finestraStampa.document.write('<!DOCTYPE html><html><head><title>Distinta Ufficiale EPIC CUP</title>');
  
  finestraStampa.document.write(`
    <style>
      ${styles}

      @page {
        size: A4 portrait;
        margin: 0;
      }

      html, body {
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        overflow: hidden !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      .a4-page {
        width: 595px !important;
        padding: 30px 40px !important;
        box-shadow: none !important;
        margin: 0 auto !important;
        zoom: 1.15 !important;
        transform: none !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      input {
        border: none !important;
        outline: none !important;
        background: transparent;
        box-shadow: none !important;
      }
    </style>
  `);
  
  finestraStampa.document.write('</head><body>');
  finestraStampa.document.write(elementoDaStampare.outerHTML);
  finestraStampa.document.write('</body></html>');
  finestraStampa.document.close();

  setTimeout(() => {
    finestraStampa.focus();
    finestraStampa.print();
    finestraStampa.close();
  }, 300);
}

function svuotaCampiDistinta() {
  const paper = document.getElementById('distinta-paper');
  if (!paper) return;
  paper.querySelectorAll('input').forEach(input => input.value = '');
}

// -------------------------------------------------------------
// GESTIONE ZOOM E SPOSTAMENTO (PAN & PINCH-TO-ZOOM)
// -------------------------------------------------------------

let currentZoomScale = 1.0;
let panX = 0;
let panY = 0;

let isDragging = false;
let startX = 0, startY = 0;
let initialDistance = null;
let initialZoom = 1.0;

function initZoom() {
  if (window.innerWidth <= 600) {
    currentZoomScale = 0.55;
  } else if (window.innerWidth <= 840) {
    currentZoomScale = 0.75;
  } else {
    currentZoomScale = 1.0;
  }
  panX = 0;
  panY = 0;
  applicaZoom();
  setupTouchAndMouseGestures();
}

function cambiaZoom(delta) {
  currentZoomScale = Math.round((currentZoomScale + delta) * 100) / 100;
  if (currentZoomScale < 0.35) currentZoomScale = 0.35;
  if (currentZoomScale > 2.5) currentZoomScale = 2.5;
  applicaZoom();
}

function applicaZoom() {
  const paper = document.getElementById('distinta-paper');
  const label = document.getElementById('zoom-level-label');
  if (paper) {
    paper.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoomScale})`;
    paper.style.transformOrigin = 'top center';
  }
  if (label) {
    label.innerText = `${Math.round(currentZoomScale * 100)}%`;
  }
}

function setupTouchAndMouseGestures() {
  const wrapper = document.querySelector('.a4-page-wrapper');
  if (!wrapper || wrapper.dataset.gestureInitialized) return;
  wrapper.dataset.gestureInitialized = "true";

  wrapper.addEventListener('touchstart', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.closest('button')) return;
    
    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX - panX;
      startY = e.touches[0].clientY - panY;
    } else if (e.touches.length === 2) {
      isDragging = false;
      initialDistance = getTouchDistance(e.touches);
      initialZoom = currentZoomScale;
    }
  }, { passive: true });

  wrapper.addEventListener('touchmove', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.closest('button')) return;

    if (e.touches.length === 1 && isDragging) {
      panX = e.touches[0].clientX - startX;
      panY = e.touches[0].clientY - startY;
      applicaZoom();
    } else if (e.touches.length === 2 && initialDistance) {
      const currentDist = getTouchDistance(e.touches);
      const factor = currentDist / initialDistance;
      currentZoomScale = Math.max(0.35, Math.min(2.5, initialZoom * factor));
      applicaZoom();
    }
  }, { passive: true });

  wrapper.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) initialDistance = null;
    if (e.touches.length === 0) isDragging = false;
  });

  wrapper.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.closest('button')) return;
    isDragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    wrapper.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    applicaZoom();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    if (wrapper) wrapper.style.cursor = 'default';
  });

  wrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    cambiaZoom(delta);
  }, { passive: false });
}

function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}