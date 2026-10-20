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
          <tr${(g && !isPresente) ? ' class="assente"' : ''}>
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
    azzeraPDFPronto();
    const paper = document.getElementById('distinta-paper');
    if (paper && !paper.dataset.inputBound) {
      paper.addEventListener('input', azzeraPDFPronto);
      paper.dataset.inputBound = '1';
    }
  }
}

function chiudiEditorPDF() {
  const modal = document.getElementById('modal-editor-pdf');
  if (modal) modal.classList.add('hidden');
}

let pdfPronto = null;     // { blob, nomeFile }
let pdfInCorso = false;

function isTouchDevice() { return window.matchMedia('(pointer: coarse)').matches; }

function setEtichettaBtnPDF(testo) {
  const el = document.getElementById('btn-pdf-label');
  if (el) el.textContent = testo;
}

function azzeraPDFPronto() {
  pdfPronto = null;
  setEtichettaBtnPDF('Stampa / PDF');
}

async function stampaESalvaPDF() {
  if (!isTouchDevice()) { window.print(); return; }   // Mac / PC
  if (pdfInCorso) return;
  if (pdfPronto) { await condividiPDF(); return; }    // 2° tocco

  pdfInCorso = true;                                  // 1° tocco
  setEtichettaBtnPDF('Preparo il PDF…');
  try {
    pdfPronto = await creaPDFDistinta();
    setEtichettaBtnPDF('Salva / Condividi PDF');
  } catch (err) {
    console.error('Errore creazione PDF:', err);
    azzeraPDFPronto();
    mostraAlert('Non sono riuscito a creare il PDF. Riprova.');
  } finally {
    pdfInCorso = false;
  }
}

async function creaPDFDistinta() {
  const paper = document.getElementById('distinta-paper');
  if (!paper || typeof html2canvas === 'undefined' || typeof PDFLib === 'undefined') {
    throw new Error('Librerie PDF non caricate');
  }
  const testo = id => (document.getElementById(id)?.innerText || '').trim();
  const nomeFile = ('Distinta ' + testo('pdf-casa-name') + ' - ' + testo('pdf-fcasa-name'))
    .replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_') + '.pdf';

  // copia a grandezza reale (210mm), senza zoom e fuori dallo scroll dell'editor
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:0;top:0;z-index:-1;width:210mm;background:#fff;';
  const clone = paper.cloneNode(true);
  clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  clone.removeAttribute('id');
  clone.classList.add('pdf-capture');
  clone.style.transform = 'none';
  clone.style.zoom = '1';
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  holder.appendChild(clone);
  document.body.appendChild(holder);

  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const canvas = await html2canvas(clone, { scale: 3, backgroundColor: '#fff', useCORS: true, logging: false, windowWidth: 794 });
    const jpg = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.95));
    const bytes = new Uint8Array(await jpg.arrayBuffer());

    const W = 595.28, H = 841.89;                     // A4 in punti
    const pdfDoc = await PDFLib.PDFDocument.create();
    const page = pdfDoc.addPage([W, H]);
    const img = await pdfDoc.embedJpg(bytes);
    let w = W, h = W * canvas.height / canvas.width;
    if (h > H) { w = W * H / h; h = H; }              // se il foglio fosse più alto di un A4
    page.drawImage(img, { x: (W - w) / 2, y: H - h, width: w, height: h });

    const pdfBytes = await pdfDoc.save();
    return { blob: new Blob([pdfBytes], { type: 'application/pdf' }), nomeFile };
  } finally {
    holder.remove();
  }
}

async function condividiPDF() {
  const { blob, nomeFile } = pdfPronto;
  const file = new File([blob], nomeFile, { type: 'application/pdf' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Distinta EPIC CUP' });
    } else {
      scaricaBlob(blob, nomeFile);
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return;     // hai chiuso il foglio di condivisione
    scaricaBlob(blob, nomeFile);
  }
}

function scaricaBlob(blob, nomeFile) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeFile;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
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
  const scaler = document.getElementById('distinta-scaler');
  const label = document.getElementById('zoom-level-label');
  if (paper && scaler) {
    paper.style.zoom = '';
    paper.style.transform = `scale(${currentZoomScale})`;
    scaler.style.width  = (paper.offsetWidth  * currentZoomScale) + 'px';
    scaler.style.height = (paper.offsetHeight * currentZoomScale) + 'px';
  }
  if (label) label.innerText = `${Math.round(currentZoomScale * 100)}%`;
}



