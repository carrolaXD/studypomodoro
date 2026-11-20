document.querySelectorAll('[data-switcher]').forEach((switcher) => {
  const options = switcher.querySelector('[data-options]');
  const buttons = [...options.querySelectorAll('button[data-mode]')];
  const panels = switcher.querySelectorAll('[data-preview]');

  function select(selected) {
    switcher.dataset.active = selected.dataset.mode;
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button === selected));
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.preview !== selected.dataset.mode;
    }
  }

  select(buttons.find((button) => button.getAttribute('aria-pressed') === 'true'));
  options.addEventListener('click', (event) => {
    const selected = event.target.closest('button[data-mode]');
    if (selected && selected.getAttribute('aria-pressed') !== 'true') {
      switcher.classList.add('has-selection');
      select(selected);
    }
  });
  options.hidden = false;
});
