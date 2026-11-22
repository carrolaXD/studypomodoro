(() => {
  const film = document.querySelector('#trailer');
  const video = film.querySelector('video');
  const toggle = film.querySelector('.play');
  const volumeControl = film.querySelector('.film-volume');
  const volume = volumeControl.querySelector('input');
  const mobile = matchMedia('(max-width: 800px), (orientation: landscape) and (hover: none) and (pointer: coarse) and (max-height: 500px)');
  const status = film.querySelector('.film-status');

  video.controls = false;
  toggle.hidden = false;
  volume.value = volume.defaultValue;

  function setVolume() {
    video.volume = volume.valueAsNumber / 100;
    volume.setAttribute('aria-valuetext', volume.value + '%');
  }

  function updateVolumeControl() {
    volumeControl.hidden = mobile.matches;
    if (mobile.matches) {
      volume.removeEventListener('input', setVolume);
      if (video.volume !== 1) video.volume = 1;
      return;
    }
    setVolume();
    volume.addEventListener('input', setVolume);
  }

  updateVolumeControl();
  mobile.addEventListener('change', updateVolumeControl);

  function update() {
    const playing = !video.paused && !video.ended;
    toggle.toggleAttribute('data-playing', playing);
    toggle.setAttribute('aria-label', (playing ? 'Pause' : 'Play') + ' the Study Pomodoro trailer');
  }

  function silenceOtherAudio() {
    window.dispatchEvent(new Event('pomodoro:silence'));
    document.querySelector('.app-window iframe').contentWindow?.dispatchEvent(new Event('pomodoro:silence'));
  }

  function showError() {
    if (mobile.matches && video.error) {
      video.pause();
      update();
    }
    status.hidden = false;
    status.textContent = 'The trailer could not play. Click to retry.';
    if (video.error) status.textContent = 'The trailer could not load. Reload the page to try again.';
  }

  toggle.addEventListener('click', () => {
    if (!video.paused) {
      video.pause();
      return;
    }
    silenceOtherAudio();
    status.hidden = true;
    video.play().catch(error => {
      if (error.name !== 'AbortError') showError();
    });
  });

  video.addEventListener('play', () => {
    silenceOtherAudio();
    update();
  });
  video.addEventListener('pause', update);
  video.addEventListener('ended', update);
  video.addEventListener('error', showError);
})();
