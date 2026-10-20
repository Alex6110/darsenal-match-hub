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

// -------------------------------------------------------------
// PDF VETTORIALE (iPhone / iPad)
// Disegna la distinta leggendo dal foglio dell'editor posizioni, linee e testi:
// quello che vedi nell'editor è quello che finisce nel PDF.
// -------------------------------------------------------------
const PDF_A4_W = 595.28, PDF_A4_H = 841.89;     // A4 in punti
const PDF_PX = 0.75;                            // 1px CSS = 0.75pt
const PDF_MM_PX = 96 / 25.4;                    // 1mm in px CSS
const PDF_STRIKE_INSET_MM = 1.5;                // = inset della riga rossa nel CSS (.assente)
const PDF_STRIKE_RGB = [220, 38, 38];           // = #dc2626
const PDF_UNDERLINE_BOTTOM_MM = 0.4;            // = distanza linea campi dal fondo nel CSS (.f / .uline)

let _fontCaladeaCache = null;

async function caricaFontPDF(pdfDoc) {
  const SF = PDFLib.StandardFonts;
  const f = {
    sans:   await pdfDoc.embedFont(SF.Helvetica),
    sansB:  await pdfDoc.embedFont(SF.HelveticaBold),
    serif:  await pdfDoc.embedFont(SF.TimesRoman),
    serifB: await pdfDoc.embedFont(SF.TimesRomanBold)
  };
  // Caladea = lo stesso carattere dell'editor. Serve fontkit + i 2 file in /fonts.
  // Se mancano, si usa Times e il PDF funziona comunque.
  try {
    if (window.fontkit) {
      if (!_fontCaladeaCache) {
        const get = async (url) => {
          const r = await fetch(url);
          if (!r.ok) throw new Error('font non trovato: ' + url);
          return r.arrayBuffer();
        };
        _fontCaladeaCache = {
          reg:  await get('fonts/Caladea-Regular.ttf'),
          bold: await get('fonts/Caladea-Bold.ttf')
        };
      }
      pdfDoc.registerFontkit(window.fontkit);
      const reg  = await pdfDoc.embedFont(_fontCaladeaCache.reg,  { subset: true });
      const bold = await pdfDoc.embedFont(_fontCaladeaCache.bold, { subset: true });
      f.serif = reg; f.serifB = bold;
    }
  } catch (e) {
    console.warn('Caladea non disponibile, uso Times:', e);
  }
  return f;
}

