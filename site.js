const stage = document.querySelector('.dial-stage');
if (stage) {
  const preview = stage.querySelector('#dial');
  const controls = stage.querySelector('.switch');
  const phases = [...controls.querySelectorAll('button')];
  for (const phase of phases) {
    phase.addEventListener('click', () => {
      stage.dataset.phase = phase.dataset.phase;
      preview.src = phase.dataset.img;
      preview.alt = phase.dataset.alt;
      for (const button of phases) {
        button.setAttribute('aria-pressed', String(button === phase));
      }
    });
  }
  controls.hidden = false;
}
