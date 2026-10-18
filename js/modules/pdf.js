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

    // 1. Lettura dei nomi dal sondaggio / convocazioni admin
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

    // 2. Inserimento Squadra di Casa e Fuori Casa
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

    const inputCasa = document.getElementById('pdf-input-casa');
    const inputFCasa = document.getElementById('pdf-input-fcasa');
    if (inputCasa) inputCasa.value = testoCasa;
    if (inputFCasa) inputFCasa.value = testoFuoriCasa;

    // 3. Inserimento Data in formato europeo (GG / MM / AAAA) e Ora
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

    // 4. Compilazione righe: confronto presenza, inserimento dati o sbarramento riga
    const tbody = document.getElementById('pdf-table-giocatori-body');
    if (tbody) {
      let rowsHTML = '';
      const totaleRighe = Math.max(20, rosaCompleta.length);

      for (let i = 0; i < totaleRighe; i++) {
        const g = rosaCompleta[i];
        const nomeGiocatore = g ? (g.nome_completo || g.nome) : '';
        const isPresente = g ? nomiConvocatiNorm.includes(normalizzaNome(nomeGiocatore)) : false;

        // Se presente inserisce numero maglia e data nascita, altrimenti celle vuote
        const numMagliaTxt = (g && isPresente) ? (g.numero_maglia || '') : '';
        const dataTxt = (g && isPresente) ? (g.data_nascita || '') : '';
        
        // Se non presente, applica la classe per tirare una linea su tutta la riga
        const lineThroughClass = (g && !isPresente) ? 'row-sbarrata' : '';

        rowsHTML += `
          <tr class="relative ${lineThroughClass}">
            <td class="col-n-prog text-center font-bold">${i + 1}</td>
            <td class="col-maglia text-center">
              <input type="text" class="pdf-input text-center font-bold" value="${numMagliaTxt}">
            </td>
            <td class="col-nome relative">
              <input type="text" class="pdf-input font-bold uppercase" value="${nomeGiocatore.toUpperCase()}">
              ${(g && !isPresente) ? '<div class="strikethrough-line"></div>' : ''}
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

// STAMPA / SALVATAGGIO IN PDF CON SINCRONIZZAZIONE E PROPORZIONI PERFETTE
function stampaESalvaPDF() {
  const elementoDaStampare = document.getElementById('distinta-paper');
  if (!elementoDaStampare) return;

  // Sincronizza lo stato degli input nel DOM
  elementoDaStampare.querySelectorAll('input').forEach(input => {
    input.setAttribute('value', input.value);
  });

  // Rilevamento ambiente PWA o Mobile
  const isStandalonePWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  if (isStandalonePWA || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    // Sulla PWA mobile apre direttamente il modulo di stampa/salvataggio PDF nativo del dispositivo
    window.print();
    return;
  }

  // Fallback per Desktop
  window.print();
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