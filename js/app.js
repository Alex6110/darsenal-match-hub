document.addEventListener('DOMContentLoaded', () => {
  if (!currentUser) {
    document.getElementById('login-modal')?.classList.remove('hidden');
  }

  // Ripristina l'ultima tab attiva salvata o 'partite' di default
  if (typeof switchTab === 'function') {
    const savedTab = localStorage.getItem('darsenal_active_tab') || 'partite';
    switchTab(savedTab);
  }
});