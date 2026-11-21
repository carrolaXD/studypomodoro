// Copyright (c) 2026 Pedro Carrola (By Carrola). All rights reserved.
// Proprietary software - see LICENSE. Unauthorized use, copying or distribution is prohibited.

// ==================== PREFS ====================
// Preferences live in this document until reload.
(function (App) {
  'use strict';

  const preferences = {
    focus: 25, short: 5,
    sound: null, volume: 50, alarm: true,
    alarmSound: 'classic', alarmVolume: null,
    autoStart: false,
    muteOnBreak: true, continueAfterZero: false,
    customColors: null, customThemes: [], activeCustomTheme: null,
    theme: 'dark', accent: 0, // theme: 'dark'|'light'; accent: index into ACCENTS palette
    miniLocked: false, // when true, the mini widget can't be dragged
    statsView: 'month', // last-used stats period view: 'week' | 'month' | 'year'
  };

  App.prefs = {
    get(key) { return preferences[key]; },
    set(key, value) { preferences[key] = value; }
  };
})(window.App = window.App || {});
