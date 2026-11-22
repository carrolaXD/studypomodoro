(() => {
  const mobile = matchMedia('(max-width: 800px), (orientation: landscape) and (hover: none) and (pointer: coarse) and (max-height: 500px)');
  const header = document.querySelector('.site-header');
  const toggle = header.querySelector('.menu-toggle');
  const menu = header.querySelector('#site-navigation');
  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.toggleAttribute('data-open', open);
    menu.inert = mobile.matches && !open;
  }

  function syncLayout() {
    const wasFocused = header.contains(document.activeElement);
    const toggleWasFocused = document.activeElement === toggle;
    document.body.classList.toggle('mobile-menu-ready', mobile.matches);
    toggle.hidden = !mobile.matches;
    setOpen(false);
    if (!wasFocused) return;
    if (mobile.matches) toggle.focus({ preventScroll: true });
    else if (toggleWasFocused) menu.querySelector('a').focus({ preventScroll: true });
  }

  toggle.addEventListener('click', () => setOpen(!isOpen()));
  menu.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || !isOpen()) return;
    const target = link.hash && link.getAttribute('href').startsWith('#') ?
      document.getElementById(link.hash.slice(1)) : null;
    // Native fragment navigation handles scrolling and the next Tab stop.
    setOpen(false);
    if (!target) toggle.focus({ preventScroll: true });
  });
  document.addEventListener('pointerdown', event => {
    if (!isOpen() || menu.contains(event.target) || toggle.contains(event.target)) return;
    const focusWasInMenu = menu.contains(document.activeElement);
    setOpen(false);
    if (focusWasInMenu) toggle.focus({ preventScroll: true });
  }, { passive: true });
  document.addEventListener('focusin', event => {
    if (isOpen() && !menu.contains(event.target) && event.target !== toggle) setOpen(false);
  });
  window.addEventListener('blur', () => {
    if (isOpen()) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !isOpen()) return;
    event.preventDefault();
    setOpen(false);
    toggle.focus({ preventScroll: true });
  });
  mobile.addEventListener('change', syncLayout);
  syncLayout();
})();
