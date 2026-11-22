// Copyright (c) 2026 Pedro Carrola (By Carrola). All rights reserved.
// Proprietary software - see LICENSE. Unauthorized use, copying or distribution is prohibited.
// ==================== i18n ====================
// Owns translation strings and applies them to any element carrying a
// data-i18n (textContent) or data-i18n-title (title attribute) marker.
// Dynamic strings (timer label, report cells) are read on demand via t().
(function (App) {
  'use strict';
  const LANGS = {
    en: {
      alarmSchool: 'Bell', alarmRipple: 'Ripple', alarmSpark: 'Spark', alarmLanding: 'Landing',
      alarmCloud: 'Cloud', alarmClassic: 'Classic', alarmVolume: 'Alarm volume', alarmEnabled: 'Alarm enabled',
      savedThemes: 'Saved themes',
      saveTheme: 'Save current theme',
      deleteTheme: 'Delete selected theme',
      savedTheme: 'Theme',

      colorSaturation: 'Saturation',
      colorBrightness: 'Brightness',
      colorHue: 'Hue',

      muteOnBreak: 'Mute during breaks',
      continueAfterZero: 'Continue after 0',
      overtime: 'Extra time',
      customTheme: 'Custom theme',
      backgroundColor: 'Background',

      focus: 'Focus', pause: 'Break',
      rain: 'Rain', whiteNoise: 'White Noise', brownNoise: 'Brown Noise', vol: 'Vol',
      pure40: 'Pure 40Hz', deepFocus: 'Deep Focus', binaural: 'Binaural Beats', birds: 'Birds', beach: 'Beach', coffeeShop: 'Coffee Shop',
      setTime: 'Set time', appSettings: 'Settings',
      focusTime: 'Focus Time', breakTime: 'Break', hrs: 'h', pickerHint: 'Scroll or click the number to type',
      min: 'min',
      minimizeOnClose: 'Minimize on close', autoStart: 'Auto-start timer', language: 'Language',
      donate: 'Support the app', feedback: 'Report a bug or idea 💬',
      acctTitle: 'Account', acctSubtitle: 'Sync across devices', acctSignInShort: 'Sign in',
      acctSignIn: 'Sign in with Google', acctSignOut: 'Sign out', acctSignInFailed: 'Sign-in failed',
      syncSyncing: 'Syncing...', syncSynced: 'Synced', syncOffline: 'Offline',
      oauthDoneTitle: 'You are signed in', oauthDoneBody: 'You can close this tab and go back to Study Pomodoro.',
      themeColor: 'Theme',
      avgPerDay: 'Avg/day', total: 'Total', vsPrev: 'vs previous',
      statistics: 'Statistics', week: 'Week', month: 'Month', year: 'Year',
      reviewTitle: 'Enjoying Study Pomodoro?',
      reviewBody: 'A quick rating really helps the app grow. 🙂',
      reviewRate: 'Rate', reviewLater: 'Later',
      settingsTooltip: 'Settings', reportTooltip: 'Statistics',
      alarmTooltip: 'Alarm', audioTooltip: 'Audio',
      resetTooltip: 'Reset', timesTooltip: 'Times',
      winMinimize: 'Minimize', winClose: 'Close', miniEnter: 'Mini mode', miniExit: 'Back',
      miniLock: 'Lock position', miniUnlock: 'Unlock position',

      weekdaysMin: ['M','T','W','T','F','S','S'],
      months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    },
    pt: {
      alarmSchool: 'Bell', alarmRipple: 'Ripple', alarmSpark: 'Spark', alarmLanding: 'Landing',
      alarmCloud: 'Cloud', alarmClassic: 'Clássico', alarmVolume: 'Volume do alarme', alarmEnabled: 'Alarme ligado',
      savedThemes: 'Temas guardados',
      saveTheme: 'Guardar tema atual',
      deleteTheme: 'Eliminar tema selecionado',
      savedTheme: 'Tema',

      colorSaturation: 'Saturação',
      colorBrightness: 'Luminosidade',
      colorHue: 'Tonalidade',

      muteOnBreak: 'Silenciar nas pausas',
      continueAfterZero: 'Continuar depois do 0',
      overtime: 'Tempo extra',
      customTheme: 'Tema personalizado',
      backgroundColor: 'Fundo',

      focus: 'Foco', pause: 'Pausa',
      rain: 'Chuva', whiteNoise: 'White Noise', brownNoise: 'Brown Noise', vol: 'Vol',
      pure40: 'Pure 40Hz', deepFocus: 'Foco Profundo', binaural: 'Binaural Beats', birds: 'Pássaros', beach: 'Praia', coffeeShop: 'Café',
      setTime: 'Definir tempo', appSettings: 'Definições',
      focusTime: 'Tempo de Foco', breakTime: 'Pausa', hrs: 'h', pickerHint: 'Desliza ou clica no número para escrever',
      min: 'min',
      minimizeOnClose: 'Minimizar ao fechar', autoStart: 'Iniciar timer automaticamente', language: 'Idioma',
      donate: 'Apoiar a app', feedback: 'Reportar bug ou ideia 💬',
      acctTitle: 'Conta', acctSubtitle: 'Sincronizar entre dispositivos', acctSignInShort: 'Entrar',
      acctSignIn: 'Entrar com Google', acctSignOut: 'Sair', acctSignInFailed: 'Não foi possível iniciar sessão',
      syncSyncing: 'A sincronizar...', syncSynced: 'Sincronizado', syncOffline: 'Offline',
      oauthDoneTitle: 'Sessão iniciada', oauthDoneBody: 'Já podes fechar este separador e voltar ao Study Pomodoro.',
      themeColor: 'Tema',
      avgPerDay: 'Média/dia', total: 'Total', vsPrev: 'vs anterior',
      statistics: 'Estatísticas', week: 'Semana', month: 'Mês', year: 'Ano',
      reviewTitle: 'A gostar da Study Pomodoro?',
      reviewBody: 'Uma avaliação rápida ajuda muito a app a crescer. 🙂',
      reviewRate: 'Avaliar', reviewLater: 'Mais tarde',
      settingsTooltip: 'Definições', reportTooltip: 'Estatísticas',
      alarmTooltip: 'Alarme', audioTooltip: 'Áudio',
      resetTooltip: 'Reiniciar', timesTooltip: 'Tempos',
      winMinimize: 'Minimizar', winClose: 'Fechar', miniEnter: 'Modo mini', miniExit: 'Voltar',
      miniLock: 'Bloquear posição', miniUnlock: 'Desbloquear posição',

      weekdaysMin: ['S','T','Q','Q','S','S','D'],
      months: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    },
    es: {
      alarmSchool: 'Bell', alarmRipple: 'Ripple', alarmSpark: 'Spark', alarmLanding: 'Landing',
      alarmCloud: 'Cloud', alarmClassic: 'Clásico', alarmVolume: 'Volumen de la alarma', alarmEnabled: 'Alarma activada',
      savedThemes: 'Temas guardados',
      saveTheme: 'Guardar tema actual',
      deleteTheme: 'Eliminar tema seleccionado',
      savedTheme: 'Tema',

      colorSaturation: 'Saturación',
      colorBrightness: 'Brillo',
      colorHue: 'Tono',

      muteOnBreak: 'Silenciar en descansos',
      continueAfterZero: 'Continuar después de 0',
      overtime: 'Tiempo extra',
      customTheme: 'Tema personalizado',
      backgroundColor: 'Fondo',

      focus: 'Enfoque', pause: 'Descanso',
      rain: 'Lluvia', whiteNoise: 'Ruido Blanco', brownNoise: 'Ruido Marrón', vol: 'Vol',
      pure40: 'Pure 40Hz', deepFocus: 'Enfoque Profundo', binaural: 'Binaural Beats', birds: 'Pájaros', beach: 'Playa', coffeeShop: 'Cafetería',
      setTime: 'Ajustar tiempo', appSettings: 'Ajustes',
      focusTime: 'Tiempo de Enfoque', breakTime: 'Descanso', hrs: 'h', pickerHint: 'Desliza o haz clic en el número para escribir',
      min: 'min',
      minimizeOnClose: 'Minimizar al cerrar', autoStart: 'Iniciar timer automáticamente', language: 'Idioma',
      donate: 'Apoyar la app', feedback: 'Reportar fallo o idea 💬',
      acctTitle: 'Cuenta', acctSubtitle: 'Sincronizar entre dispositivos', acctSignInShort: 'Iniciar sesión',
      acctSignIn: 'Iniciar sesión con Google', acctSignOut: 'Cerrar sesión', acctSignInFailed: 'No se pudo iniciar sesión',
      syncSyncing: 'Sincronizando...', syncSynced: 'Sincronizado', syncOffline: 'Sin conexión',
      oauthDoneTitle: 'Sesión iniciada', oauthDoneBody: 'Ya puedes cerrar esta pestaña y volver a Study Pomodoro.',
      themeColor: 'Tema',
      avgPerDay: 'Media/día', total: 'Total', vsPrev: 'vs anterior',
      statistics: 'Estadísticas', week: 'Semana', month: 'Mes', year: 'Año',
      reviewTitle: '¿Te gusta Study Pomodoro?',
      reviewBody: 'Una valoración rápida ayuda mucho a la app. 🙂',
      reviewRate: 'Valorar', reviewLater: 'Más tarde',
      settingsTooltip: 'Ajustes', reportTooltip: 'Estadísticas',
      alarmTooltip: 'Alarma', audioTooltip: 'Audio',
      resetTooltip: 'Reiniciar', timesTooltip: 'Tiempos',
      winMinimize: 'Minimizar', winClose: 'Cerrar', miniEnter: 'Modo mini', miniExit: 'Atrás',
      miniLock: 'Bloquear posición', miniUnlock: 'Desbloquear posición',

      weekdaysMin: ['L','M','X','J','V','S','D'],
      months: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    },
    fr: {
      alarmSchool: 'Bell', alarmRipple: 'Ripple', alarmSpark: 'Spark', alarmLanding: 'Landing',
      alarmCloud: 'Cloud', alarmClassic: 'Classique', alarmVolume: 'Volume de l’alarme', alarmEnabled: 'Alarme activée',
      savedThemes: 'Thèmes enregistrés',
      saveTheme: 'Enregistrer le thème actuel',
      deleteTheme: 'Supprimer le thème sélectionné',
      savedTheme: 'Thème',

      colorSaturation: 'Saturation',
      colorBrightness: 'Luminosité',
      colorHue: 'Teinte',

      muteOnBreak: 'Couper le son en pause',
      continueAfterZero: 'Continuer après 0',
      overtime: 'Temps supplémentaire',
      customTheme: 'Thème personnalisé',
      backgroundColor: 'Fond',

      focus: 'Focus', pause: 'Pause',
      rain: 'Pluie', whiteNoise: 'Bruit Blanc', brownNoise: 'Bruit Brun', vol: 'Vol',
      pure40: 'Pure 40Hz', deepFocus: 'Concentration', binaural: 'Binaural Beats', birds: 'Oiseaux', beach: 'Plage', coffeeShop: 'Café',
      setTime: 'Régler le temps', appSettings: 'Paramètres',
      focusTime: 'Temps de Focus', breakTime: 'Pause', hrs: 'h', pickerHint: 'Faites défiler ou cliquez sur le nombre pour saisir',
      min: 'min',
      minimizeOnClose: 'Minimiser à la fermeture', autoStart: 'Démarrage auto du minuteur', language: 'Langue',
      donate: "Soutenir l'app", feedback: 'Signaler un bug ou une idée 💬',
      acctTitle: 'Compte', acctSubtitle: 'Synchroniser entre appareils', acctSignInShort: 'Se connecter',
      acctSignIn: 'Se connecter avec Google', acctSignOut: 'Se déconnecter', acctSignInFailed: 'Connexion impossible',
      syncSyncing: 'Synchronisation...', syncSynced: 'Synchronisé', syncOffline: 'Hors ligne',
      oauthDoneTitle: 'Vous êtes connecté', oauthDoneBody: 'Vous pouvez fermer cet onglet et revenir à Study Pomodoro.',
      themeColor: 'Thème',
      avgPerDay: 'Moy/jour', total: 'Total', vsPrev: 'vs précédent',
      statistics: 'Statistiques', week: 'Semaine', month: 'Mois', year: 'Année',
      reviewTitle: 'Vous aimez Study Pomodoro ?',
      reviewBody: "Une note rapide aide beaucoup l'app. 🙂",
      reviewRate: 'Noter', reviewLater: 'Plus tard',
      settingsTooltip: 'Paramètres', reportTooltip: 'Statistiques',
      alarmTooltip: 'Alarme', audioTooltip: 'Audio',
      resetTooltip: 'Réinitialiser', timesTooltip: 'Durées',
      winMinimize: 'Réduire', winClose: 'Fermer', miniEnter: 'Mode mini', miniExit: 'Retour',
      miniLock: 'Verrouiller la position', miniUnlock: 'Déverrouiller la position',

      weekdaysMin: ['L','M','M','J','V','S','D'],
      months: ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
    },
    de: {
      alarmSchool: 'Bell', alarmRipple: 'Ripple', alarmSpark: 'Spark', alarmLanding: 'Landing',
      alarmCloud: 'Cloud', alarmClassic: 'Klassisch', alarmVolume: 'Alarmlautstärke', alarmEnabled: 'Alarm aktiviert',
      savedThemes: 'Gespeicherte Designs',
      saveTheme: 'Aktuelles Design speichern',
      deleteTheme: 'Ausgewähltes Design löschen',
      savedTheme: 'Design',

      colorSaturation: 'Sättigung',
      colorBrightness: 'Helligkeit',
      colorHue: 'Farbton',

      muteOnBreak: 'In Pausen stummschalten',
      continueAfterZero: 'Nach 0 weiterzählen',
      overtime: 'Zusatzzeit',
      customTheme: 'Eigenes Design',
      backgroundColor: 'Hintergrund',

      focus: 'Fokus', pause: 'Pause',
      rain: 'Regen', whiteNoise: 'Weißes Rauschen', brownNoise: 'Braunes Rauschen', vol: 'Vol',
      pure40: 'Pure 40Hz', deepFocus: 'Tiefer Fokus', binaural: 'Binaural Beats', birds: 'Vögel', beach: 'Strand', coffeeShop: 'Café',
      setTime: 'Zeit einstellen', appSettings: 'Einstellungen',
      focusTime: 'Fokuszeit', breakTime: 'Pause', hrs: 'Std', pickerHint: 'Scrollen oder auf die Zahl klicken zum Tippen',
      min: 'Min',
      minimizeOnClose: 'Beim Schließen minimieren', autoStart: 'Timer automatisch starten', language: 'Sprache',
      donate: 'App unterstützen', feedback: 'Fehler oder Idee melden 💬',
      acctTitle: 'Konto', acctSubtitle: 'Geräte synchronisieren', acctSignInShort: 'Anmelden',
      acctSignIn: 'Mit Google anmelden', acctSignOut: 'Abmelden', acctSignInFailed: 'Anmeldung fehlgeschlagen',
      syncSyncing: 'Synchronisiere...', syncSynced: 'Synchronisiert', syncOffline: 'Offline',
      oauthDoneTitle: 'Du bist angemeldet', oauthDoneBody: 'Du kannst diesen Tab schließen und zu Study Pomodoro zurückkehren.',
      themeColor: 'Thema',
      avgPerDay: 'Ø/Tag', total: 'Gesamt', vsPrev: 'vs. vorher',
      statistics: 'Statistiken', week: 'Woche', month: 'Monat', year: 'Jahr',
      reviewTitle: 'Gefällt dir Study Pomodoro?',
      reviewBody: 'Eine kurze Bewertung hilft der App sehr. 🙂',
      reviewRate: 'Bewerten', reviewLater: 'Später',
      settingsTooltip: 'Einstellungen', reportTooltip: 'Statistiken',
      alarmTooltip: 'Alarm', audioTooltip: 'Audio',
      resetTooltip: 'Zurücksetzen', timesTooltip: 'Zeiten',
      winMinimize: 'Minimieren', winClose: 'Schließen', miniEnter: 'Mini-Modus', miniExit: 'Zurück',
      miniLock: 'Position sperren', miniUnlock: 'Position entsperren',

      weekdaysMin: ['M','D','M','D','F','S','S'],
      months: ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
    },
    it: {
      alarmSchool: 'Bell', alarmRipple: 'Ripple', alarmSpark: 'Spark', alarmLanding: 'Landing',
      alarmCloud: 'Cloud', alarmClassic: 'Classico', alarmVolume: 'Volume della sveglia', alarmEnabled: 'Sveglia attivata',
      savedThemes: 'Temi salvati',
      saveTheme: 'Salva il tema attuale',
      deleteTheme: 'Elimina il tema selezionato',
      savedTheme: 'Tema',

      colorSaturation: 'Saturazione',
      colorBrightness: 'Luminosità',
      colorHue: 'Tonalità',

      muteOnBreak: 'Silenzia nelle pause',
      continueAfterZero: 'Continua dopo lo 0',
      overtime: 'Tempo extra',
      customTheme: 'Tema personalizzato',
      backgroundColor: 'Sfondo',

      focus: 'Focus', pause: 'Pausa',
      rain: 'Pioggia', whiteNoise: 'Rumore Bianco', brownNoise: 'Rumore Marrone', vol: 'Vol',
      pure40: 'Pure 40Hz', deepFocus: 'Concentrazione', binaural: 'Binaural Beats', birds: 'Uccelli', beach: 'Spiaggia', coffeeShop: 'Caffè',
      setTime: 'Imposta tempo', appSettings: 'Impostazioni',
      focusTime: 'Tempo di Focus', breakTime: 'Pausa', hrs: 'h', pickerHint: 'Scorri o clicca sul numero per digitare',
      min: 'min',
      minimizeOnClose: 'Minimizza alla chiusura', autoStart: 'Avviare il timer automaticamente', language: 'Lingua',
      donate: "Sostieni l'app", feedback: 'Segnala bug o idea 💬',
      acctTitle: 'Account', acctSubtitle: 'Sincronizza tra dispositivi', acctSignInShort: 'Accedi',
      acctSignIn: 'Accedi con Google', acctSignOut: 'Esci', acctSignInFailed: 'Accesso non riuscito',
      syncSyncing: 'Sincronizzazione...', syncSynced: 'Sincronizzato', syncOffline: 'Offline',
      oauthDoneTitle: 'Accesso effettuato', oauthDoneBody: 'Puoi chiudere questa scheda e tornare a Study Pomodoro.',
      themeColor: 'Tema',
      avgPerDay: 'Media/giorno', total: 'Totale', vsPrev: 'vs precedente',
      statistics: 'Statistiche', week: 'Settimana', month: 'Mese', year: 'Anno',
      reviewTitle: 'Ti piace Study Pomodoro?',
      reviewBody: "Una valutazione rapida aiuta molto l'app. 🙂",
      reviewRate: 'Valuta', reviewLater: 'Più tardi',
      settingsTooltip: 'Impostazioni', reportTooltip: 'Statistiche',
      alarmTooltip: 'Allarme', audioTooltip: 'Audio',
      resetTooltip: 'Ripristina', timesTooltip: 'Tempi',
      winMinimize: 'Riduci', winClose: 'Chiudi', miniEnter: 'Modalità mini', miniExit: 'Indietro',
      miniLock: 'Blocca posizione', miniUnlock: 'Sblocca posizione',

      weekdaysMin: ['L','M','M','G','V','S','D'],
      months: ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
    }
  };
  let current = 'en';
  function t(key) {
    return LANGS[current][key] || LANGS.en[key] || key;
  }
  // Apply every static string declared in the markup. Adding a new translated
  // label is just a data-i18n attribute in the HTML - no code change here.
  function apply() {
    document.documentElement.lang = current;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });
  }
  // listeners notified when the language changes, so JS-rendered strings (e.g. the
  // sync status, which isn't a static data-i18n element) can re-translate too.
  const listeners = [];
  App.i18n = {
    t,
    apply,
    onChange(fn) { listeners.push(fn); },
    get current() { return current; },
    set(lang) {
      if (!LANGS[lang]) return;
      current = lang;
      apply();
      listeners.forEach(fn => { try { fn(); } catch (e) {} });
    }
  };
})(window.App = window.App || {});
