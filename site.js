const demo = document.querySelector('.hero-demo');

if (demo) {
  const modes = demo.querySelector('.modes');
  const buttons = modes.querySelectorAll('button');
  const previews = demo.querySelectorAll('[data-preview]');
  modes.hidden = false;

  modes.addEventListener('click', (event) => {
    const selected = event.target.closest('button[data-mode]');
    if (!selected) return;

    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button === selected));
    });

    previews.forEach((preview) => {
      preview.hidden = preview.dataset.preview !== selected.dataset.mode;
    });
  });
}
