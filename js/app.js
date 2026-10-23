document.addEventListener('DOMContentLoaded', () => {
  if (!currentUser) {
    document.getElementById('login-modal')?.classList.remove('hidden');
  }

  // Gestione apertura da click su notifica push (es. /?tab=sondaggi&cat=amichevole&id=... o /?tab=messaggi&id=...&emoji=👍)
  const urlParams = new URLSearchParams(window.location.search);
  const targetTab = urlParams.get('tab');
  const targetCat = urlParams.get('cat');
  const targetId = urlParams.get('id');
  const targetEmoji = urlParams.get('emoji');

  if (targetTab) {
    if (targetTab === 'formazione' && typeof apriSezioneFormazione === 'function') {
      apriSezioneFormazione();
    } else if (typeof switchTab === 'function') {
      switchTab(targetTab);

      // Se siamo nei sondaggi e c'è una sottocategoria (torneo, amichevole, disponibilita)
      if (targetTab === 'sondaggi' && targetCat && typeof cambiaCategoriaSondaggi === 'function') {
        cambiaCategoriaSondaggi(targetCat);
      }

      // Evidenzia e scorri verso l'oggetto specifico se è presente un ID
      if (targetId) {
        setTimeout(() => {
          const elemento = document.getElementById(`msg-${targetId}`) || document.getElementById(`item-${targetId}`) || document.getElementById(`partita-${targetId}`);
          if (elemento) {
            elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
            elemento.classList.add('ring-4', 'ring-burgundy');
            
            // Animazione specifica per l'emoji della reazione sul messaggio
            if (targetEmoji && targetTab === 'messaggi') {
              const emojiBtns = elemento.querySelectorAll('button');
              emojiBtns.forEach(btn => {
                if (btn.textContent.includes(targetEmoji)) {
                  btn.classList.add('animate-bounce', 'ring-2', 'ring-amber-400');
                  setTimeout(() => btn.classList.remove('animate-bounce', 'ring-2', 'ring-amber-400'), 4000);
                }
              });
            }

            setTimeout(() => elemento.classList.remove('ring-4', 'ring-burgundy'), 3000);
          }
        }, 600);
      }
    }
  } else if (typeof switchTab === 'function') {
    const savedTab = localStorage.getItem('darsenal_active_tab') || 'partite';
    switchTab(savedTab);
  }
});