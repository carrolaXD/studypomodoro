const trailer = document.querySelector('#trailer video');
const playButton = document.querySelector('#trailer .play');

// Without JavaScript the poster and standard video controls stay available.
trailer.controls = false;
playButton.hidden = false;
playButton.addEventListener('click', async () => {
  playButton.hidden = true;
  trailer.controls = true;
  trailer.focus({ preventScroll: true });
  try {
    await trailer.play();
  } catch {
    // Leave the native controls available for retry and media error feedback.
    trailer.controls = true;
  }
});
