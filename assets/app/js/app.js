// Copyright (c) 2026 Pedro Carrola (By Carrola). All rights reserved.
// Proprietary software - see LICENSE. Unauthorized use, copying or distribution is prohibited.

// ==================== APP / UI GLUE ====================
// DOM wiring and rendering. render() is split in two: renderTime() runs every
// tick and only touches what changes each second (ring, handle, time text,
// window title); renderState() runs only on state changes and updates the
// play/pause icon, mode classes and labels. This keeps the per-second path
// cheap (no SVG re-parsing every tick like before).
(function (App) {
  'use strict';

  const $ = id => document.getElementById(id);

  // --- geometry ---
  const R = 130, CX = 150, CY = 150;
  const CIRC = 2 * Math.PI * R;
  const FOCUS_MAX = 599;       // 9:59, matching the cyclic hours/minutes wheels
  const BREAK_MAX = 599;       // same range for focus and break

  // --- element refs ---
  const ring = $('ringProgress'), handle = $('sliderHandle'), track = $('ringTrack');
  const svg = $('timerSvg');
  const timeText = $('timeText'), timeLabel = $('timeLabel'), playIcon = $('playIcon');
  const bgAmbient = $('bgAmbient');
  const miniTime = $('miniTime'), miniPlayIcon = $('miniPlayIcon'), miniFill = $('miniProgressFill');
  const miniLockIcon = $('miniLockIcon');

  const PLAY_ICON = '<polygon points="6,3 20,12 6,21"/>';
  const PAUSE_ICON = '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>';
  const LOCK_OPEN = '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>';
  const LOCK_CLOSED = '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';

  // The selected tab ("view") is decoupled from the running timer. Switching tabs
  // only changes what is shown: a running timer keeps counting underneath, and the
  // other mode is shown idle at its set duration. Pressing play on the viewed mode
  // starts it (ending whatever was running). viewMode = which tab is on screen.
  let viewMode = App.timer.mode;
  // When a phase auto-advances at 00:00, make the view follow into the next phase.
  let followSwitch = false;
  // True when the on-screen tab is the one actually running.
  function viewIsActive() { return App.timer.mode === viewMode; }

  // ==================== THEME ====================
  // Curated accent palette: each entry is {a: focus accent, b: break accent},
  // chosen to read well on both the dark and light backgrounds. Index 0 is the
  // original look. Applied as inline CSS vars on <html> so it wins over :root
  // and the light-theme block.
  // 4 curated focus/break pairs (a = focus accent, b = break accent). Each is a
  // warm, energetic focus hue paired with a cool, calming break hue, all from the
  // same vivid mid-tone family so they read well on BOTH the near-black dark bg
  // and the bright iOS-style light bg. Index 0 (coral/sky = red/blue) is the
  // default. Each pair is offered on both themes → 8 circles total (4 dark, 4 light).
  const ACCENTS = [
    { a: '#ff6b6b', b: '#6bcfff' }, // red / blue    - DEFAULT
    { a: '#34c759', b: '#ff5252' }, // green / red
    { a: '#ff9500', b: '#3b82f6' }, // orange / blue
    { a: '#f472b6', b: '#a855f7' }  // pink / purple
  ];

  // Top-half colour of each theme circle. Pure black/white (NOT the panel surface
  // colour) so the top half never blends into the settings panel background.
  const THEME_COLORS = { dark: '#000000', light: '#ffffff' };

  function hexToRgba(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  // Apply the persisted theme + accent. Called on launch and whenever a setting
  // changes - every choice auto-saves, so this always reflects the saved prefs.
  function applyTheme() {
    const root = document.documentElement;
    const custom = App.prefs.get('customColors');
    const valid = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
    const bg = custom && valid(custom.background) ? custom.background : null;
    const light = bg && (0.2126 * parseInt(bg.slice(1, 3), 16) + 0.7152 * parseInt(bg.slice(3, 5), 16) + 0.0722 * parseInt(bg.slice(5, 7), 16) > 160);
    const theme = bg ? (light ? 'light' : 'dark') : App.prefs.get('theme') === 'light' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    const palette = ACCENTS[App.prefs.get('accent')] || ACCENTS[0];
    const c = { a: custom && valid(custom.focus) ? custom.focus : palette.a,
      b: custom && valid(custom.break) ? custom.break : palette.b };
    if (bg) root.style.setProperty('--bg', bg);
    else root.style.removeProperty('--bg');
    if ($('colorFocus')) {
      $('colorFocus').value = c.a;
      $('colorBreak').value = c.b;
      $('colorBackground').value = bg || (theme === 'light' ? '#f2f2f7' : '#0f0f13');
    }
    root.style.setProperty('--accent', c.a);
    root.style.setProperty('--accent-glow', hexToRgba(c.a, 0.25));
    root.style.setProperty('--break-accent', c.b);
    root.style.setProperty('--break-glow', hexToRgba(c.b, 0.25));
    if (App.appearance) App.appearance.refresh();
  }

  // Highlight the circle matching the saved theme + accent (no-op if none match,
  // e.g. a legacy accent index that no longer exists).
  function setActiveSwatch() {
    const theme = App.prefs.get('theme'), accent = App.prefs.get('accent');
    document.querySelectorAll('#accentSwatches .accent-swatch').forEach(s => {
      s.classList.toggle('active', !App.prefs.get('customColors') && s.dataset.theme === theme && Number(s.dataset.idx) === accent);
    });
  }

  function buildSwatches() {
    // legacy migration: old builds had up to 7 accents - clamp into the new range
    if (App.prefs.get('accent') >= ACCENTS.length) App.prefs.set('accent', 0);
    const wrap = $('accentSwatches');
    wrap.innerHTML = '';
    // Row 1 = dark themes, row 2 = light themes (grid fills row-wise).
    ['dark', 'light'].forEach(theme => {
      const th = THEME_COLORS[theme];
      ACCENTS.forEach((c, i) => {
        const b = document.createElement('button');
        b.className = 'accent-swatch';
        // SVG: a clip circle gives a smooth antialiased outer edge. To stop the middle
        // split being the one razor-sharp line in the swatch, the colours are painted
        // first and the theme rect is drawn on top, ending at y=14.5 - a fractional
        // coordinate, so its lower edge gets antialiased (soft) instead of crisp. The
        // overlap also means no hairline seam, and the boundary sits a touch below
        // centre so the colour half never reads as the larger one. viewBox matches the
        // 28px size 1:1. Top half = theme, bottom-left = focus (c.a), bottom-right = break (c.b).
        const id = 'sw-' + theme + '-' + i;
        b.innerHTML =
          '<svg class="sw-svg" viewBox="0 0 28 28" aria-hidden="true">' +
            '<defs><clipPath id="' + id + '"><circle cx="14" cy="14" r="14"/></clipPath></defs>' +
            '<g clip-path="url(#' + id + ')">' +
              '<rect x="0" y="14" width="14" height="14" fill="' + c.a + '"/>' +
              '<rect x="14" y="14" width="14" height="14" fill="' + c.b + '"/>' +
              '<rect x="0" y="0" width="28" height="14.5" fill="' + th + '"/>' +
            '</g>' +
          '</svg>';
        b.dataset.theme = theme;
        b.dataset.idx = String(i);
        // One click sets BOTH theme and colour, and auto-saves.
        b.addEventListener('click', () => {
          App.prefs.set('activeCustomTheme', null);
          App.prefs.set('customColors', null);
          App.prefs.set('theme', theme);
          App.prefs.set('accent', i);
          applyTheme();
          setActiveSwatch();
        });
        wrap.appendChild(b);
      });
    });
    setActiveSwatch();
  }

  // H:MM:SS from one hour, MM:SS below; shared by both timer views.
  function fmt(s) {
    if (s >= 3600) {
      return Math.floor(s / 3600) + ':' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function posHandle(frac) {
    const a = frac * 2 * Math.PI - Math.PI / 2;
    handle.setAttribute('cx', CX + R * Math.cos(a));
    handle.setAttribute('cy', CY + R * Math.sin(a));
  }

  // The arc maps one full circle to 60 minutes: above 60 min remaining it stays
  // full, and only the last hour counts down normally. The white handle sits at
  // the chosen-time position and then descends as it counts. Idle and running use
  // the same formula (remainSec === the selected duration while idle), so pressing
  // play causes no jump.
  let lastRenderKey = '';
  function renderTime() {
    // The big ring + digits follow the on-screen tab (the "view"). When the view is
    // the other mode while a timer runs, that mode shows idle at its set duration;
    // the running timer keeps counting and is shown again on its own tab.
    const rs = viewIsActive() ? App.timer.remainSec : App.timer.durations[viewMode] * 60;
    // tick() fires every 250 ms for a prompt 00:00, but everything drawn here is a
    // pure function of these integer-second values - so 3 of every 4 ticks would
    // redraw the exact same thing. Skip those: rebuild only when a value actually
    // changes (countdown second, slider drag, tab switch). Any real change alters
    // the key and falls through; the first call (key '') always renders.
    const renderKey = rs + '|' + App.timer.remainSec + '|' + App.timer.totalSec + '|' + App.timer.overtime + '|' + viewMode;
    if (renderKey === lastRenderKey) return;
    lastRenderKey = renderKey;
    const extra = viewIsActive() && App.timer.overtime;
    document.body.classList.toggle('overtime', extra);
    timeLabel.textContent = extra ? App.i18n.t('overtime') : App.i18n.t(viewMode === 'focus' ? 'focus' : 'pause');
    const arcF = extra ? Math.min(Math.abs(rs), 3599) / 3600 : Math.min(rs, 3600) / 3600;   // ring: fills the last hour, full above it
    const handleF = (Math.abs(rs) % 3600) / 3600;        // white handle: laps around (= arcF in the last hour)
    ring.setAttribute('stroke-dashoffset', CIRC - CIRC * arcF);
    ring.setAttribute('transform', extra ? 'rotate(-90 150 150) translate(0 300) scale(1 -1)' : 'rotate(-90 150 150)');
    posHandle(handleF);
    const txt = (extra ? '+' : '') + fmt(Math.abs(rs));
    // Poppins has no tabular figures, so its digits vary in width ('1' is ~half
    // of '6'). Render each digit in a fixed-width slot so the line width stays
    // constant and the colon never shifts as the time ticks (same as the mini).
    let th = '';
    for (let i = 0; i < txt.length; i++) {
      const c = txt[i];
      th += c === ':' ? '<span class="tt-c">:</span>' : '<span class="tt-d">' + c + '</span>';
    }
    timeText.innerHTML = th;
    timeText.classList.toggle('long-time', txt.length > 7);
    // The Mini Mode recording uses the active timer independently of the current tab.
    const aRs = App.timer.remainSec;
    const aTxt = (App.timer.overtime ? '+' : '') + fmt(Math.abs(aRs));
    if (miniTime) {
      let h = '';
      for (let i = 0; i < aTxt.length; i++) {
        const c = aTxt[i];
        h += c === ':' ? '<span class="mt-c">:</span>' : '<span class="mt-d">' + c + '</span>';
      }
      miniTime.innerHTML = h;
      miniTime.classList.toggle('long-time', aTxt.length > 6);
      miniTime.classList.toggle('overtime-time', App.timer.overtime);
      miniTime.title = App.timer.overtime ? App.i18n.t('overtime') : '';
      miniTime.setAttribute('aria-label', (App.timer.overtime ? App.i18n.t('overtime') + ' ' : '') + aTxt);
    }
    if (miniFill) {
      const elapsed = App.timer.overtime ? Math.abs(aRs) / 3600 : App.timer.totalSec ? 1 - aRs / App.timer.totalSec : 0;
      miniFill.classList.toggle('overtime-progress', App.timer.overtime);
      miniFill.style.width = Math.max(0, Math.min(1, elapsed)) * 100 + '%';
    }
  }

  // On state change: icon, mode classes/labels, then the time.
  function renderState(action) {
    if (action === 'limit' || action === 'overtime-end') {
      viewMode = App.timer.mode; followSwitch = action === 'limit';
    }
    // When a completed phase auto-advanced, follow it into the new mode.
    if (followSwitch && App.timer.mode !== viewMode) { viewMode = App.timer.mode; followSwitch = false; }
    const tm = App.timer;
    document.body.classList.toggle('timer-paused', !tm.running);
    const focusEnded = tm.mode === 'focus' && tm.remainSec === 0 && !tm.overtime;
    const mute = App.prefs.get('muteOnBreak') && (tm.paused || tm.mode === 'short' || focusEnded);
    const fade = ['start', 'mode', 'complete', 'overtime-end'].includes(action) ? 0.75 : 0.35;
    App.audio.setAmbientMuted(mute, fade);
    // The on-screen ring is "running" only when the viewed tab is the live one.
    const viewRunning = viewIsActive() && tm.running;
    $('btnPlay').setAttribute('aria-label', viewRunning ? 'Pause timer' : tm.paused && viewIsActive() ? 'Resume timer' : 'Start timer');
    playIcon.innerHTML = viewRunning ? PAUSE_ICON : PLAY_ICON;
    document.body.classList.toggle('break-mode', viewMode === 'short');
    bgAmbient.classList.toggle('running', viewRunning);
    timeLabel.textContent = viewIsActive() && tm.overtime ? App.i18n.t('overtime') : App.i18n.t(viewMode === 'focus' ? 'focus' : 'pause');
    document.querySelectorAll('.mode-tab').forEach(el =>
      el.classList.toggle('active', el.dataset.mode === viewMode));
    // The mini widget shows the live timer regardless of the desktop view.
    if (miniPlayIcon) miniPlayIcon.innerHTML = tm.running ? PAUSE_ICON : PLAY_ICON;
    renderTime();
  }

  // ==================== TASKBAR + MINI WIDGET ====================
  // A phase is "active" while running or manually paused; a fresh/just-
  // reset phase is idle and clears the taskbar progress + overlay dot.
  function sessionActive() {
    const tm = App.timer;
    return tm.running || tm.paused || tm.remainSec < tm.totalSec;
  }

  // Mini Mode renders its original UI during recording.
  let miniMode = false;
  function enterMini() {
    if (miniMode) return;
    if (!App.timer.running && !viewIsActive()) App.timer.switchMode(viewMode);
    miniMode = true;
    viewMode = App.timer.mode;   // the mini shows the live timer; keep the view in sync
    followSwitch = false;
    document.body.classList.add('mini-mode');
    renderState();
  }
  function exitMini() {
    if (!miniMode) return;
    miniMode = false;
    document.body.classList.remove('mini-mode');
  }

  // Lock the mini widget in place: dropping the bar's drag region (via the
  // .locked class) stops the window being dragged. State persists in prefs.
  let miniLocked = false;
  function applyLock() {
    const bar = $('miniBar');
    if (bar) bar.classList.toggle('locked', miniLocked);
    const btn = $('btnMiniLock');
    if (btn) {
      btn.classList.toggle('active', miniLocked);
      btn.dataset.i18nTitle = miniLocked ? 'miniUnlock' : 'miniLock';
      btn.title = App.i18n.t(miniLocked ? 'miniUnlock' : 'miniLock');
    }
    if (miniLockIcon) miniLockIcon.innerHTML = miniLocked ? LOCK_CLOSED : LOCK_OPEN;
  }

  // ==================== CIRCULAR SLIDER (multi-turn dial) ====================
  // The handle follows the pointer around the ring (absolute position). Crossing
  // the top (12 o'clock) moves between hour-laps, so the time can go past 60 min
  // without the ring resetting: above 60 the ring stays full and only the handle
  // keeps going around.
  let dragging = false, lap = 0, prevFrac = 0;

  function ptrFrac(e) { // 0..1 clockwise from the top
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const px = e.touches ? e.touches[0].clientX : e.clientX;
    const py = e.touches ? e.touches[0].clientY : e.clientY;
    const n = (Math.atan2(py - cy, px - cx) + Math.PI / 2) / (2 * Math.PI);
    return ((n % 1) + 1) % 1;
  }
  function startDrag(e) {
    if (viewIsActive() && (App.timer.running || App.timer.overtime)) return;   // live and overtime arcs cannot be scrubbed
    dragging = true;
    prevFrac = ptrFrac(e);
    // Pick the hour-lap that reads the grab point as the time CLOSEST to the
    // current duration. floor(duration/60) broke at exact hours (1:00, 2:00...):
    // the handle sits right on the 12 o'clock lap boundary, and a grab landing a
    // hair to the LEFT of the top reads as frac≈0.999 - combined with lap=1 that
    // meant ~1:59.9, so a tiny tap jumped the timer a whole hour (1:00 → 2:00).
    lap = Math.round(App.timer.durations[viewMode] / 60 - prevFrac);
    doDrag(e);
  }
  function doDrag(e) {
    if (!dragging) return;
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const px = e.touches ? e.touches[0].clientX : e.clientX;
    const py = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = px - cx, dy = py - cy;
    // if the pointer leaves the band around the ring, end the drag entirely - the
    // user has to press the handle again to keep adjusting (instead of it rotating
    // while the cursor is far away)
    const ringPx = rect.width / 2 * (130 / 150);
    if (Math.abs(Math.hypot(dx, dy) - ringPx) > rect.width * 0.22) { endDrag(); return; }
    const a = (Math.atan2(dy, dx) + Math.PI / 2) / (2 * Math.PI);
    const f = ((a % 1) + 1) % 1;
    if (prevFrac > 0.75 && f < 0.25) lap++;       // crossed the top clockwise -> next hour
    else if (prevFrac < 0.25 && f > 0.75) lap--;  // crossed back -> previous hour
    prevFrac = f;
    const maxMin = viewMode === 'focus' ? FOCUS_MAX : BREAK_MAX;
    // Allow one lap below 0 / above the max so crossing the top at the limits
    // stays clamped (e.g. dragging left at 00:01 holds at 1 min instead of
    // wrapping up to ~60), rather than jumping to the other end.
    lap = Math.max(-1, Math.min(Math.floor(maxMin / 60) + 1, lap));
    const mins = Math.max(1, Math.min(maxMin, Math.round((lap + f) * 60)));
    App.timer.setDuration(mins, viewMode);
  }
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    App.prefs.set('focus', App.timer.durations.focus);
    App.prefs.set('short', App.timer.durations.short);
    renderTime();
  }

  // ==================== AUDIO UI ====================
  function updateAudioUI() {
    const cur = App.audio.current;
    document.querySelectorAll('.audio-option').forEach(o =>
      o.classList.toggle('active', o.dataset.sound === cur));
    $('audioToggle').classList.toggle('active', cur !== null);
  }

  let dropdownOpen = false;

  // ==================== OVERLAYS ====================
  function closeOnBackdrop(overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  }

  // ==================== APP SETTINGS STATE ====================

  // Big play/pause action, shared by the main button, the mini button and the
  // spacebar. If a different mode is armed while running, starting "commits" it:
  // end the current run (crediting its focus time) and start the armed mode.
  // Otherwise it's the normal start/pause toggle.
  function playAction() {
    if (viewIsActive()) {
      App.timer.toggle();             // start/pause the timer on the viewed tab
    } else {
      // Start the mode being viewed; this ends whatever was running underneath.
      followSwitch = false;
      App.timer.pause();              // stop the other run
      App.timer.switchMode(viewMode); // load the viewed mode's duration
      App.timer.start();              // and start it
    }
  }

  function onPhaseComplete() {
    viewMode = App.timer.mode;
    followSwitch = !App.timer.overtime;
    renderState('complete');
  }

  const { build: buildWheel, set: setWheel, value: wheelVal } = App.wheels;

  // ==================== INIT ====================
  function init() {
    ring.setAttribute('stroke-dasharray', CIRC);
    App.timer.init({ onTick: renderTime, onState: renderState, onComplete: onPhaseComplete });

    // --- restore persisted settings ---
    const P = App.prefs;
    App.timer.setDurations(P.get('focus'), P.get('short'));
    App.timer.autoStart = P.get('autoStart');
    App.timer.continueAfterZero = P.get('continueAfterZero');
    App.audio.setVolume(P.get('volume'));
    $('volSlider').value = P.get('volume');
    applyTheme();      // restore saved theme + accent (also syncs the titlebar)
    buildSwatches();   // accent colour picker in app settings
    App.appearance.init({ refreshTheme: () => { applyTheme(); setActiveSwatch(); }, renderState });
    // ambient sound choice is remembered in prefs but intentionally NOT
    // auto-played on launch (avoids surprising the user with sound).

    // transport
    $('btnPlay').onclick = playAction;
    $('btnReset').onclick = () => {
      if (!viewIsActive()) return;   // nothing to reset on an idle, not-running view
      App.timer.reset();
      const btn = $('btnReset');
      btn.classList.remove('resetting');
      void btn.offsetWidth; // restart the animation
      btn.classList.add('resetting');
      setTimeout(() => btn.classList.remove('resetting'), 550);
    };

    // Recordings can enable this control in their own viewport.
    $('btnMiniEnter').onclick = enterMini;
    $('btnMiniBack').onclick = exitMini;
    $('btnMiniPlay').onclick = playAction;
    miniLocked = App.prefs.get('miniLocked');
    $('btnMiniLock').onclick = () => {
      miniLocked = !miniLocked;
      App.prefs.set('miniLocked', miniLocked);
      applyLock();
    };
    applyLock();

    // mode tabs only change the VIEW. A timer running underneath keeps counting;
    // the other tab is shown idle at its set duration. Pressing play on the viewed
    // tab starts it (see playAction). This is why switching to Break and back never
    // resets a focus run - it was only ever a view change.
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const m = tab.dataset.mode;
        if (m === viewMode) return;
        followSwitch = false;     // a manual switch overrides any pending auto-follow
        viewMode = m;
        renderState();
      });
    });

    // slider
    track.addEventListener('mousedown', startDrag);
    handle.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', endDrag);
    track.addEventListener('touchstart', startDrag, { passive: false });
    handle.addEventListener('touchstart', startDrag, { passive: false });
    window.addEventListener('touchmove', doDrag, { passive: false });
    window.addEventListener('touchend', endDrag);

    App.alarmMenu.init({ closeAmbient: () => {
      dropdownOpen = false;
      $('audioDropdown').classList.remove('open');
    } });

    // ambient audio - build the option list from the audio manifest
    const audioOptions = $('audioOptions');
    App.audio.ambient.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'audio-option';
      btn.dataset.sound = s.id;
      btn.disabled = true;                 // enabled once the file is confirmed
      btn.innerHTML = '<span data-i18n="' + s.label + '"></span><div class="check"></div>';
      btn.addEventListener('click', () => {
        App.audio.toggleSound(s.id);
        App.prefs.set('sound', App.audio.current);
        updateAudioUI();
      });
      audioOptions.appendChild(btn);
    });
    App.i18n.apply();                      // translate the generated labels
    App.audio.onAvailability = (id, ok) => {
      const b = audioOptions.querySelector('[data-sound="' + id + '"]');
      if (b) { b.disabled = !ok; b.classList.toggle('unavailable', !ok); }
      updateAudioUI();
    };
    $('volSlider').oninput = () => App.audio.setVolume(parseInt($('volSlider').value, 10));
    $('volSlider').onchange = () => App.prefs.set('volume', App.audio.volume);
    $('setMuteOnBreak').checked = App.prefs.get('muteOnBreak');
    $('audioToggle').onclick = () => {
      App.alarmMenu.close();
      $('setMuteOnBreak').checked = App.prefs.get('muteOnBreak');
      dropdownOpen = !dropdownOpen;
      $('audioDropdown').classList.toggle('open', dropdownOpen);
    };
    document.addEventListener('click', e => {
      if (dropdownOpen && !$('audioWrap').contains(e.target)) {
        dropdownOpen = false;
        $('audioDropdown').classList.remove('open');
      }
    });

    window.addEventListener('pomodoro:silence', () => {
      App.audio.silence();
      updateAudioUI();
    });

    // timer settings - the wheels auto-apply on every settle (no Save/Cancel;
    // the panel closes via the corner ✕ or a backdrop click, like app settings)
    function applyTimes() {
      const focusMin = wheelVal($('wheelFocusH')) * 60 + wheelVal($('wheelFocusM'));
      const shortMin = wheelVal($('wheelShortH')) * 60 + wheelVal($('wheelShortM'));
      App.timer.setDurations(focusMin, shortMin);
      App.prefs.set('focus', App.timer.durations.focus);
      App.prefs.set('short', App.timer.durations.short);
    }
    ['wheelFocusH', 'wheelFocusM', 'wheelShortH', 'wheelShortM'].forEach(id => {
      buildWheel($(id));
      $(id)._onChange = applyTimes;
    });
    $('btnSettings').onclick = () => {
      $('setAutoStart').checked = App.timer.autoStart;
      $('setContinueAfterZero').checked = App.timer.continueAfterZero;
      const f = App.timer.durations.focus;
      const s = App.timer.durations.short;
      $('settingsOverlay').classList.add('open');
      requestAnimationFrame(() => {
        setWheel($('wheelFocusH'), Math.floor(f / 60), false);
        setWheel($('wheelFocusM'), f % 60, false);
        setWheel($('wheelShortH'), Math.floor(s / 60), false);
        setWheel($('wheelShortM'), s % 60, false);
      });
    };
    $('btnCloseSettings').onclick = () => $('settingsOverlay').classList.remove('open');
    closeOnBackdrop($('settingsOverlay'));

    // app settings - every control auto-saves on change. The panel just closes
    // via the corner ✕ or a backdrop click; there is no Save/Cancel step.
    $('btnSettingsTop').onclick = () => {
      App.appearance.refresh();
      setActiveSwatch();
      $('appSettingsOverlay').classList.add('open');
    };
    $('setAutoStart').onchange = () => {
      App.timer.autoStart = $('setAutoStart').checked;
      App.prefs.set('autoStart', App.timer.autoStart);
    };
    $('setMuteOnBreak').onchange = () => {
      App.prefs.set('muteOnBreak', $('setMuteOnBreak').checked);
      renderState();
    };
    $('setContinueAfterZero').onchange = () => {
      App.timer.continueAfterZero = $('setContinueAfterZero').checked;
      App.prefs.set('continueAfterZero', App.timer.continueAfterZero);
    };
    $('btnCloseAppSettings').onclick = () => $('appSettingsOverlay').classList.remove('open');
    closeOnBackdrop($('appSettingsOverlay'));

    $('btnDonate').onclick = () => window.open('https://ko-fi.com/ByCarrola', '_blank', 'noopener,noreferrer');
    $('btnFeedback').onclick = () => {
      if (window.parent === window) { window.location.href = '../../#feedback'; return; }
      window.parent.location.hash = 'feedback';
      window.parent.document.getElementById('feedback')?.scrollIntoView();
    };

    // report (statistics): open, close, view switch, prev/next navigation
    $('btnReport').onclick = () => {
      App.stats.renderReport();
      $('reportOverlay').classList.add('open');
    };
    $('btnCloseReport').onclick = () => $('reportOverlay').classList.remove('open');
    document.querySelectorAll('#statsViews .stats-view-btn').forEach(btn =>
      btn.addEventListener('click', () => App.stats.setView(btn.dataset.view)));
    $('statsPrev').onclick = () => App.stats.nav(-1);
    $('statsNext').onclick = () => App.stats.nav(1);
    closeOnBackdrop($('reportOverlay'));

    // keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.target.closest('input, button, a, [role=listbox]')) return;
      // Ignore timer shortcuts while a modal
      // is open, so e.g. Space doesn't toggle the timer behind the dialog.
      if (document.querySelector('.settings-overlay.open')) return;
      if (e.code === 'Space') { e.preventDefault(); playAction(); }
      // bare R only - Ctrl+R is the reload reflex and must not reset the timer
      if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey && !e.altKey) { $('btnReset').click(); }
    });

    App.i18n.apply();
    renderState();
  }

  init();
})(window.App = window.App || {});
