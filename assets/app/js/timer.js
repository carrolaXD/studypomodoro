// Copyright (c) 2026 Pedro Carrola (By Carrola). All rights reserved.
// Proprietary software - see LICENSE. Unauthorized use, copying or distribution is prohibited.

// ==================== TIMER ====================
// Clock-based countdown. remainSec is recomputed from wall-clock time on every
// tick, so the timer stays accurate even when the renderer is throttled in the
// background (minimized to tray) - the old tick-counting approach ran slow
// there.
(function (App) {
  'use strict';

  const t = {
    durations: { focus: 25, short: 5 },
    mode: 'focus',
    totalSec: 25 * 60,
    remainSec: 25 * 60,
    running: false,
    paused: false,
    autoStart: false,
    continueAfterZero: false,
    overtime: false
  };

  let holdId = null;
  function cancelHold() { clearTimeout(holdId); holdId = null; }

  let endTime = 0;       // Date.now() at which the countdown reaches 0
  let intervalId = null;
  let bellFired = false; // one ring per run, including overtime
  let onTick = () => {};
  let onState = () => {};
  let onComplete = () => {}; // called with the mode that just finished

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, parseInt(v, 10) || lo));

  const OVERTIME_MAX_SEC = 59 * 60 + 59;

  function syncRemain(now) {
    const left = Math.round((endTime - now) / 1000);
    t.remainSec = t.overtime ? Math.max(-OVERTIME_MAX_SEC, Math.min(0, left)) : Math.max(0, left);
  }

  function tick() {
    const now = Date.now();
    const effectiveNow = t.overtime ? Math.min(now, endTime + OVERTIME_MAX_SEC * 1000) : now;
    syncRemain(effectiveNow);
    if (t.overtime && now >= endTime + OVERTIME_MAX_SEC * 1000) {
      clearInterval(intervalId); intervalId = null;
      t.running = false;
      onState('limit');
      scheduleNext(t.mode, -OVERTIME_MAX_SEC);
      return;
    }
    // Use the selected clip's lead: trimming the Classic's initial silence
    // must not shift its audible notes 0.4s earlier. Completion stays at 00:00.
    if (!bellFired && endTime - now <= (App.audio.bellLeadMs ?? 850)) { bellFired = true; App.audio.bell(); }
    // Complete essentially AT 00:00. Ticks land on 250 ms multiples of endTime, so a
    // tick sits right on zero; a small margin (well under one tick) catches that
    // tick without the previous one (~250 ms out) pre-firing.
    if (!t.overtime && endTime - now <= 150) { complete(); return; }
    onTick();
  }

  // Hold on 00:00 (with the bell) for a moment before moving to the next phase,
  // so the chime lands exactly at 00:00 rather than after the switch.
  const END_HOLD_MS = 1000;
  function complete() {
    t.remainSec = 0;
    const keepGoing = t.continueAfterZero && t.mode === 'focus';
    t.overtime = keepGoing;
    if (!keepGoing) {
      clearInterval(intervalId); intervalId = null;
      t.running = false;
    }
    onTick();                 // render 00:00
    // The bell normally rings shortly before zero in tick(); ring here only as a fallback
    // (e.g. a tick never landed inside that 0.85s window).
    if (!bellFired) { bellFired = true; App.audio.bell(); }
    const finished = t.mode;  // mode that just ended
    onComplete(finished);     // update the display at 00:00
    if (keepGoing) return;
    scheduleNext(finished, 0);
  }

  function scheduleNext(finished, remaining) {
    holdId = setTimeout(() => {
      holdId = null;
      if (t.running || t.mode !== finished || t.remainSec !== remaining) return;
      switchMode(finished === 'focus' ? 'short' : 'focus');
      if (t.autoStart) start();
      else App.audio.releaseIfIdle();
    }, END_HOLD_MS);
  }

  function start() {
    if (t.running || (t.remainSec <= 0 && !t.overtime)) return;
    cancelHold();
    const action = t.paused ? 'resume' : 'start';
    t.running = true;
    t.paused = false;
    if (!t.overtime) bellFired = false;         // arm the bell for this run
    App.audio.preloadBell();   // decode the bell now so it fires instantly
    const now = Date.now();
    endTime = now + t.remainSec * 1000;
    intervalId = setInterval(tick, 250);   // finer cadence so completion is prompt
    onState(action);
  }

  function pause() {
    if (!t.running) return;
    const now = Date.now();
    const effectiveNow = t.overtime ? Math.min(now, endTime + OVERTIME_MAX_SEC * 1000) : now;
    syncRemain(effectiveNow);
    t.running = false;
    t.paused = true;
    clearInterval(intervalId); intervalId = null;
    if (t.overtime) { switchMode('short', 'overtime-end'); return; }
    App.audio.releaseIfIdle();   // free the audio graph if nothing is playing
    onState();
  }

  function toggle() { t.running ? pause() : start(); }

  function reset() {
    cancelHold();
    t.paused = false;
    t.overtime = false;
    clearInterval(intervalId); intervalId = null;
    t.running = false;
    t.remainSec = t.totalSec;
    App.audio.releaseIfIdle();   // free the audio graph if nothing is playing
    onState();
  }

  function switchMode(m, action = 'mode') {
    cancelHold();
    t.paused = false;
    t.overtime = false;
    t.mode = m;
    t.totalSec = t.durations[m] * 60;
    t.remainSec = t.totalSec;
    onState(action);
  }

  // Circular slider drag. Adjusts a given mode's duration (defaults to the active
  // mode). Only touches the live total/remaining when adjusting the active mode
  // while stopped - so dragging the idle "other" mode (shown when its tab is being
  // viewed) never disturbs a timer running underneath. Hot path -> onTick.
  function setDuration(min, mode) {
    mode = mode || t.mode;
    const max = 599;
    min = clamp(min, 1, max);
    t.durations[mode] = min;
    if (mode === t.mode && !t.running) { cancelHold(); t.overtime = false; t.totalSec = min * 60; t.remainSec = t.totalSec; }
    onTick();
  }

  function setDurations(focusMin, shortMin) {
    t.durations.focus = clamp(focusMin, 1, 599);
    t.durations.short = clamp(shortMin, 1, 599);
    if (!t.running) { cancelHold(); t.overtime = false; t.totalSec = t.durations[t.mode] * 60; t.remainSec = t.totalSec; }
    onState();
  }

  t.init = function (hooks) {
    onTick = hooks.onTick || onTick;
    onState = hooks.onState || onState;
    onComplete = hooks.onComplete || onComplete;
  };
  t.start = start;
  t.pause = pause;
  t.toggle = toggle;
  t.reset = reset;
  t.switchMode = switchMode;
  t.setDuration = setDuration;
  t.setDurations = setDurations;

  App.timer = t;
})(window.App = window.App || {});
