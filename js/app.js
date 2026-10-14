document.addEventListener('DOMContentLoaded', () => {
  if (!currentUser) {
    document.getElementById('login-modal')?.classList.remove('hidden');
  }

  // Gestione apertura da click su notifica push (es. /?tab=messaggi&id=... o /?tab=sondaggi&id=...)
  const urlParams = new URLSearchParams(window.location.search);
  const targetTab = urlParams.get('tab');
  const targetId = urlParams.get('id');

  if (targetTab && typeof switchTab === 'function') {
    switchTab(targetTab);

    // Evidenzia e scorri verso l'oggetto specifico se è presente un ID
    if (targetId) {
      setTimeout(() => {
        const elemento = document.getElementById(`msg-${targetId}`) || document.getElementById(`item-${targetId}`) || document.getElementById(`partita-${targetId}`);
        if (elemento) {
          elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
          elemento.classList.add('ring-4', 'ring-burgundy');
          setTimeout(() => elemento.classList.remove('ring-4', 'ring-burgundy'), 3000);
        }
      }, 600);
    }
  } else if (typeof switchTab === 'function') {
    const savedTab = localStorage.getItem('darsenal_active_tab') || 'partite';
    switchTab(savedTab);
  }
});