// Copyright (c) 2026 Pedro Carrola (By Carrola). All rights reserved.
// Proprietary software - see LICENSE.
(function (App) {
  'use strict';
  const $ = id => document.getElementById(id);
  let open = false;

  function close() {
    open = false;
    $('alarmDropdown').classList.remove('open');
    $('alarmToggle').setAttribute('aria-expanded', 'false');
    App.audio.stopAlarmPreview();
  }

  function refresh() {
    const enabled = App.audio.alarmOn;
    $('setAlarmEnabled').checked = enabled;
    $('bellSlash').style.display = enabled ? 'none' : 'block';
    $('alarmToggle').classList.toggle('active', enabled);
    $('alarmVolSlider').value = App.audio.alarmVolume;
    $('alarmVolSlider').setAttribute('aria-label', App.i18n.t('alarmVolume'));
    $('alarmToggle').setAttribute('aria-label', App.i18n.t('alarmTooltip'));
    $('alarmOptions').querySelectorAll('[data-alarm]').forEach(button => {
      const selected = button.dataset.alarm === App.audio.alarmSound;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function init({ closeAmbient }) {
    const prefs = App.prefs;
    App.audio.setAlarm(prefs.get('alarm'));
    App.audio.setAlarmSound(prefs.get('alarmSound'));
    // Preserve the old bell level once, then keep both volume controls separate.
    const saved = prefs.get('alarmVolume');
    const legacy = Number(prefs.get('volume'));
    const initial = saved == null ? Math.max(30, Number.isFinite(legacy) ? legacy : 50) : saved;
    App.audio.setAlarmVolume(initial);
    if (saved == null) prefs.set('alarmVolume', App.audio.alarmVolume);
    const options = $('alarmOptions');
    App.audio.alarms.forEach(sound => {
      const button = document.createElement('button');
      button.className = 'audio-option';
      button.dataset.alarm = sound.id;
      button.innerHTML = '<span data-i18n="' + sound.label + '"></span><span class="check" aria-hidden="true"></span>';
      button.onclick = () => {
        App.audio.setAlarmSound(sound.id);
        prefs.set('alarmSound', App.audio.alarmSound);
        refresh();
        App.audio.previewAlarm();
      };
      options.appendChild(button);
    });
    $('alarmToggle').onclick = () => {
      if (open) { close(); return; }
      closeAmbient();
      open = true;
      refresh();
      $('alarmDropdown').classList.add('open');
      $('alarmToggle').setAttribute('aria-expanded', 'true');
    };
    $('setAlarmEnabled').onchange = () => {
      App.audio.setAlarm($('setAlarmEnabled').checked);
      prefs.set('alarm', App.audio.alarmOn);
      refresh();
    };
    $('alarmVolSlider').oninput = () => {
      App.audio.setAlarmVolume(Number($('alarmVolSlider').value));
      prefs.set('alarmVolume', App.audio.alarmVolume);
    };
    $('alarmVolSlider').onchange = () => App.audio.previewAlarm();
    document.addEventListener('click', e => {
      if (open && !$('alarmWrap').contains(e.target)) close();
    });
    document.addEventListener('keydown', e => {
      if (open && e.key === 'Escape') {
        e.preventDefault(); close(); $('alarmToggle').focus();
      }
    });
    App.i18n.onChange(refresh);
    App.i18n.apply();
    refresh();
  }

  App.alarmMenu = { init, close };
})(window.App = window.App || {});
