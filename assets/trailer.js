(() => {
  const film = document.querySelector('#trailer');
  const video = film.querySelector('video');
  const toggle = film.querySelector('.play');
  const captions = film.querySelector('.captions');
  const status = film.querySelector('.film-status');

  video.controls = false;
  toggle.hidden = false;

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
    captions.hidden = !video.textTracks.length;
    update();
  });
  video.addEventListener('pause', update);
  video.addEventListener('ended', update);
  video.addEventListener('error', showError);

  captions.addEventListener('click', () => {
    const track = video.textTracks[0];
    const enabled = track.mode !== 'showing';
    track.mode = enabled ? 'showing' : 'disabled';
    captions.setAttribute('aria-pressed', String(enabled));
  });
})();
