// Assegniamo i valori alle variabili globali già dichiarate in state.js
currentUser = localStorage.getItem('darsenal_user') || null;
isAdmin = localStorage.getItem('darsenal_is_admin') === 'true';

// Helper per la normalizzazione dei nomi inseriti
function normalizzaNomeInput(nome) {
  if (!nome) return '';
  return nome.toLowerCase().trim().split(/\s+/).sort().join(' ');
}

// Esecuzione Login con persistenza
async function confermaLogin() {
  const nomeInputEl = document.getElementById('input-nome-utente');
  const pwdInputEl = document.getElementById('input-pwd-admin');

  if (!nomeInputEl) return;

  const nomeInput = nomeInputEl.value.trim();
  const pwdInput = pwdInputEl ? pwdInputEl.value : '';

  if (!nomeInput) return alert("Inserisci il tuo nome.");

  const inputNorm = normalizzaNomeInput(nomeInput);

  let nomeUfficiale = null; 
  let giocatoreTrovato = false;

  if (typeof GIOCATORI_MOCK !== 'undefined' && Array.isArray(GIOCATORI_MOCK)) {
    const match = GIOCATORI_MOCK.find(g => normalizzaNomeInput(g.nome_completo) === inputNorm);
    if (match) {
      nomeUfficiale = match.nome_completo;
      giocatoreTrovato = true;
    }
  }

  if (inputNorm === normalizzaNomeInput('alessandro branca')) {
    if (pwdInput === 'AlessandroDelPiero') {
      isAdmin = true;
      currentUser = nomeUfficiale || 'Branca Alessandro'; 
    } else {
      return alert("Password Admin errata!");
    }
  } else {
    if (!giocatoreTrovato) {
      return alert("Calciatore non appartenente a questa squadra.");
    }
    isAdmin = false;
    currentUser = nomeUfficiale;
  }

  // SALVATAGGIO IN LOCALSTORAGE
  localStorage.setItem('darsenal_user', currentUser);
  localStorage.setItem('darsenal_is_admin', isAdmin ? 'true' : 'false');

  applicaStatoUtente();
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  if (typeof registraPushNotifications === 'function') {
    registraPushNotifications();
  }
  if (typeof aggiornaBadgeNavSondaggiIniziale === 'function') {
    aggiornaBadgeNavSondaggiIniziale();
  }

  const loginModal = document.getElementById('login-modal');
  if (loginModal) loginModal.classList.add('hidden');
  
  if (typeof switchTab === 'function') switchTab('partite');
}

// Funzione Logout aggiornata con Modale Custom
async function logout() {
  const confermato = await mostraConfirm("Vuoi davvero uscire dal tuo account?", "Logout");
  if (!confermato) return;
  
  localStorage.removeItem('darsenal_user');
  localStorage.removeItem('darsenal_is_admin');
  
  currentUser = null;
  isAdmin = false;

  if (typeof chiudiMenuUtente === 'function') {
    chiudiMenuUtente();
  }

  applicaStatoUtente();
  document.getElementById('login-modal')?.classList.remove('hidden');
}

// Applica le visibilità e i dati utente
function applicaStatoUtente() {
  const headerInitials = document.getElementById('header-user-initials');
  const menuInitials = document.getElementById('menu-user-initials');
  const menuName = document.getElementById('menu-user-name');

  if (currentUser) {
    const iniziali = typeof getIniziali === 'function' ? getIniziali(currentUser) : '--';
    if (headerInitials) headerInitials.innerText = iniziali;
    if (menuInitials) menuInitials.innerText = iniziali;
    if (menuName) menuName.innerText = currentUser;

    document.getElementById('login-modal')?.classList.add('hidden');

    if (typeof caricaStatisticheUtente === 'function') {
      caricaStatisticheUtente(currentUser);
    }
  } else {
    if (headerInitials) headerInitials.innerText = '--';
    if (menuInitials) menuInitials.innerText = '--';
    if (menuName) menuName.innerText = 'Utente';
  }

  // VISIBILITÀ ELEMENTI ADMIN
  if (isAdmin) {
    document.getElementById('admin-partita-btn-container')?.classList.remove('hidden');
    document.getElementById('admin-classifica-btn')?.classList.remove('hidden');
    document.getElementById('admin-msg-btn')?.classList.remove('hidden');
  } else {
    document.getElementById('admin-partita-btn-container')?.classList.add('hidden');
    document.getElementById('admin-classifica-btn')?.classList.add('hidden');
    document.getElementById('admin-msg-btn')?.classList.add('hidden');
  }

  // "Info Tutti i Giocatori" visibile a TUTTI gli utenti
  document.getElementById('admin-menu-section')?.classList.remove('hidden');

  if (typeof aggiornaPannelloAdminSondaggi === 'function') {
    aggiornaPannelloAdminSondaggi();
  }

  if (typeof aggiornaBadgeMessaggi === 'function') {
    aggiornaBadgeMessaggi();
  }

  if (isAdmin) {
    document.getElementById('btn-aggiungi-movimento')?.classList.remove('hidden');
  } else {
    document.getElementById('btn-aggiungi-movimento')?.classList.add('hidden');
  }
  }

document.addEventListener('DOMContentLoaded', async () => {
  const savedUser = localStorage.getItem('darsenal_user');
  const savedAdmin = localStorage.getItem('darsenal_is_admin');

  if (savedUser) {
    currentUser = savedUser;
    isAdmin = savedAdmin === 'true';
    if (typeof registraPushNotifications === 'function') {
      registraPushNotifications();
    }
  }

  const nomeInput = document.getElementById('input-nome-utente');
  if (nomeInput) {
    nomeInput.addEventListener('input', (e) => {
      const val = normalizzaNomeInput(e.target.value);
      const pwdContainer = document.getElementById('pwd-container');
      if (pwdContainer) {
        if (val === normalizzaNomeInput('alessandro branca')) {
          pwdContainer.classList.remove('hidden');
        } else {
          pwdContainer.classList.add('hidden');
        }
      }
    });
  }

  applicaStatoUtente();

  // RIPRISTINA L'ULTIMA TAB ATTIVA AL RICARICAMENTO DELLA PAGINA
  const savedTab = localStorage.getItem('darsenal_active_tab') || 'partite';
  if (currentUser) {
    if (typeof switchTab === 'function') switchTab(savedTab);
  } else {
    if (typeof switchTab === 'function') switchTab('partite');
  }

  // AGGIORNA SUBITO IL PALLINO ROSSO SULLA NAVBAR AL CARICAMENTO
  if (typeof aggiornaBadgeNavSondaggiIniziale === 'function') {
    aggiornaBadgeNavSondaggiIniziale();
  }
});