// Legge dal DOM tutto quello che serve a disegnare il foglio (misure in px CSS, a scala 1)
function misuraFoglioPerPDF(paper) {
  const trPrima = paper.style.transform;
  paper.style.transform = 'none';                 // misuro a grandezza reale (niente zoom dell'editor)
  try {
    const o = paper.getBoundingClientRect();
    const rel = (r) => ({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height });
    const m = { W: o.width, H: o.height, fills: [], lines: [], strikes: [], uls: [], imgs: [], texts: [] };
    const num = (v) => parseFloat(v) || 0;
    const colore = (c) => {
      const mm = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(c || '');
      return mm ? [+mm[1], +mm[2], +mm[3]] : [0, 0, 0];
    };
    const lato = (cs, s) => (cs['border' + s + 'Style'] !== 'none' ? num(cs['border' + s + 'Width']) : 0);

    // bordi: tabelle (contorno) e celle
    paper.querySelectorAll('table').forEach((t) => {
      const r = rel(t.getBoundingClientRect()), cs = getComputedStyle(t);
      const w = lato(cs, 'Top');
      if (w > 0) {
        const h = w / 2;
        m.lines.push({ x1: r.x + h, y1: r.y + h, x2: r.x + r.w - h, y2: r.y + h, w });
        m.lines.push({ x1: r.x + h, y1: r.y + r.h - h, x2: r.x + r.w - h, y2: r.y + r.h - h, w });
        m.lines.push({ x1: r.x + h, y1: r.y + h, x2: r.x + h, y2: r.y + r.h - h, w });
        m.lines.push({ x1: r.x + r.w - h, y1: r.y + h, x2: r.x + r.w - h, y2: r.y + r.h - h, w });
      }
    });
    paper.querySelectorAll('td, th').forEach((c) => {
      const r = rel(c.getBoundingClientRect()), cs = getComputedStyle(c);
      if (c.tagName === 'TH') {
        const bg = cs.backgroundColor;
        if (bg && !/rgba\(.*,\s*0\)$/.test(bg) && bg !== 'transparent') m.fills.push({ ...r, rgb: colore(bg) });
      }
      const t = lato(cs, 'Top'), b = lato(cs, 'Bottom'), l = lato(cs, 'Left'), rr = lato(cs, 'Right');
      if (t) m.lines.push({ x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y, w: t });
      if (b) m.lines.push({ x1: r.x, y1: r.y + r.h, x2: r.x + r.w, y2: r.y + r.h, w: b });
      if (l) m.lines.push({ x1: r.x, y1: r.y, x2: r.x, y2: r.y + r.h, w: l });
      if (rr) m.lines.push({ x1: r.x + r.w, y1: r.y, x2: r.x + r.w, y2: r.y + r.h, w: rr });
    });

    // righe barrate (giocatori assenti): dall'interno della 1ª colonna all'interno dell'ultima
    const inset = PDF_STRIKE_INSET_MM * PDF_MM_PX;
    paper.querySelectorAll('tr.assente').forEach((tr) => {
      const celle = tr.querySelectorAll('td');
      if (celle.length < 2) return;
      const a = rel(celle[0].getBoundingClientRect()), z = rel(celle[celle.length - 1].getBoundingClientRect());
      m.strikes.push({ x1: a.x + 0.5 + inset, x2: z.x + z.w - 0.5 - inset, y: a.y + a.h / 2 });
    });

    // linee dei campi (.f / .uline) e linee firma
    const sotto = PDF_UNDERLINE_BOTTOM_MM * PDF_MM_PX;
    paper.querySelectorAll('.f, .uline').forEach((e) => {
      const r = rel(e.getBoundingClientRect());
      m.uls.push({ x1: r.x, x2: r.x + r.w, y: r.y + r.h - sotto - 0.5 });
    });
    paper.querySelectorAll('.sign .line').forEach((e) => {
      const r = rel(e.getBoundingClientRect());
      m.lines.push({ x1: r.x, y1: r.y + r.h - 0.5, x2: r.x + r.w, y2: r.y + r.h - 0.5, w: 1 });
    });

    // loghi (object-fit: contain)
    paper.querySelectorAll('.brand img').forEach((img) => {
      const r = rel(img.getBoundingClientRect());
      const nw = img.naturalWidth || r.w, nh = img.naturalHeight || r.h;
      const s = Math.min(r.w / nw, r.h / nh), w = nw * s, h = nh * s;
      m.imgs.push({ src: img.src, x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h });
    });

    // testi: ogni nodo di testo con posizione, baseline, carattere, colore
    const tw = document.createTreeWalker(paper, NodeFilter.SHOW_TEXT);
    const nodi = [];
    let n;
    while ((n = tw.nextNode())) nodi.push(n);
    nodi.forEach((nodo) => {
      const testo = nodo.textContent.replace(/[\s\u00a0]+/g, ' ').trim();
      if (!testo) return;
      const parent = nodo.parentElement;
      const cs = getComputedStyle(parent);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const range = document.createRange();
      range.selectNodeContents(nodo);
      const rr = range.getClientRects();
      if (!rr.length) return;
      const r = rel(rr[0]);
      const probe = document.createElement('span');               // sonda a altezza 0: il suo fondo è la baseline
      probe.style.cssText = 'display:inline-block;width:0;height:0;';
      parent.insertBefore(probe, nodo);
      const base = probe.getBoundingClientRect().bottom - o.top;
      probe.remove();
      const cella = parent.closest('td, th');
      let maxRight = null;
      if (cella && getComputedStyle(cella).overflow === 'hidden') {
        const cr = rel(cella.getBoundingClientRect());
        maxRight = cr.x + cr.w - num(getComputedStyle(cella).paddingRight) - 1;
      }
      const fam = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim().toLowerCase();
      m.texts.push({
        text: testo, x: r.x, base, maxRight,
        pt: num(cs.fontSize) * PDF_PX,
        bold: parseInt(cs.fontWeight, 10) >= 600,
        sans: /^(arial|helvetica|liberation sans|arimo|ui-sans-serif|system-ui|sans-serif)/.test(fam),
        rgb: colore(cs.color)
      });
    });
    return m;
  } finally {
    paper.style.transform = trPrima;
  }
}

function testoSicuro(font, s) {
  try { font.encodeText(s); return s; } catch (_) {
    return Array.from(s).map((c) => { try { font.encodeText(c); return c; } catch (_) { return '?'; } }).join('');
  }
}

