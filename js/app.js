document.addEventListener('DOMContentLoaded', () => {
  if (!currentUser) {
    document.getElementById('login-modal')?.classList.remove('hidden');
  }

  const urlParams = new URLSearchParams(window.location.search);
  const targetTab = urlParams.get('tab');
  const targetCat = urlParams.get('cat');
  const targetId = urlParams.get('id');
  const targetEmoji = urlParams.get('emoji');

  if (targetTab) {
    if (targetTab === 'formazione' && typeof apriSezioneFormazione === 'function') {
      apriSezioneFormazione();
    } else if (typeof switchTab === 'function') {
      switchTab(targetTab).then(() => {
        if (targetTab === 'sondaggi' && targetCat && typeof cambiaCategoriaSondaggi === 'function') {
          cambiaCategoriaSondaggi(targetCat);
        }
      });

      if (targetId) {
        const tentaEvidenziazione = (tentativi = 0) => {
          const elemento = document.getElementById(`msg-${targetId}`) || document.getElementById(`item-${targetId}`) || document.getElementById(`partita-${targetId}`);
          if (elemento) {
            elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
            elemento.classList.add('ring-4', 'ring-burgundy');
            
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
          } else if (tentativi < 10) {
            setTimeout(() => tentaEvidenziazione(tentativi + 1), 300);
          }
        };
        setTimeout(() => tentaEvidenziazione(), 500);
      }
    }
  } else if (typeof switchTab === 'function') {
    const savedTab = localStorage.getItem('darsenal_active_tab') || 'partite';
    switchTab(savedTab);
  }
});