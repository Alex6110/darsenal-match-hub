// -------------------------------------------------------------
// GESTIONE NOTIFICHE, REALTIME E APP BADGE
// -------------------------------------------------------------

async function richiediPermessoNotifiche() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

async function aggiornaAppBadgeTotale() {
  if (!('setAppBadge' in navigator)) return;

  try {
    if (!currentUser) {
      await navigator.clearAppBadge();
      return;
    }

    // Calcola messaggi non letti + sondaggi non votati
    const [{ data: tuttiMessaggi }, { data: letture }, { data: partiteList }, { data: presenze }, { data: votiCustom }] = await Promise.all([
      db.from('messaggi').select('id'),
      db.from('letture_messaggi').select('id_messaggio').eq('nome_utente', currentUser),
      db.from('partite').select('*'),
      db.from('presenze').select('*').eq('nome_utente', currentUser),
      db.from('voti_sondaggi').select('*').eq('nome_utente', currentUser)
    ]);

    // Messaggi non letti
    const lettiIds = letture ? letture.map(l => l.id_messaggio) : [];
    const msgNonLetti = (tuttiMessaggi || []).filter(m => !lettiIds.includes(m.id)).length;

    // Sondaggi futuri non votati
    const inizioOggi = new Date();
    inizioOggi.setHours(0, 0, 0, 0);
    const sondaggiFuturi = (partiteList || []).filter(p => new Date(p.data_ora) >= inizioOggi && p.tipo_sondaggio !== 'annullato');
    
    const sondaggiNonVotati = sondaggiFuturi.filter(p => {
      const isCustom = p.tipo_sondaggio === 'disponibilita' || p.tipo_sondaggio === 'multi';
      if (isCustom) {
        return !votiCustom.some(v => v.id_sondaggio === p.id);
      } else {
        return !presenze.some(pr => pr.id_partita === p.id);
      }
    }).length;

    const totaleNotifiche = msgNonLetti + sondaggiNonVotati;

    if (totaleNotifiche > 0) {
      await navigator.setAppBadge(totaleNotifiche);
    } else {
      await navigator.clearAppBadge();
    }
  } catch (err) {
    console.warn("Errore aggiornamento App Badge:", err);
  }
}

function mostraNotificaSistema(titolo, corpo) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(titolo, {
            body: corpo,
            icon: 'logo.png',
            badge: 'logo.png'
          });
        });
      } else {
        new Notification(titolo, { body: corpo, icon: 'logo.png' });
      }
    } catch (e) {
      console.warn("Impossibile mostrare notifica di sistema:", e);
    }
  }
}

// Inizializzazione ascoltatori Supabase Realtime
function avviaAscoltatoriRealtime() {
  if (!window.supabase || !db) return;

  // 1. ASCOLTO MESSAGGI
  db.channel('public:messaggi')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messaggi' }, payload => {
      if (currentUser) {
        aggiornaAppBadgeTotale();
        if (typeof aggiornaBadgeMessaggi === 'function') aggiornaBadgeMessaggi();
        if (typeof caricaMessaggi === 'function' && document.getElementById('view-messaggi') && !document.getElementById('view-messaggi').classList.contains('hidden')) {
          caricaMessaggi();
        }
      }
    })
    .subscribe();

  // 2. ASCOLTO NUOVI SONDAGGI / PARTITE
  db.channel('public:partite')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'partite' }, payload => {
      const nuovaPartita = payload.new;
      if (currentUser && nuovaPartita.tipo_sondaggio !== 'annullato') {
        aggiornaAppBadgeTotale();
        if (typeof caricaSondaggi === 'function') caricaSondaggi();
      }
    })
    .subscribe();

  // 3. ASCOLTO REAZIONI AI MESSAGGI
  db.channel('public:reazioni_messaggi')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reazioni_messaggi' }, () => {});

  // 4. ASCOLTO VOTI E PRESENZE AI SONDAGGI
  db.channel('public:presenze_e_voti')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'presenze' }, () => {
      if (typeof caricaSondaggi === 'function') caricaSondaggi();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'voti_sondaggi' }, () => {
      if (typeof caricaSondaggi === 'function') caricaSondaggi();
    })
    .subscribe();
}

// Richiedi i permessi al primo login o caricamento
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    richiediPermessoNotifiche();
    registraPushNotifications(); 
    avviaAscoltatoriRealtime();
    aggiornaAppBadgeTotale();
  }, 1500);
});


// -------------------------------------------------------------
// CONFIGURAZIONE WEB PUSH (APP CHIUSA)
// -------------------------------------------------------------

// INCOLLA QUI LA TUA PUBLIC KEY VAPID GENERATA AL PASSO 1
const VAPID_PUBLIC_KEY = 'BAVhUwIR23wV1XqUC4ji-G0ou7Zs6pZKNdGFfvauCKiDkLlxxmxjlndBdGgYFwTr139iXXxtF7OKRpxv-rsRNC0';

async function registraPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (!currentUser) return;

  try {
    // 1. Registra il Service Worker
    const reg = await navigator.serviceWorker.register('/sw.js');

    // 2. ATTESA ATTIVA: Assicurati che il Service Worker sia pronto e attivo
    await navigator.serviceWorker.ready;

    // 3. Controlla il permesso (se non è 'granted', esce subito senza bloccare)
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
    } else if (Notification.permission !== 'granted') {
      return;
    }

    // 4. Recupera o crea la sottoscrizione con un controllo di stabilità
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
    }

    // 5. Salva su Supabase
    const { error } = await db.from('push_subscriptions').upsert({
      nome_utente: currentUser,
      subscription: subscription.toJSON()
    }, { onConflict: 'nome_utente' });

    if (error) {
      console.warn("Errore salvataggio subscription su DB:", error);
    } else {
      console.log("Dispositivo registrato con successo per:", currentUser);
    }
  } catch (err) {
    console.warn("Tentativo push fallito (verrà ritornato al prossimo avvio):", err);
  }
}

// Funzione di utilità per convertire la chiave VAPID
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}