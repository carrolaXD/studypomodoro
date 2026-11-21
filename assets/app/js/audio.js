// Copyright (c) 2026 Pedro Carrola (By Carrola). All rights reserved.
// Proprietary software - see LICENSE. Unauthorized use, copying or distribution is prohibited.

// ==================== AUDIO ENGINE ====================
// Plays bundled audio files (in sounds/) via Web Audio. Ambient sounds loop
// through an AudioBufferSourceNode (sample-accurate and gapless).
//
// To add an ambient sound: drop the file in sounds/ and add a line to AMBIENT
// (id = stable key persisted in prefs, label = i18n key, file = path).
(function (App) {
  'use strict';

  // gain = per-sound loudness trim on top of the slider (1 = unchanged).
  // Files are normalized to -18 LUFS; these are fine taste adjustments.
  const AMBIENT = [
    { id: 'white',      label: 'whiteNoise', file: 'sounds/white.flac',     gain: 0.22 }, // -13 dB
    { id: 'brown',      label: 'brownNoise', file: 'sounds/brown.flac',     gain: 0.89 }, // -1 dB
    { id: 'pure40',     label: 'pure40',     file: 'sounds/pure40.flac',    gain: 0.60 }, // -4.5 dB (lossless: seamless 40Hz binaural-beat loop)
    { id: 'deepfocus',  label: 'deepFocus',  file: 'sounds/deepfocus.ogg',  gain: 0.19 }, // -14.5 dB
    { id: 'binaural',   label: 'binaural',   file: 'sounds/binaural.flac',  gain: 0.47 }, // -6.5 dB
    { id: 'rain',       label: 'rain',       file: 'sounds/rain.flac',      gain: 0.15 }, // -16.5 dB
    { id: 'birds',      label: 'birds',      file: 'sounds/birds.ogg',      gain: 2.11 }, // +6.5 dB
    { id: 'beach',      label: 'beach',      file: 'sounds/beach.flac',     gain: 0.16 }, // -16 dB
    { id: 'coffeeshop', label: 'coffeeShop', file: 'sounds/coffeeshop.ogg' }
  ];
  // Classic at 80% of the original calibration; other alarms at 90%.
  const ALARMS = [
    { id: 'classic', label: 'alarmClassic', file: 'sounds/bell.flac', gain: 0.936, leadMs: 450 },
    { id: 'cloud', label: 'alarmCloud', file: 'sounds/alarms/cloud.ogg', gain: 1.584 },
    { id: 'school', label: 'alarmSchool', file: 'sounds/alarms/school.flac', gain: 1.17, leadMs: 450 },
    { id: 'ripple', label: 'alarmRipple', file: 'sounds/alarms/ripple.flac', gain: 1.17, leadMs: 450 },
    { id: 'spark', label: 'alarmSpark', file: 'sounds/alarms/spark.flac', gain: 1.17, leadMs: 450 },
    { id: 'landing', label: 'alarmLanding', file: 'sounds/alarms/landing.flac', gain: 1.17, leadMs: 450 }
  ];

  let volume = 50;          // 0-100, mirrors the slider
  let alarmOn = true;
  let alarmSound = 'classic', alarmVolume = 50;
  let bellBuffer = null, previewRequest = 0;
  const alarmVoices = new Set();
  let currentSound = null;
  let ambientMuted = false;
  let ambientFade = 0.75; // first playback and session transitions

  const FADE = 0.35;        // crossfade time (s) between ambient sounds
  let ctx = null, master = null, alarmMaster = null;
  let srcNode = null, srcGain = null;   // active source + its own gain (per-sound trim)
  const audioRoot = new URL('../', document.currentScript.src);
  const fadingSources = new Set();
  let ambientRequest = 0;
  let alarmRequest = 0;
  let analyser = null;
  const bufCache = {};      // url -> Promise<AudioBuffer>
  let idleTimer = null;     // pending "suspend the audio graph" timeout (see releaseIfIdle)

  function getCtx() {
    // Any actual use of audio cancels a pending suspend and resumes the context.
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      // Pin the context to 48 kHz. decodeAudioData resamples each sound to the
      // context rate, so an unpinned context on a 192 kHz output device would
      // decode every 56 s stereo sound into a ~86 MB float32 buffer; at 48 kHz
      // that drops to ~21 MB. 48 kHz is full-quality for these sounds (Nyquist
      // 24 kHz >> human hearing) and changes nothing in the loops/gains, which
      // are sample-rate independent. Fallback to the default if the rate is unsupported.
      try { ctx = new AC({ sampleRate: 48000 }); }
      catch (_) { ctx = new AC(); }
      master = ctx.createGain();
      master.gain.value = volume / 100;
      master.connect(ctx.destination);
      alarmMaster = ctx.createGain();
      alarmMaster.gain.value = alarmVolume / 100;
      alarmMaster.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function loadBuffer(url) {
    if (bufCache[url]) return bufCache[url];
    const p = fetch(new URL(url, audioRoot))
      .then(response => {
        if (!response.ok) throw new Error('Audio unavailable');
        return response.arrayBuffer();
      })
      .then(bytes => ctx.decodeAudioData(bytes))
      // Don't cache a failure: drop the entry so a later attempt re-fetches and
      // re-decodes instead of returning the same rejected promise forever (a
      // transient hiccup would otherwise leave the sound/bell dead until restart).
      .catch(err => { delete bufCache[url]; throw err; });
    bufCache[url] = p;
    return p;
  }

  // fade a source out over FADE seconds, then stop & disconnect it
  function fadeOutStop(node, g) {
    if (!node) return;
    fadingSources.add(node);
    node.onended = () => { fadingSources.delete(node); node.disconnect(); g.disconnect(); };
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(0, now + FADE);
    try { node.stop(now + FADE + 0.05); } catch (_) {}
  }

  function requestAudio(kind) {
    return window.parent.dispatchEvent(new CustomEvent('pomodoro:audio', {
      cancelable: true, detail: { source: window, kind }
    }));
  }

  function startAmbient(id) {
    const s = AMBIENT.find(x => x.id === id);
    if (!s || !requestAudio('ambient') || !getCtx()) return Promise.resolve(false);
    const request = ++ambientRequest;
    currentSound = id;                       // reflect immediately (load is async)
    return loadBuffer(s.file).then(buf => {
      if (request !== ambientRequest) return false;       // toggled/switched while loading
      const fade = srcNode ? FADE : ambientFade;
      fadeOutStop(srcNode, srcGain);         // crossfade out the previous sound
      const g = ctx.createGain();
      g.connect(master);
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.loop = true;                      // gapless, sample-accurate
      node.connect(g);
      const target = ambientMuted ? 0 : (s.gain || 1);            // per-sound trim
      const now = ctx.currentTime;
      g.gain.setValueAtTime(0, now);         // fade in -> no click, no jump
      g.gain.linearRampToValueAtTime(target, now + fade);
      node.start();
      srcNode = node; srcGain = g;
      // Decoded ambient buffers are big (~20 MB each: ~1 min of stereo float32
      // PCM at the context rate), so caching every sound ever played grew RAM
      // by ~20 MB per switch, unbounded. Keep only the active sound + the bell;
      // re-picking an old sound just re-reads and decodes it (~100-200 ms),
      // hidden under the 0.35 s crossfade. The sound fading out right now keeps
      // playing - its source node holds its own reference to the buffer.
      trimCache();
      return true;
    }).catch(() => {
      if (request !== ambientRequest) return false;
      stopAmbient(true);
      notify(id, false);
      return false;
    });
  }

  function stopAmbient(immediate = false) {
    ambientRequest++;
    currentSound = null;
    if (immediate) {
      fadingSources.forEach(node => { node.disconnect(); node.stop(); });
      if (srcNode) {
        srcNode.disconnect();
        srcNode.stop();
        srcGain.disconnect();
      }
    } else {
      fadeOutStop(srcNode, srcGain);
    }
    srcNode = null; srcGain = null;
    // Drop the decoded ambient buffer (~20 MB) now that nothing loops it - keep
    // only the bell. The fading-out node still holds its own reference to the
    // buffer until it stops, so the crossfade out is unaffected; re-picking a
    // sound just re-reads and decodes it (~150 ms) under the next crossfade,
    // exactly like switching sounds (same trim startAmbient already does).
    trimCache();
    releaseIfIdle();
  }

  // Suspend the whole audio graph once nothing needs it, letting Chromium tear
  // down the audio utility process and reclaim its memory. Guards make this safe:
  // we only suspend with no ambient sound playing AND no timer running - the bell
  // only fires while the timer runs, and start() resumes the context (via
  // preloadBell) minutes ahead, so the tuned bell timing is never on the resume
  // path. The 1.5 s delay waits out the 0.35 s crossfade so a sound fading out is
  // never cut, and any audio use in between cancels it (getCtx clears idleTimer).
  function releaseIfIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimer = null;
      if (!ctx || ctx.state !== 'running') return;
      if (currentSound) return;
      if (alarmVoices.size) return;
      if (window.App && App.timer && App.timer.running) return;
      ctx.suspend();
    }, 1500);
  }

  // Keep the chosen loop and playback position; only its ambient gain changes.
  // The bell has its own gain routed to destination and remains audible.
  function setAmbientMuted(muted, fade = FADE) {
    ambientFade = fade; // also covers a new timer while the sound is still loading
    if (ambientMuted === muted) return;
    ambientMuted = muted;
    if (!srcGain || !ctx) return;
    const sound = AMBIENT.find(s => s.id === currentSound);
    const now = ctx.currentTime;
    const gain = srcGain.gain;
    // Capture before cancelling: a quick reversal must start at the current level.
    const level = gain.value;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(level, now);
    gain.linearRampToValueAtTime(muted ? 0 : ((sound && sound.gain) || 1), now + fade);
  }

  function setVolume(v) {
    volume = v;
    if (master && ctx) master.gain.setTargetAtTime(v / 100, ctx.currentTime, 0.05);
  }

  function selectedAlarm() { return ALARMS.find(s => s.id === alarmSound); }

  function trimCache() {
    const ambient = AMBIENT.find(s => s.id === currentSound);
    for (const url in bufCache) {
      if (url !== selectedAlarm().file && (!ambient || url !== ambient.file)) delete bufCache[url];
    }
  }

  function playBuf(buf, sound, preview) {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = sound.gain;
    s.connect(g);
    g.connect(alarmMaster); // independent of ambient volume and break muting
    const voice = { source: s, gain: g, preview };
    alarmVoices.add(voice);
    s.onended = () => {
      alarmVoices.delete(voice);
      try { s.disconnect(); g.disconnect(); } catch (_) {}
      releaseIfIdle();
    };
    s.start();
  }

  function stopVoice(voice) {
    const now = ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + 0.03);
    try { voice.source.stop(now + 0.04); } catch (_) {}
  }

  function stopAlarmPreview() {
    previewRequest++;
    alarmVoices.forEach(v => { if (v.preview) stopVoice(v); });
  }

  function setAlarmSound(id) {
    const next = ALARMS.find(s => s.id === id) || ALARMS[0];
    if (next.id === alarmSound) return;
    stopAlarmPreview();
    alarmSound = next.id;
    bellBuffer = null;
    trimCache();
  }

  function setAlarmVolume(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    alarmVolume = Math.max(0, Math.min(100, n));
    if (alarmMaster && ctx) alarmMaster.gain.setTargetAtTime(alarmVolume / 100, ctx.currentTime, 0.05);
  }

  // Decode the bell ahead of time so it can fire the instant the timer hits
  // 00:00 (no fetch/decode latency). Call once the audio context is allowed
  // (i.e. after a user gesture, e.g. starting the timer).
  function preloadBell() {
    // getCtx() first (not short-circuited by a cached bell): start() calls this
    // when the timer begins, so it must always resume a context that idle-suspend
    // may have suspended - well ahead of the bell, keeping its tuned timing exact.
    if (!getCtx()) return;
    if (bellBuffer) return;
    const sound = selectedAlarm();
    loadBuffer(sound.file).then(buf => {
      if (sound.id === alarmSound) { bellBuffer = buf; trimCache(); }
    }).catch(() => {});
  }

  function silence() {
    stopAmbient(true);
    previewRequest++;
    alarmRequest++;
    alarmVoices.forEach(voice => {
      voice.source.disconnect();
      voice.source.stop();
    });
  }

  function playAlarm(preview = false) {
    if (preview) stopAlarmPreview();
    if ((!preview && !alarmOn) || alarmVolume === 0 || !requestAudio(preview ? 'preview' : 'alarm') || !getCtx()) return;
    const sound = selectedAlarm(), request = previewRequest, currentAlarmRequest = alarmRequest;
    const play = buf => {
      if (currentAlarmRequest !== alarmRequest || sound.id !== alarmSound || (preview && request !== previewRequest) ||
          (!preview && !alarmOn) || alarmVolume === 0) { releaseIfIdle(); return; }
      bellBuffer = buf;
      trimCache();
      playBuf(buf, sound, preview);
    };
    if (bellBuffer) { play(bellBuffer); return; }
    loadBuffer(sound.file).then(play).catch(() => { releaseIfIdle(); });
  }

  // --- availability ---
  // The sounds ship bundled with the app, so they're assumed present and their
  // options are enabled up front. This deliberately avoids reading all bundled files
  // (~9 MB) at launch just to check they exist - that was pure cold-start I/O,
  // since the bytes were then discarded and re-fetched on first play anyway.
  // If a file ever genuinely fails to load when played, startAmbient disables it.
  let avCb = null;
  const avState = {};
  function notify(id, ok) { avState[id] = ok; if (avCb) avCb(id, ok); }
  AMBIENT.forEach(s => { avState[s.id] = true; });

  App.audio = {
    bell: () => playAlarm(false),
    previewAlarm: () => playAlarm(true),
    stopAlarmPreview,
    setAlarmSound,
    setAlarmVolume,
    alarms: ALARMS,
    get alarmSound() { return alarmSound; },
    get bellLeadMs() { return selectedAlarm().leadMs ?? 850; },
    get alarmVolume() { return alarmVolume; },
    preloadBell,
    startAmbient,
    stopAmbient,
    silence,
    analyseAmbient() {
      if (!master) return null;
      if (!analyser) {
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        master.connect(analyser);
      }
      return analyser;
    },
    releaseIfIdle,
    setVolume,
    setAmbientMuted,
    toggleSound(id) {
      currentSound === id ? stopAmbient() : startAmbient(id);
    },
    ambient: AMBIENT,                       // manifest, consumed by the UI
    get current() { return currentSound; },
    get volume() { return volume; },
    get alarmOn() { return alarmOn; },
    setAlarm(on) {
      alarmOn = !!on;
      if (!alarmOn) {
        stopAlarmPreview();
        alarmVoices.forEach(v => { if (!v.preview) stopVoice(v); });
      }
    },
    set onAvailability(fn) {
      avCb = fn;
      Object.keys(avState).forEach(id => fn(id, avState[id]));
    }
  };
})(window.App = window.App || {});
