// Copyright (c) 2026 Pedro Carrola (By Carrola). All rights reserved.
// Circular time wheels, with typing, pointer dragging and momentum scrolling.
(function (App) {
  'use strict';
  const WHEEL_ITEM = 36;       // px, must match .wheel-item height in CSS
  const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const wheelMin = s => parseInt(s.dataset.min || '0', 10);
  const wheelMax = s => parseInt(s.dataset.max, 10);
  const wheelCount = s => wheelMax(s) - wheelMin(s) + 1;
  const modulo = (n, count) => ((n % count) + count) % count;
  const fmtWheel = (s, v) => s.hasAttribute('data-pad') ? String(v).padStart(2, '0') : String(v);

  // The middle cycle is the stable anchor for programmatic positioning.
  function wheelVal(scroll) {
    return wheelMin(scroll) + modulo(Math.round(scroll.scrollTop / WHEEL_ITEM), wheelCount(scroll));
  }

  function setWheel(scroll, val, notify = true) {
    scroll.scrollTop = (wheelCount(scroll) + clampN(val, wheelMin(scroll), wheelMax(scroll)) - wheelMin(scroll)) * WHEEL_ITEM;
    render3D(scroll);
    // read back the actual (browser-clamped) position so the input never shows
    // an out-of-range value
    if (scroll._input) scroll._input.value = fmtWheel(scroll, wheelVal(scroll));
    // every settle point (glide end, drag snap, typed value) lands here - the
    // Times panel has no Save/Cancel, so this is where changes auto-apply
    if (scroll._onChange && notify) scroll._onChange();
  }

  // Three identical cycles keep both neighbours visible at 0/max. Recentring
  // preserves the fractional row offset, so a 9 -> 0 wrap never snaps visually.
  function moveWheel(scroll, top) {
    const span = wheelCount(scroll) * WHEEL_ITEM;
    const centered = span + modulo(top, span);
    scroll.scrollTop = centered;
    return centered - top;
  }

  // curve the items in 3D by their distance from the centre line
  function render3D(scroll) {
    const center = scroll.scrollTop + scroll.clientHeight / 2;
    const items = scroll.children;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const dist = (it.offsetTop + WHEEL_ITEM / 2 - center) / WHEEL_ITEM;
      it.style.transform = 'rotateX(' + clampN(dist * 22, -90, 90) + 'deg)';
      it.style.opacity = Math.max(0.15, 1 - Math.abs(dist) * 0.28);
    }
  }

  // Build a wheel: a snap-scroll column you can spin with the wheel/trackpad or
  // drag, plus a centred <input> you can click to type the value by hand.
  function buildWheel(scroll) {
    const min = wheelMin(scroll), max = wheelMax(scroll);
    let html = '';
    for (let copy = 0; copy < 3; copy++) for (let v = min; v <= max; v++) html += '<div class="wheel-item">' + fmtWheel(scroll, v) + '</div>';
    scroll.innerHTML = html;

    const input = document.createElement('input');
    input.className = 'wheel-input';
    input.inputMode = 'numeric';
    input.maxLength = String(max).length;
    input.placeholder = '··';
    scroll.parentNode.appendChild(input);
    scroll._input = input;

    let editing = false, dragging = false, moved = false, startY = 0, startTop = 0;
    let vel = 0, momentumRAF = null, prevY = 0, dragVel = 0, friction = 0.9;

    // redraw the 3D curve and mirror the centred value into the input
    const update = () => {
      const shift = moveWheel(scroll, scroll.scrollTop);
      if (dragging) startTop += shift;
      render3D(scroll);
      if (!editing) input.value = fmtWheel(scroll, wheelVal(scroll));
    };
    scroll.addEventListener('scroll', () => {
      cancelAnimationFrame(scroll._raf);
      scroll._raf = requestAnimationFrame(update);
    });

    // --- type a value by hand: clear the number so it's clearly editable ---
    input.addEventListener('focus', () => { editing = true; input.classList.add('editing'); input.value = ''; });
    // clamp to the max live so an over-the-limit number snaps back immediately
    input.addEventListener('input', () => {
      const v = parseInt(input.value, 10);
      if (!isNaN(v) && v > max) input.value = String(max);
    });
    input.addEventListener('blur', () => {
      editing = false; input.classList.remove('editing');
      const v = parseInt(input.value, 10);
      setWheel(scroll, isNaN(v) ? wheelVal(scroll) : clampN(v, min, max));
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') input.blur();
      else if (e.key === 'Escape') { input.value = fmtWheel(scroll, wheelVal(scroll)); input.blur(); }
    });

    // --- mouse wheel / trackpad: velocity-based momentum (harder flick = faster) ---
    function momentumStep() {
      const before = scroll.scrollTop;
      moveWheel(scroll, before + vel);
      update();
      vel *= friction;                               // per-source friction (higher = longer glide)
      if (Math.abs(vel) < 0.4 || scroll.scrollTop === before) {
        vel = 0; momentumRAF = null;
        setWheel(scroll, wheelVal(scroll));          // settle on the nearest value
      } else {
        momentumRAF = requestAnimationFrame(momentumStep);
      }
    }
    scroll.addEventListener('wheel', e => {
      e.preventDefault();
      if (editing) input.blur();
      friction = 0.88;                               // mouse wheel: less inertia
      // normalise to pixels (some mice report deltaY in lines or pages)
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;               // lines -> px
      else if (e.deltaMode === 2) dy *= scroll.clientHeight;
      vel = clampN(vel + dy * 0.12, -50, 50);        // accumulate -> faster when spun hard
      if (!momentumRAF) momentumRAF = requestAnimationFrame(momentumStep);
    }, { passive: false });

    // --- drag to spin the wheel; a tap (no movement) opens the input to type ---
    scroll.addEventListener('pointerdown', e => {
      if (editing) input.blur();
      vel = 0;                                          // stop any ongoing glide
      dragging = true; moved = false; startY = e.clientY; startTop = scroll.scrollTop;
      prevY = e.clientY; dragVel = 0;
      scroll.style.scrollSnapType = 'none';
      try { scroll.setPointerCapture(e.pointerId); } catch (_) {}
    });
    scroll.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dy = e.clientY - startY;
      if (Math.abs(dy) > 3) moved = true;
      dragVel = prevY - e.clientY;                      // scrollTop velocity (px per move)
      prevY = e.clientY;
      startTop += moveWheel(scroll, startTop - dy);
      update();
    });
    const endDrag = e => {
      if (!dragging) return;
      dragging = false;
      scroll.style.scrollSnapType = '';
      try { scroll.releasePointerCapture(e.pointerId); } catch (_) {}
      if (!moved) { input.focus(); return; }            // tap -> type
      friction = 0.95;                                  // drag fling: more inertia
      vel = clampN(dragVel, -50, 50);                   // fling with the release velocity
      if (Math.abs(vel) > 1) {
        if (!momentumRAF) momentumRAF = requestAnimationFrame(momentumStep);
      } else {
        setWheel(scroll, wheelVal(scroll));             // no fling -> just snap
      }
    };
    scroll.addEventListener('pointerup', endDrag);
    scroll.addEventListener('pointercancel', endDrag);
    setWheel(scroll, min, false);
  }

  App.wheels = { build: buildWheel, set: setWheel, value: wheelVal };
})(window.App = window.App || {});
