(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const stage = document.querySelector('.app-stage');
  const frame = stage.querySelector('iframe');
  const header = document.querySelector('.site-header');
  const visibleClips = new Map();
  const clips = [...document.querySelectorAll('[data-clip] video')];
  const mobileClips = new Map(clips.map(clip => [clip, {
    button: clip.parentElement.querySelector('.demo-activate'),
    eligible: false,
    blocked: false,
    manual: false,
    retried: false
  }]));
  const video = document.querySelector('#trailer video');
  const mobile = matchMedia('(max-width: 800px), (orientation: landscape) and (hover: none) and (pointer: coarse) and (max-height: 500px)');
  const compactMedia = new Map(clips.filter(clip => clip.dataset.desktopSrc).map(clip => [clip, {
    src: clip.getAttribute('src'),
    poster: clip.getAttribute('poster'),
    label: clip.getAttribute('aria-label')
  }]));
  let clipObserver;
  let activeClip;
  let trailerVisibility = 0;
  let appNearby = true;
  let resizeFrame;

  function sizeWindow() {
    const scale = Math.min(1, stage.clientWidth / 500);
    stage.style.setProperty('--app-scale', scale);
    stage.style.height = (580 * scale) + 'px';
  }
  if (mobile.matches) sizeWindow();
  new ResizeObserver(() => {
    if (!mobile.matches) {
      sizeWindow();
      return;
    }
    // WebKit can report a resize loop when the callback changes its own target's height.
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(sizeWindow);
  }).observe(stage);

  function updateAppAnimation() {
    const glow = frame.contentDocument?.querySelector('.bg-ambient');
    // Only pause the decorative pulse. The countdown and its audio keep running.
    if (glow) glow.style.animationPlayState = !appNearby || document.hidden ? 'paused' : '';
  }
  new IntersectionObserver(([entry]) => {
    appNearby = entry.isIntersecting;
    updateAppAnimation();
  }, { rootMargin: '64px 0px' }).observe(frame);
  frame.addEventListener('load', updateAppAnimation);
  mobile.addEventListener('change', updateAppAnimation);
  document.addEventListener('visibilitychange', updateAppAnimation);

  function clearClipAttempt(state) {
    clearTimeout(state.timeout);
    state.pending = null;
  }

  function playMobileClip(clip, state) {
    if (state.pending || !clip.paused) return;
    clip.muted = true;
    const attempt = clip.play();
    state.pending = attempt;
    state.timeout = setTimeout(() => {
      if (state.pending !== attempt) return;
      state.blocked = true;
      state.button.hidden = !state.eligible;
    }, 4000);
    attempt.then(() => {
      if (state.pending !== attempt) return;
      clearClipAttempt(state);
      state.blocked = false;
      if (document.activeElement === state.button) {
        clip.parentElement.tabIndex = -1;
        clip.parentElement.focus({ preventScroll: true });
      }
      state.button.hidden = true;
    }, error => {
      if (state.pending !== attempt) return;
      clearClipAttempt(state);
      if (error.name === 'AbortError' && state.eligible && clip.paused && !state.retried) {
        state.retried = true;
        state.blocked = false;
        playMobileClip(clip, state);
        return;
      }
      state.blocked = true;
      state.button.hidden = !state.eligible;
    });
  }

  function updateMobileClip(clip, state, eligible) {
    if (!eligible) {
      state.retried = false;
      if (!clip.error) state.blocked = false;
    }
    state.eligible = eligible;
    if (!eligible || (motion.matches && !state.manual)) {
      clearClipAttempt(state);
      if (!clip.paused) clip.pause();
      state.button.hidden = !eligible;
      return;
    }
    state.button.hidden = !state.blocked || (!clip.paused && !state.pending);
    if (!state.blocked) playMobileClip(clip, state);
  }

  for (const [clip, state] of mobileClips) {
    state.button.addEventListener('click', () => {
      if (!state.eligible) return;
      state.manual = true;
      state.blocked = false;
      if (state.pending) {
        clearClipAttempt(state);
        clip.pause();
      }
      if (clip.error) clip.load();
      playMobileClip(clip, state);
    });
    clip.addEventListener('error', () => {
      if (!mobile.matches) return;
      state.blocked = true;
      state.button.hidden = !state.eligible;
    });
    clip.addEventListener('pause', () => {
      if (!mobile.matches || document.hidden || !state.eligible || !clip.paused ||
          state.pending || (motion.matches && !state.manual)) return;
      state.blocked = true;
      state.button.hidden = false;
    });
  }

  function updateClips() {
    let mostVisible;
    for (const [clip, ratio] of visibleClips) {
      if (!mostVisible || ratio > visibleClips.get(mostVisible)) mostVisible = clip;
    }
    // Keep the current clip across small changes when two demos share the viewport.
    if (!mostVisible || (visibleClips.get(activeClip) ?? 0) < visibleClips.get(mostVisible) - .08) {
      activeClip = mostVisible;
    }
    const prioritizeTrailer = !video.paused && !video.ended && trailerVisibility >= .5 &&
      trailerVisibility > (visibleClips.get(activeClip) ?? 0);
    for (const [clip, state] of mobileClips) {
      const eligible = clip === activeClip && !prioritizeTrailer && !document.hidden;
      if (mobile.matches) {
        updateMobileClip(clip, state, eligible);
        continue;
      }
      if (state.eligible) {
        state.eligible = false;
        clearClipAttempt(state);
        state.button.hidden = true;
      }
      if (eligible && !motion.matches) {
        if (clip.paused) clip.play().catch(() => {});
      } else if (!clip.paused) {
        clip.pause();
      }
    }
  }

  function observeClips() {
    clipObserver?.disconnect();
    visibleClips.clear();
    trailerVisibility = 0;
    updateClips();
    const headerHeight = header.offsetHeight;
    const threshold = mobile.matches ? .05 : .25;
    const thresholds = [.25, .35, .45, .5, .6, .7, .8, .9, 1];
    if (mobile.matches) thresholds.unshift(threshold, .15);
    clipObserver = new IntersectionObserver(entries => {
      entries.forEach(({ target, intersectionRatio }) => {
        if (target === video) trailerVisibility = intersectionRatio;
        else if (intersectionRatio >= threshold) visibleClips.set(target, intersectionRatio);
        else visibleClips.delete(target);
      });
      updateClips();
    }, { rootMargin: `-${headerHeight}px 0px 0px`, threshold: thresholds });

    for (const clip of clips) {
      const compact = compactMedia.get(clip);
      if (compact) {
        const src = mobile.matches ? compact.src : clip.dataset.desktopSrc;
        if (clip.getAttribute('src') !== src) {
          clip.poster = mobile.matches ? compact.poster : clip.dataset.desktopPoster;
          clip.setAttribute('aria-label', !mobile.matches && clip.dataset.desktopLabel || compact.label);
          clip.src = src;
        }
      }
      clipObserver.observe(clip);
    }
    clipObserver.observe(video);
  }
  observeClips();
  mobile.addEventListener('change', observeClips);
  document.addEventListener('visibilitychange', updateClips);
  window.addEventListener('pageshow', () => {
    if (mobile.matches) updateClips();
  });
  video.addEventListener('play', updateClips);
  video.addEventListener('pause', updateClips);
  video.addEventListener('ended', updateClips);

  const library = document.querySelector('.sound-library');
  const canvas = library.querySelector('canvas');
  const context = canvas.getContext('2d');
  const current = library.querySelector('#sound-current');
  const options = library.querySelector('.sound-options');
  const audio = App.audio;
  const bars = 52;
  let request = 0;
  let animation = 0;
  let visualizerVisible = false;
  let visualizerObserver;

  function draw(analyser, samples) {
    if (!context) return;
    const { width, height } = canvas;
    if (analyser) analyser.getByteFrequencyData(samples);
    context.clearRect(0, 0, width, height);
    for (let i = 0; i < bars; i++) {
      const level = analyser ? samples[Math.round(i * 1.6)] / 255 : 0;
      const bar = 2 + level * level * (height - 9);
      context.fillStyle = 'rgba(152, 207, 255, ' + (.26 + level * .74) + ')';
      context.fillRect(i * width / bars + 2, (height - bar) / 2, width / bars - 4, bar);
    }
  }

  function visualize() {
    cancelAnimationFrame(animation);
    const analyser = visualizerVisible && !document.hidden && !motion.matches && audio.current ?
      audio.analyseAmbient() : null;
    if (!analyser) {
      draw(null);
      return;
    }
    const samples = new Uint8Array(analyser.frequencyBinCount);
    function tick() {
      draw(analyser, samples);
      animation = requestAnimationFrame(tick);
    }
    tick();
  }

  function observeVisualizer() {
    visualizerObserver?.disconnect();
    const headerHeight = header.offsetHeight;
    visualizerObserver = new IntersectionObserver(([entry]) => {
      visualizerVisible = entry.isIntersecting;
      visualize();
    }, { rootMargin: `-${headerHeight}px 0px 0px` });
    visualizerObserver.observe(canvas);
  }

  function showSelection(id, message) {
    options.querySelectorAll('button').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.sound === id)));
    current.textContent = message;
  }

  function stopPreview() {
    request++;
    if (audio.current) audio.stopAmbient(true);
    showSelection(null, 'Choose a sound');
    visualize();
  }

  audio.ambient.forEach(({ id, label }) => {
    const name = App.i18n.t(label);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sound-option';
    button.dataset.sound = id;
    button.setAttribute('aria-pressed', 'false');
    const text = document.createElement('span');
    text.textContent = name;
    const icon = document.createElement('span');
    icon.className = 'sound-icon';
    icon.setAttribute('aria-hidden', 'true');
    button.append(text, icon);
    options.append(button);
    button.addEventListener('click', async () => {
      const wasPlaying = audio.current === id;
      stopPreview();
      if (wasPlaying) return;
      const pending = request;
      showSelection(id, 'Loading ' + name);
      const playing = await audio.startAmbient(id);
      if (pending !== request) return;
      showSelection(playing ? id : null, playing ? 'Playing ' + name : 'Could not load ' + name + '. Try again.');
      visualize();
    });
  });
  draw(null);
  observeVisualizer();
  mobile.addEventListener('change', observeVisualizer);
  document.addEventListener('visibilitychange', visualize);

  // A new preview takes ownership before starting. A timed chime yields to current media.
  window.addEventListener('pomodoro:audio', event => {
    const { source, kind } = event.detail;
    if (kind === 'alarm') {
      if (!video.paused || audio.current) event.preventDefault();
      return;
    }
    video.pause();
    if (source === window) {
      frame.contentWindow?.dispatchEvent(new Event('pomodoro:silence'));
    } else {
      stopPreview();
    }
  });
  window.addEventListener('pomodoro:silence', stopPreview);
  motion.addEventListener('change', () => {
    if (mobile.matches && motion.matches) {
      for (const state of mobileClips.values()) state.manual = false;
    }
    updateClips();
    visualize();
  });
})();