async function disegnaPDF(m) {
  const { PDFDocument, rgb } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PDF_A4_W, PDF_A4_H]);
  const f = await caricaFontPDF(pdfDoc);

  // se il foglio fosse più grande di un A4 (molti giocatori) lo rimpicciolisco uniformemente
  const K = Math.min(1, PDF_A4_H / (m.H * PDF_PX), PDF_A4_W / (m.W * PDF_PX));
  const X = (v) => v * PDF_PX * K;
  const Y = (v) => PDF_A4_H - v * PDF_PX * K;
  const col = (c) => rgb(c[0] / 255, c[1] / 255, c[2] / 255);
  const NERO = rgb(0, 0, 0);

  // 1) sfondi (intestazione scura)
  m.fills.forEach((r) => {
    page.drawRectangle({ x: X(r.x), y: Y(r.y + r.h), width: X(r.w), height: X(r.h), color: col(r.rgb) });
  });

  // 2) righe rosse degli assenti (sotto bordi e testi, come nell'editor)
  m.strikes.forEach((s) => {
    page.drawLine({ start: { x: X(s.x1), y: Y(s.y) }, end: { x: X(s.x2), y: Y(s.y) }, thickness: X(1), color: col(PDF_STRIKE_RGB) });
  });

  // 3) bordi delle tabelle e linee firma (allungati di mezzo spessore per chiudere gli angoli)
  m.lines.forEach((l) => {
    const h = l.w / 2;
    const orizz = Math.abs(l.y1 - l.y2) < 0.01;
    const a = orizz ? { x: l.x1 - h, y: l.y1 } : { x: l.x1, y: l.y1 - h };
    const b = orizz ? { x: l.x2 + h, y: l.y2 } : { x: l.x2, y: l.y2 + h };
    page.drawLine({ start: { x: X(a.x), y: Y(a.y) }, end: { x: X(b.x), y: Y(b.y) }, thickness: X(l.w), color: NERO });
  });

  // 4) linee dei campi (CASA, DATA, ORA, ARBITRO, 1., 2.)
  m.uls.forEach((u) => {
    page.drawLine({ start: { x: X(u.x1), y: Y(u.y) }, end: { x: X(u.x2), y: Y(u.y) }, thickness: X(1), color: NERO });
  });

  // 5) loghi
  for (const im of m.imgs) {
    try {
      const bytes = await (await fetch(im.src)).arrayBuffer();
      const png = /^data:image\/png/i.test(im.src) || /\.png(\?|$)/i.test(im.src);
      const img = png ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      page.drawImage(img, { x: X(im.x), y: Y(im.y + im.h), width: X(im.w), height: X(im.h) });
    } catch (e) { console.warn('Logo non inserito nel PDF:', e); }
  }

  // 6) testi
  m.texts.forEach((t) => {
    const font = t.sans ? (t.bold ? f.sansB : f.sans) : (t.bold ? f.serifB : f.serif);
    let s = testoSicuro(font, t.text);
    if (t.maxRight != null) {                                   // come text-overflow: ellipsis
      const disp = (t.maxRight - t.x) * PDF_PX;
      if (font.widthOfTextAtSize(s, t.pt) > disp) {
        while (s.length > 1 && font.widthOfTextAtSize(s + '…', t.pt) > disp) s = s.slice(0, -1);
        s = s.trimEnd() + '…';
      }
    }
    page.drawText(s, { x: X(t.x), y: Y(t.base), size: t.pt * K, font, color: col(t.rgb) });
  });

  return pdfDoc.save();
}

async function creaPDFDistinta() {
  const paper = document.getElementById('distinta-paper');
  if (!paper || typeof PDFLib === 'undefined') throw new Error('pdf-lib non caricato');
  const testo = (id) => (document.getElementById(id)?.innerText || '').trim();
  const nomeFile = ('Distinta ' + testo('pdf-casa-name') + ' - ' + testo('pdf-fcasa-name'))
    .replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_') + '.pdf';

  const misure = misuraFoglioPerPDF(paper);
  const bytes = await disegnaPDF(misure);
  return { blob: new Blob([bytes], { type: 'application/pdf' }), nomeFile };
}

async function condividiPDF() {
  const { blob, nomeFile } = pdfPronto;
  const file = new File([blob], nomeFile, { type: 'application/pdf' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });   // niente title/text: iOS li salverebbe come file "Testo"
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



