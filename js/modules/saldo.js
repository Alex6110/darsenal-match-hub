// js/modules/saldo.js

async function caricaSaldo() {
  const container = document.getElementById('saldo-container');
  const totaleCassaEl = document.getElementById('totale-cassa');
  if (!container) return;

  container.innerHTML = `<div class="text-center text-xs text-slate-400 py-6">Caricamento saldo in corso...</div>`;

  const { data: movimenti, error } = await db
    .from('movimenti_cassa')
    .select('*')
    .order('data', { ascending: false });

  if (error) {
    container.innerHTML = `<div class="text-center text-xs text-rose-500 py-4">Errore caricamento movimenti.</div>`;
    return;
  }

  let totaleGenerale = 0;
  (movimenti || []).forEach(m => {
    totaleGenerale += parseFloat(m.importo) || 0;
  });

  if (totaleCassaEl) {
    totaleCassaEl.innerText = `€ ${totaleGenerale.toFixed(2)}`;
    totaleCassaEl.className = totaleGenerale >= 0 ? 'text-emerald-600 font-black text-xl' : 'text-rose-600 font-black text-xl';
  }

  if (!movimenti || movimenti.length === 0) {
    container.innerHTML = `<div class="text-center text-xs text-slate-400 py-6">Nessun movimento registrato.</div>`;
    return;
  }

  container.innerHTML = movimenti.map(m => {
    const imp = parseFloat(m.importo) || 0;
    const isPositivo = imp >= 0;
    const dataFormatted = new Date(m.data).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

    const adminDelete = (typeof isAdmin !== 'undefined' && isAdmin) ? `
      <button onclick="eliminaMovimentoSaldo('${m.id}')" class="text-slate-300 hover:text-rose-600 transition-colors p-1" title="Elimina">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
    ` : '';

    return `
      <div class="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="font-black text-xs text-slate-800 capitalize truncate">${m.nome_giocatore}</span>
            <span class="text-[10px] text-slate-400 font-semibold">${dataFormatted}</span>
          </div>
          <p class="text-xs text-slate-600 font-medium truncate mt-0.5">${m.causale || 'Quota / Spesa'}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-xs font-black ${isPositivo ? 'text-emerald-600' : 'text-rose-600'}">
            ${isPositivo ? '+' : ''}${imp.toFixed(2)} €
          </span>
          ${adminDelete}
        </div>
      </div>
    `;
  }).join('');
}

async function aggiungiMovimentoSaldo() {
  if (!window.isAdmin) return mostraAlert("Solo gli admin possono registrare movimenti di cassa.");
  document.getElementById('modal-aggiungi-movimento')?.classList.remove('hidden');
}

function chiudiModalMovimento() {
  document.getElementById('modal-aggiungi-movimento')?.classList.add('hidden');
  document.getElementById('input-movimento-giocatore').value = '';
  document.getElementById('input-movimento-importo').value = '';
  document.getElementById('input-movimento-causale').value = '';
}

async function salvaNuovoMovimento() {
  const giocatore = document.getElementById('input-movimento-giocatore').value.trim();
  const importo = parseFloat(document.getElementById('input-movimento-importo').value);
  const causale = document.getElementById('input-movimento-causale').value.trim();

  if (!giocatore || isNaN(importo)) {
    return mostraAlert("Inserisci un nome valido e un importo numerico.");
  }

  const { error } = await db.from('movimenti_cassa').insert([{
    nome_giocatore: giocatore,
    importo: importo,
    causale: causale || 'Quota / Spesa'
  }]);

  if (error) return mostraAlert("Errore durante il salvataggio: " + error.message);

  chiudiModalMovimento();
  caricaSaldo();
}

async function eliminaMovimentoSaldo(id) {
  const confermato = await mostraConfirm("Vuoi eliminare questo movimento di cassa?");
  if (!confermato) return;

  const { error } = await db.from('movimenti_cassa').delete().eq('id', id);
  if (error) return mostraAlert("Impossibile eliminare il movimento.");

  caricaSaldo();
}

// Aggiornamento automatico in tempo reale tramite Supabase Realtime
if (window.db) {
  db.channel('public:movimenti_cassa')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'movimenti_cassa' }, () => {
      caricaSaldo();
    })
    .subscribe();
}