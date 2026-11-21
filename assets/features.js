(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const stage = document.querySelector('.app-stage');
  const frame = stage.querySelector('iframe');
  const clipPlayers = new Map();

  function sizeWindow() {
    const scale = Math.min(1, stage.clientWidth / 500);
    stage.style.setProperty('--app-scale', scale);
    stage.style.height = (580 * scale) + 'px';
  }
  new ResizeObserver(sizeWindow).observe(stage);

  const visibility = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      const player = clipPlayers.get(target);
      if (isIntersecting) {
        if (!motion.matches && (!player.started || player.resume)) player.play();
      } else if (!player.video.paused) {
        player.video.pause();
        player.resume = true;
      }
    });
  }, { threshold: .57 });

  document.querySelectorAll('[data-clip]').forEach(figure => {
    const video = figure.querySelector('video');
    const button = figure.querySelector('button');
    const name = button.getAttribute('aria-label').slice(5);
    const player = {
      video,
      started: false,
      resume: false,
      play() {
        player.started = true;
        player.resume = false;
        video.play().catch(() => {});
      }
    };
    clipPlayers.set(figure, player);
    button.hidden = false;
    function update() {
      const playing = !video.paused && !video.ended;
      button.toggleAttribute('data-playing', playing);
      button.setAttribute('aria-label', (playing ? 'Pause ' : 'Play ') + name);
    }
    button.addEventListener('click', () => {
      if (video.paused) player.play();
      else video.pause();
    });
    video.addEventListener('play', update);
    video.addEventListener('pause', update);
    video.addEventListener('ended', update);
    visibility.observe(figure);
  });

  const video = document.querySelector('#trailer video');
  const library = document.querySelector('.sound-library');
  const canvas = library.querySelector('canvas');
  const context = canvas.getContext('2d');
  const current = library.querySelector('#sound-current');
  const options = library.querySelector('.sound-options');
  const audio = App.audio;
  const bars = 52;
  let request = 0;
  let animation = 0;
  let libraryVisible = false;

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
    const analyser = libraryVisible && !motion.matches && audio.current ? audio.analyseAmbient() : null;
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
  new IntersectionObserver(([entry]) => {
    libraryVisible = entry.isIntersecting;
    visualize();
  }).observe(library);

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
    if (motion.matches) {
      clipPlayers.forEach(player => {
        player.resume = false;
        player.video.pause();
      });
    }
    visualize();
  });
})();
