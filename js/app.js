document.addEventListener('DOMContentLoaded', () => {
  if (!currentUser) {
    document.getElementById('login-modal')?.classList.remove('hidden');
  }

  // Gestione apertura da click su notifica push (es. /?tab=messaggi o /?tab=sondaggi)
  const urlParams = new URLSearchParams(window.location.search);
  const targetTab = urlParams.get('tab');

  if (targetTab && typeof switchTab === 'function') {
    switchTab(targetTab);
  } else if (typeof switchTab === 'function') {
    // Ripristina l'ultima tab attiva salvata o 'partite' di default
    const savedTab = localStorage.getItem('darsenal_active_tab') || 'partite';
    switchTab(savedTab);
  }
});