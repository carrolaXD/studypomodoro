// Copyright (c) 2026 Pedro Carrola (By Carrola). All rights reserved.
// Theme colour editor and language menu, rendered entirely inside the app.
(function (App) {
  'use strict';
  const $ = id => document.getElementById(id);
  const targets = { focus: 'colorFocus', break: 'colorBreak', background: 'colorBackground' };
  const languages = { en: 'English', pt: 'Português', es: 'Español', fr: 'Français', de: 'Deutsch', it: 'Italiano' };
  let target = 'focus', hue = 0, saturation = 0, brightness = 1;
  let refreshTheme = () => {}, renderState = () => {};
  let returnFocus = null;

  function rgb(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); }
  function readColor(hex) {
    const [r, g, b] = rgb(hex), max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    brightness = max;
    saturation = max ? delta / max : 0;
    if (delta) {
      const sector = max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
      hue = ((sector * 60) + 360) % 360;
    }
  }
  function hexColor() {
    const c = brightness * saturation, h = hue / 60, x = c * (1 - Math.abs(h % 2 - 1));
    const sectors = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]];
    return '#' + sectors[Math.floor(h) % 6].map(v => Math.round((v + brightness - c) * 255).toString(16).padStart(2, '0')).join('');
  }
  function paint() {
    const hex = $(targets[target]).value;
    $('colorField').style.backgroundColor = 'hsl(' + hue + ' 100% 50%)';
    $('colorCursor').style.left = saturation * 100 + '%';
    $('colorCursor').style.top = (1 - brightness) * 100 + '%';
    $('colorCursor').style.background = hex;
    $('colorPreview').style.background = hex;
    $('colorHue').value = Math.round(hue);
    if (document.activeElement !== $('colorHex')) $('colorHex').value = hex.toUpperCase();
    Object.entries(targets).forEach(([key, id]) => {
      $(id).style.setProperty('--chip-color', $(id).value);
      $(id).classList.toggle('active', key === target);
      $(id).setAttribute('aria-pressed', String(key === target));
    });
  }
  function refresh() {
    $('languageValue').textContent = languages[App.i18n.current];
    $('setLang').value = App.i18n.current;
    document.querySelectorAll('.language-option').forEach(el => {
      const selected = el.dataset.lang === App.i18n.current;
      el.classList.toggle('active', selected);
      el.setAttribute('aria-selected', String(selected));
    });
    $('colorHue').setAttribute('aria-label', App.i18n.t('colorHue'));
    readColor($(targets[target]).value || '#ff6b6b');
    paint();
    renderSavedThemes();
  }
  function save(hex) {
    $(targets[target]).value = hex;
    const colors = currentColors();
    App.prefs.set('customColors', colors);
    const active = App.prefs.get('activeCustomTheme');
    if (active) App.prefs.set('customThemes', savedThemes().map(theme => theme.id === active ? { id: active, colors } : theme));
    refreshTheme();
  }
  function currentColors() {
    return { focus: $('colorFocus').value, break: $('colorBreak').value, background: $('colorBackground').value };
  }
  function savedThemes() {
    const themes = App.prefs.get('customThemes');
    if (!Array.isArray(themes)) return [];
    const seen = new Set();
    return themes.filter(theme => {
      if (!theme || typeof theme.id !== 'string' || seen.has(theme.id) || !theme.colors) return false;
      if (!Object.keys(targets).every(key => /^#[0-9a-f]{6}$/i.test(theme.colors[key]))) return false;
      seen.add(theme.id); return true;
    });
  }
  function renderSavedThemes() {
    const themes = savedThemes(), wrap = $('savedThemeSwatches');
    const keys = JSON.stringify(themes.map(theme => theme.id));
    if (wrap.dataset.keys !== keys) {
      wrap.replaceChildren(); wrap.dataset.keys = keys;
      themes.forEach(theme => {
        const button = document.createElement('button');
        button.className = 'saved-theme-swatch'; button.dataset.id = theme.id;
        button.onclick = () => {
          const selected = savedThemes().find(item => item.id === button.dataset.id);
          if (!selected) return;
          App.prefs.set('activeCustomTheme', selected.id);
          App.prefs.set('customColors', { ...selected.colors });
          refreshTheme();
        };
        wrap.appendChild(button);
      });
    }
    themes.forEach((theme, i) => {
      const button = wrap.children[i], colors = theme.colors;
      // Match the palette swatches: an SVG circle keeps the colour joins smooth.
      const clipId = 'saved-sw-' + i;
      button.innerHTML = '<svg class="sw-svg" viewBox="0 0 28 28" aria-hidden="true">' +
        '<defs><clipPath id="' + clipId + '"><circle cx="14" cy="14" r="14"/></clipPath></defs>' +
        '<g clip-path="url(#' + clipId + ')">' +
          '<rect x="0" y="14" width="14" height="14" fill="' + colors.focus + '"/>' +
          '<rect x="14" y="14" width="14" height="14" fill="' + colors.break + '"/>' +
          '<rect x="0" y="0" width="28" height="14.5" fill="' + colors.background + '"/>' +
        '</g><circle cx="14" cy="14" r="13.5" fill="none" stroke="var(--border)"/></svg>';
      const active = theme.id === App.prefs.get('activeCustomTheme');
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
      button.title = App.i18n.t('savedTheme') + ' ' + (i + 1);
      button.setAttribute('aria-label', button.title);
    });
    $('btnDeleteTheme').disabled = !themes.some(theme => theme.id === App.prefs.get('activeCustomTheme'));
  }
  function closeColors() {
    $('customThemeOverlay').classList.remove('open');
    $('btnCustomTheme').setAttribute('aria-expanded', 'false');
    if (returnFocus) returnFocus.focus();
  }
  function closeLanguages() {
    $('languageMenu').hidden = true;
    $('setLang').setAttribute('aria-expanded', 'false');
  }
  function init(hooks) {
    refreshTheme = hooks.refreshTheme;
    renderState = hooks.renderState;
    $('btnCustomTheme').onclick = () => {
      closeLanguages();
      returnFocus = document.activeElement;
      refresh();
      $('customThemeOverlay').classList.add('open');
      $('btnCustomTheme').setAttribute('aria-expanded', 'true');
      $('colorFocus').focus();
    };
    $('btnCloseCustomTheme').onclick = closeColors;
    $('customThemeOverlay').addEventListener('click', e => { if (e.target === $('customThemeOverlay')) closeColors(); });
    Object.entries(targets).forEach(([key, id]) => {
      $(id).onclick = () => { target = key; readColor($(id).value); paint(); };
    });
    $('btnSaveTheme').onclick = () => {
      const themes = savedThemes();
      const id = typeof window.crypto.randomUUID === 'function' ? window.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      themes.push({ id, colors: currentColors() });
      App.prefs.set('customThemes', themes); App.prefs.set('activeCustomTheme', id);
      App.prefs.set('customColors', currentColors()); refreshTheme();
      $('savedThemeSwatches').lastElementChild.focus();
    };
    $('btnDeleteTheme').onclick = () => {
      const active = App.prefs.get('activeCustomTheme');
      App.prefs.set('customThemes', savedThemes().filter(theme => theme.id !== active));
      App.prefs.set('activeCustomTheme', null); renderSavedThemes(); $('btnSaveTheme').focus();
    };
    $('colorHue').oninput = () => { hue = Number($('colorHue').value); save(hexColor()); };
    $('colorHex').oninput = () => {
      const hex = $('colorHex').value;
      if (/^#[0-9a-f]{6}$/i.test(hex)) { $('colorHex').setCustomValidity(''); save(hex.toLowerCase()); }
    };
    $('colorHex').onblur = () => { $('colorHex').value = $(targets[target]).value.toUpperCase(); };
    const field = $('colorField');
    let dragging = false;
    function pick(e) {
      const rect = field.getBoundingClientRect();
      saturation = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      brightness = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      save(hexColor());
    }
    field.onpointerdown = e => {
      if (e.button !== 0) return;
      dragging = true; field.setPointerCapture(e.pointerId); pick(e);
    };
    field.onpointermove = e => { if (dragging) pick(e); };
    field.onpointerup = field.onpointercancel = () => { dragging = false; };
    $('setLang').onclick = () => {
      const open = $('languageMenu').hidden;
      $('languageMenu').hidden = !open;
      $('setLang').setAttribute('aria-expanded', String(open));
      if (open) document.querySelector('.language-option.active').focus();
    };
    Object.entries(languages).forEach(([code, name]) => {
      const button = document.createElement('button');
      button.className = 'language-option'; button.dataset.lang = code;
      button.setAttribute('role', 'option');
      button.innerHTML = '<svg class="language-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg><span></span>';
      button.lastElementChild.textContent = name;
      button.onclick = () => {
        App.i18n.set(code);
        renderState(); closeLanguages(); $('setLang').focus();
      };
      $('languageMenu').appendChild(button);
    });
    document.addEventListener('click', e => { if (!$('languagePicker').contains(e.target)) closeLanguages(); });
    $('languagePicker').addEventListener('keydown', e => {
      const options = Array.from(document.querySelectorAll('.language-option'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); $('languageMenu').hidden = false; $('setLang').setAttribute('aria-expanded', 'true');
        const i = options.indexOf(document.activeElement), direction = e.key === 'ArrowDown' ? 1 : -1;
        const current = i < 0 ? options.findIndex(el => el.dataset.lang === App.i18n.current) : i;
        options[(current + direction + options.length) % options.length].focus();
      }
      if (e.key === 'Escape') { e.stopPropagation(); closeLanguages(); $('setLang').focus(); }
      if (e.key === 'Tab') closeLanguages();
    });
    $('customThemeOverlay').addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); closeColors(); }
      if (e.key !== 'Tab') return;
      const controls = Array.from($('customThemeOverlay').querySelectorAll('button,input')).filter(el => !el.disabled);
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    App.i18n.onChange(refresh);
    refresh();
  }
  App.appearance = { init, refresh };
})(window.App = window.App || {});
