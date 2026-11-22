(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const stage = document.querySelector('.app-stage');
  const frame = stage.querySelector('iframe');
  const header = document.querySelector('.site-header');
  const visibleClips = new Map();
  const clips = [...document.querySelectorAll('[data-clip] video')];
  const video = document.querySelector('#trailer video');
  const desktop = matchMedia('(min-width: 801px)');
  const compactMedia = new Map(clips.filter(clip => clip.dataset.desktopSrc).map(clip => [clip, {
    src: clip.getAttribute('src'),
    poster: clip.getAttribute('poster'),
    label: clip.getAttribute('aria-label')
  }]));
  let clipObserver;
  let activeClip;
  let trailerVisibility = 0;
  let appNearby = true;

  function sizeWindow() {
    const scale = Math.min(1, stage.clientWidth / 500);
    stage.style.setProperty('--app-scale', scale);
    stage.style.height = (580 * scale) + 'px';
  }
  new ResizeObserver(sizeWindow).observe(stage);

  function updateAppAnimation() {
    const glow = frame.contentDocument?.querySelector('.bg-ambient');
    // Only pause the decorative pulse. The countdown and its audio keep running.
    if (glow) glow.style.animationPlayState = desktop.matches && (!appNearby || document.hidden) ? 'paused' : '';
  }
  new IntersectionObserver(([entry]) => {
    appNearby = entry.isIntersecting;
    updateAppAnimation();
  }, { rootMargin: '64px 0px' }).observe(frame);
  frame.addEventListener('load', updateAppAnimation);
  desktop.addEventListener('change', updateAppAnimation);
  document.addEventListener('visibilitychange', updateAppAnimation);

  function updateClips() {
    if (desktop.matches) {
      let mostVisible;
      for (const [clip, ratio] of visibleClips) {
        if (!mostVisible || ratio > visibleClips.get(mostVisible)) mostVisible = clip;
      }
      // Keep the current clip across small changes when two demos share the viewport.
      if (!mostVisible || (visibleClips.get(activeClip) ?? 0) < visibleClips.get(mostVisible) - .08) {
        activeClip = mostVisible;
      }
    }
    const prioritizeTrailer = !video.paused && !video.ended && trailerVisibility >= .5 &&
      trailerVisibility > (visibleClips.get(activeClip) ?? 0);
    for (const clip of clips) {
      const eligible = desktop.matches ? clip === activeClip && !prioritizeTrailer : visibleClips.has(clip);
      if (eligible && !motion.matches && !document.hidden) {
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
    const threshold = desktop.matches ? .25 : .01;
    const thresholds = desktop.matches ? [.25, .35, .45, .5, .6, .7, .8, .9, 1] : threshold;
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
        const src = desktop.matches ? clip.dataset.desktopSrc : compact.src;
        if (clip.getAttribute('src') !== src) {
          clip.poster = desktop.matches ? clip.dataset.desktopPoster : compact.poster;
          clip.setAttribute('aria-label', desktop.matches && clip.dataset.desktopLabel || compact.label);
          clip.src = src;
        }
      }
      clipObserver.observe(clip);
    }
    if (desktop.matches) clipObserver.observe(video);
  }
  observeClips();
  desktop.addEventListener('change', observeClips);
  document.addEventListener('visibilitychange', updateClips);
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
    const headerHeight = desktop.matches ? header.offsetHeight : 0;
    visualizerObserver = new IntersectionObserver(([entry]) => {
      visualizerVisible = entry.isIntersecting;
      visualize();
    }, { rootMargin: `-${headerHeight}px 0px 0px` });
    visualizerObserver.observe(desktop.matches ? canvas : library);
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
  desktop.addEventListener('change', observeVisualizer);
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
    updateClips();
    visualize();
  });
})();
