// js/state.js
let currentUser = null;
let isAdmin = false;

// Stato Fasi
let fasiTorneo = [];
let faseAttivaId = localStorage.getItem('faseAttivaId') || null;

// Mock iniziale se il DB è vuoto, altrimenti caricale dal tuo DB Supabase
async function caricaFasiTorneo() {
  // Esempio chiamata DB: const { data } = await db.from('fasi_torneo').select('*');
  // Se non hai ancora la tabella, usiamo una simulazione persistente per ora:
  let datiFasi = JSON.parse(localStorage.getItem('fasi_salvate')) || [{ id: 'fase-1', nome: 'Girone A', eliminazione: false }];
  fasiTorneo = datiFasi;

  if (!faseAttivaId || !fasiTorneo.find(f => f.id === faseAttivaId)) {
    faseAttivaId = fasiTorneo[0].id;
    localStorage.setItem('faseAttivaId', faseAttivaId);
  }
  
  aggiornaUIFasi();
}

function aggiornaUIFasi() {
  const faseAttiva = fasiTorneo.find(f => f.id === faseAttivaId) || fasiTorneo[0];
  
  // Aggiorna testi visualizzati
  document.getElementById('display-fase-corrente-partite').innerText = faseAttiva.nome;
  document.getElementById('display-fase-corrente-classifica').innerText = faseAttiva.nome;

  // Logica Visibilità Menù: Mostra se ci sono >1 fasi OPPURE se sei admin
  const mostraMenu = fasiTorneo.length > 1 || isAdmin;
  document.getElementById('selettore-fase-partite-container').classList.toggle('hidden', !mostraMenu);
  document.getElementById('selettore-fase-classifica-container').classList.toggle('hidden', !mostraMenu);

  // Visibilità pulsanti Admin
  document.getElementById('btn-crea-fase-partite').classList.toggle('hidden', !isAdmin);
  document.getElementById('btn-crea-fase-classifica').classList.toggle('hidden', !isAdmin);

  // Generazione Lista per Partite (Tutte le fasi)
  document.getElementById('lista-fasi-partite').innerHTML = fasiTorneo.map(f => 
    `<div onclick="cambiaFaseAttiva('${f.id}')" class="p-3 text-xs font-semibold ${f.id === faseAttivaId ? 'text-burgundy bg-burgundy/5' : 'text-slate-700'} hover:bg-slate-50 cursor-pointer transition-colors">${f.nome}</div>`
  ).join('');

  // Generazione Lista per Classifica (SOLO Gironi)
  document.getElementById('lista-fasi-classifica').innerHTML = fasiTorneo.filter(f => !f.eliminazione).map(f => 
    `<div onclick="cambiaFaseAttiva('${f.id}')" class="p-3 text-xs font-semibold ${f.id === faseAttivaId ? 'text-burgundy bg-burgundy/5' : 'text-slate-700'} hover:bg-slate-50 cursor-pointer transition-colors">${f.nome}</div>`
  ).join('');

  // Ricarica i dati filtrati
  if(typeof caricaPartite === 'function') caricaPartite();
  if(typeof caricaClassifica === 'function') caricaClassifica();
}

function cambiaFaseAttiva(id) {
  faseAttivaId = id;
  localStorage.setItem('faseAttivaId', id);
  document.getElementById('menu-fasi-partite').classList.add('hidden');
  document.getElementById('menu-fasi-classifica').classList.add('hidden');
  aggiornaUIFasi();
}

function toggleMenuFasi(sezione) {
  const menu = document.getElementById(`menu-fasi-${sezione}`);
  menu.classList.toggle('hidden');
}

// Chiusura menù se si clicca fuori
document.addEventListener('click', (e) => {
  if (!e.target.closest('#selettore-fase-partite-container')) document.getElementById('menu-fasi-partite')?.classList.add('hidden');
  if (!e.target.closest('#selettore-fase-classifica-container')) document.getElementById('menu-fasi-classifica')?.classList.add('hidden');
});

// Funzioni Modale
function apriModalNuovaFase() {
  document.getElementById('nuova-fase-modal').classList.remove('hidden');
}
function chiudiModalNuovaFase() {
  document.getElementById('nuova-fase-modal').classList.add('hidden');
  document.getElementById('input-nome-fase').value = '';
}
function salvaNuovaFase() {
  const nome = document.getElementById('input-nome-fase').value.trim();
  const eliminazione = document.getElementById('input-tipo-fase').checked;
  if (!nome) return;

  const nuovaFase = { id: 'fase-' + Date.now(), nome, eliminazione };
  fasiTorneo.push(nuovaFase);
  
  // Salva (simulato per ora su localstorage, qui andrà la insert Supabase)
  localStorage.setItem('fasi_salvate', JSON.stringify(fasiTorneo));
  
  cambiaFaseAttiva(nuovaFase.id);
  chiudiModalNuovaFase();
}

function caricaDatiPerTab(tab) {
  if (tab === 'partite' && typeof caricaPartite === 'function') caricaPartite();
  else if (tab === 'classifica' && typeof caricaClassifica === 'function') caricaClassifica();
  else if (tab === 'sondaggi' && typeof caricaSondaggi === 'function') caricaSondaggi();
  else if (tab === 'saldo' && typeof caricaDatiCassaSupabase === 'function') caricaDatiCassaSupabase();
  else if (tab === 'giocatori' && typeof caricaTabellaGiocatoriInfo === 'function') caricaTabellaGiocatoriInfo();
}