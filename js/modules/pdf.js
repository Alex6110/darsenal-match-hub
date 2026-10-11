// -------------------------------------------------------------
// GENERAZIONE E GESTIONE DISTINTA DIGITALE "EPIC CUP"
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
        ruolo: mockData ? mockData.ruolo : '',
        numero_maglia: mockData && mockData.numero_maglia ? parseInt(mockData.numero_maglia) : 99 
      };
    });

    // ORDINAMENTO CRESCENTE PER NUMERO DI MAGLIA
    giocatoriLista.sort((a, b) => a.numero_maglia - b.numero_maglia);

    // Gestione Nomi Squadre
    let testoCasa = "DARSENAL"; 
    let testoTrasferta = (sondaggioAttivo.squadra_avversaria || '').toUpperCase();

    const { data: matchCalendario } = await db
      .from('calendario_torneo')
      .select('*')
      .eq('data_ora', sondaggioAttivo.data_ora)
      .limit(1);

    if (matchCalendario && matchCalendario.length > 0) {
      testoCasa = matchCalendario[0].squadra_casa.toUpperCase();
      testoTrasferta = matchCalendario[0].squadra_trasferta.toUpperCase();
    }

    const inputCasa = document.getElementById('pdf-input-casa');
    const inputTrasferta = document.getElementById('pdf-input-trasferta');
    if (inputCasa) inputCasa.value = testoCasa;
    if (inputTrasferta) inputTrasferta.value = testoTrasferta;

    const capitanoPresente = giocatoriLista.some(g => g.ruolo && g.ruolo.toLowerCase() === 'capitano');

    // GENERAZIONE RIGHE TABELLA (21 righe per rispettare il box)
    const tbody = document.getElementById('pdf-table-giocatori-body');
    if (tbody) {
      let rowsHTML = '';
      const totaleRighe = 21;

      for (let i = 0; i < totaleRighe; i++) {
        const g = giocatoriLista[i];

        const numTxt = g ? (g.numero_maglia !== 99 ? g.numero_maglia : '') : '';
        const nomeTxt = g ? g.nome_da_stampare.toUpperCase() : '';
        const dataTxt = g ? (g.data_nascita || '') : '';

        let selectedCapValue = '';
        if (g) {
          const ruolo = g.ruolo ? g.ruolo.toLowerCase() : '';
          if (ruolo === 'capitano') selectedCapValue = 'CAP.';
          else if (ruolo === 'vice capitano' || ruolo === 'vice') selectedCapValue = capitanoPresente ? 'V.CAP.' : 'CAP.';
        }

        // La 10a riga (indice 9) ha il divisore nero spesso (5px)
        const isThick = (i === 9) ? 'class="thick-row"' : '';

        // Generazione esatta delle 6 colonne con menu custom CAP/V.CAP in stile sito
        rowsHTML += `
          <tr ${isThick}>
            <td class="col-ris">
              <input type="text" class="pdf-input text-center">
            </td>
            <td class="col-num text-center">
              <input type="text" class="pdf-input text-center font-bold" value="${numTxt}">
            </td>
            <td class="col-nome">
              <input type="text" class="pdf-input font-bold uppercase" value="${nomeTxt}">
            </td>
            <td class="col-nascita text-center">
              <input type="text" class="pdf-input text-center" value="${dataTxt}">
            </td>
            <td class="col-cap text-center font-bold relative">
              <div class="relative custom-select-wrapper w-full h-full flex items-center justify-center">
                <input type="hidden" class="cap-hidden-input" value="${selectedCapValue}">
                <button type="button" onclick="toggleRowSelect(this, event)" class="w-full h-full flex items-center justify-center text-center font-bold uppercase text-[9.5px] bg-transparent focus:outline-none cursor-pointer">
                  <span class="cap-display-text">${selectedCapValue}</span>
                </button>
                <div class="hidden custom-select-options absolute z-50 w-24 left-1/2 -translate-x-1/2 mt-1 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-50 text-left">
                  <div onclick="selezionaValoreRow(this, '', '')" class="p-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer text-center">- Vuoto -</div>
                  <div onclick="selezionaValoreRow(this, 'CAP.', 'CAP.')" class="p-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer text-center">CAP.</div>
                  <div onclick="selezionaValoreRow(this, 'V.CAP.', 'V.CAP.')" class="p-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer text-center">V.CAP.</div>
                </div>
              </div>
            </td>
            <td class="col-doc">
              <input type="text" class="pdf-input">
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
    initZoom(); // Inposta lo zoom calibrato in base allo schermo
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

  // 1. Sincronizza i valori degli input nel DOM prima della stampa
  elementoDaStampare.querySelectorAll('input').forEach(input => {
    input.setAttribute('value', input.value);
  });
  elementoDaStampare.querySelectorAll('.cap-hidden-input').forEach(input => {
    input.setAttribute('value', input.value);
  });

  // Preleva tutti i tag <style> presenti nella pagina principale
  const styles = Array.from(document.querySelectorAll('style')).map(s => s.innerHTML).join('\n');

  const finestraStampa = window.open('', '', 'height=900,width=800');
  finestraStampa.document.write('<!DOCTYPE html><html><head><title>Distinta Gara EPIC CUP</title>');
  
  finestraStampa.document.write(`
    <style>
      ${styles}

      /* Regole di stampa per una pagina perfetta */
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
        width: 560px !important;
        padding: 38px 35px 15px 35px !important;
        box-shadow: none !important;
        margin: 0 auto !important;
        zoom: 1.20 !important;
        transform: none !important;
        transform-origin: top center;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .box-main { margin-bottom: 12px !important; }
      .box-notes { margin-bottom: 12px !important; }
      table.staff-table { margin-bottom: 15px !important; }

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

// -------------------------------------------------------------
// GESTIONE MENU CUSTOM PER LE RIGHE CAP / V.CAP
// -------------------------------------------------------------

function toggleRowSelect(buttonEl, event) {
  if (event) event.stopPropagation();
  const wrapper = buttonEl.closest('.custom-select-wrapper');
  const options = wrapper.querySelector('.custom-select-options');
  
  // Chiude tutte le altre tendine aperte nella pagina
  document.querySelectorAll('.custom-select-options').forEach(el => {
    if (el !== options) el.classList.add('hidden');
  });
  
  options.classList.toggle('hidden');
}

function selezionaValoreRow(optionEl, valore, testo) {
  const wrapper = optionEl.closest('.custom-select-wrapper');
  const hiddenInput = wrapper.querySelector('.cap-hidden-input');
  const displayText = wrapper.querySelector('.cap-display-text');
  const options = wrapper.querySelector('.custom-select-options');

  hiddenInput.value = valore;
  displayText.innerText = testo;
  options.classList.add('hidden');
}

// -------------------------------------------------------------
// FUNZIONI PER GESTIONE DINAMICA RIGHE E TESTO NELL'EDITOR
// -------------------------------------------------------------

// Aggiunge una riga vuota in fondo alla tabella dei giocatori con il menu custom CAP
function aggiungiRigaGiocatore() {
  const tbody = document.getElementById('pdf-table-giocatori-body');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="col-ris"><input type="text" class="pdf-input text-center"></td>
    <td class="col-num text-center"><input type="text" class="pdf-input text-center font-bold"></td>
    <td class="col-nome"><input type="text" class="pdf-input font-bold uppercase"></td>
    <td class="col-nascita text-center"><input type="text" class="pdf-input text-center"></td>
    <td class="col-cap text-center font-bold relative">
      <div class="relative custom-select-wrapper w-full h-full flex items-center justify-center">
        <input type="hidden" class="cap-hidden-input" value="">
        <button type="button" onclick="toggleRowSelect(this, event)" class="w-full h-full flex items-center justify-center text-center font-bold uppercase text-[9.5px] bg-transparent focus:outline-none cursor-pointer">
          <span class="cap-display-text"></span>
        </button>
        <div class="hidden custom-select-options absolute z-50 w-24 left-1/2 -translate-x-1/2 mt-1 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-50 text-left">
          <div onclick="selezionaValoreRow(this, '', '')" class="p-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer text-center">- Vuoto -</div>
          <div onclick="selezionaValoreRow(this, 'CAP.', 'CAP.')" class="p-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer text-center">CAP.</div>
          <div onclick="selezionaValoreRow(this, 'V.CAP.', 'V.CAP.')" class="p-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer text-center">V.CAP.</div>
        </div>
      </div>
    </td>
    <td class="col-doc"><input type="text" class="pdf-input"></td>
  `;
  tbody.appendChild(tr);
}

// Rimuove l'ultima riga dalla tabella dei giocatori
function rimuoviUltimaRigaGiocatore() {
  const tbody = document.getElementById('pdf-table-giocatori-body');
  if (!tbody || tbody.children.length === 0) return;
  tbody.removeChild(tbody.lastElementChild);
}

// Svuota tutti i campi di testo compilati nella distinta
function svuotaCampiDistinta() {
  const paper = document.getElementById('distinta-paper');
  if (!paper) return;
  paper.querySelectorAll('input').forEach(input => input.value = '');
  paper.querySelectorAll('.cap-hidden-input').forEach(input => input.value = '');
  paper.querySelectorAll('.cap-display-text').forEach(span => span.innerText = '');
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
    currentZoomScale = 0.55; // Zoom predefinito per mobile piccolo
  } else if (window.innerWidth <= 840) {
    currentZoomScale = 0.75; // Zoom predefinito per tablet/schermi medi
  } else {
    currentZoomScale = 1.0;  // Zoom predefinito per desktop
  }
  panX = 0;
  panY = 0;
  applicaZoom();
  setupTouchAndMouseGestures();
}

function cambiaZoom(delta) {
  currentZoomScale = Math.round((currentZoomScale + delta) * 100) / 100;
  // Limiti di zoom (da 35% a 250%)
  if (currentZoomScale < 0.35) currentZoomScale = 0.35;
  if (currentZoomScale > 2.5) currentZoomScale = 2.5;
  applicaZoom();
}

function applicaZoom() {
  const paper = document.getElementById('distinta-paper');
  const label = document.getElementById('zoom-level-label');
  if (paper) {
    // Applica sia lo spostamento (pan) che lo zoom (scale)
    paper.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoomScale})`;
    paper.style.transformOrigin = 'top center';
  }
  if (label) {
    label.innerText = `${Math.round(currentZoomScale * 100)}%`;
  }
}

// Gestione eventi tattili (touch) e mouse per pan e pinch-to-zoom
function setupTouchAndMouseGestures() {
  const wrapper = document.querySelector('.a4-page-wrapper');
  if (!wrapper || wrapper.dataset.gestureInitialized) return;
  wrapper.dataset.gestureInitialized = "true";

  // --- EVENTI TOUCH (MOBILE / TABLET) ---
  wrapper.addEventListener('touchstart', (e) => {
    // Non bloccare se si sta interagendo con input, select o pulsanti
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
      // Spostamento (Pan) con un dito
      panX = e.touches[0].clientX - startX;
      panY = e.touches[0].clientY - startY;
      applicaZoom();
    } else if (e.touches.length === 2 && initialDistance) {
      // Zoom con due dita (Pinch-to-zoom)
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

  // --- EVENTI MOUSE (DESKTOP) ---
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

  // Zoom con la rotellina del mouse
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