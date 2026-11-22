(() => {
  const film = document.querySelector('#trailer');
  const video = film.querySelector('video');
  const toggle = film.querySelector('.play');
  const volumeControl = film.querySelector('.film-volume');
  const volume = volumeControl.querySelector('input');
  const mute = volumeControl.querySelector('.trailer-mute');
  const mobile = matchMedia('(max-width: 800px), (orientation: landscape) and (hover: none) and (pointer: coarse) and (max-height: 500px)');
  const status = film.querySelector('.film-status');

  video.controls = false;
  toggle.hidden = false;
  volume.value = volume.defaultValue;
  volumeControl.hidden = false;

  function setVolume() {
    if (mute.getAttribute('aria-pressed') === 'true') video.muted = false;
    video.volume = volume.valueAsNumber / 100;
    volume.setAttribute('aria-valuetext', volume.value + '%');
  }

  setVolume();
  volume.addEventListener('input', setVolume);

  function updateVolumeControl() {
    // Some mobile browsers leave the level to the device. Mute is still available there.
    const deviceVolume = mobile.matches && Math.abs(video.volume - volume.valueAsNumber / 100) > .01;
    volume.hidden = deviceVolume;
    mute.hidden = !deviceVolume;
  }

  updateVolumeControl();
  mobile.addEventListener('change', updateVolumeControl);
  mute.addEventListener('click', () => { video.muted = !video.muted; });
  video.addEventListener('volumechange', () => mute.setAttribute('aria-pressed', String(video.muted)));

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
