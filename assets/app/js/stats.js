// Copyright (c) 2026 Pedro Carrola (By Carrola). All rights reserved.
// Proprietary software - see LICENSE. Unauthorized use, copying or distribution is prohibited.

// ==================== STATS ====================
// The original report renders the fixed V11 dataset in the browser.
(function (App) {
  'use strict';

  const $ = id => document.getElementById(id);
  const sample = App.sampleStats;
  const snapshotDate = () => parseKey(sample.date);

  // ===================== date helpers =====================
  function pad(n) { return String(n).padStart(2, '0'); }
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseKey(k) { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function startOfWeek(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function periodStart(v, d) {
    if (v === 'week') return startOfWeek(d);
    if (v === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
    return new Date(d.getFullYear(), 0, 1);
  }
  function dayMin(s, d) { const x = s.days[dateKey(d)]; return x ? (x.minutes || 0) : 0; }
  // YYYY-MM-DD keys sort lexically == chronologically, so a string range works.
  function rangeTotal(s, a, b) { let t = 0; for (const k in s.days) if (k >= a && k <= b) t += s.days[k].minutes || 0; return t; }
  function rangeActiveDays(s, a, b) { let n = 0; for (const k in s.days) if (k >= a && k <= b && s.days[k].minutes > 0) n++; return n; }
  function fmtMins(m) { m = Math.round(m); return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm'; }

  function months() { return App.i18n.t('months'); }
  function weekdays() { return App.i18n.t('weekdaysMin'); }

  // ===================== view state =====================
  let view = 'month';
  let anchor = snapshotDate();      // any date inside the displayed period
  let cur = null;               // last drawn curve (fracs + points) for scrubbing
  let scrubWired = false;

  // Build the model for the current view + anchor: curve points, totals, label,
  // and navigation bounds. Future days are flagged so the line stops at today.
  function buildPeriod() {
    const s = sample;
    const today = snapshotDate(); today.setHours(0, 0, 0, 0);
    const M = months();
    const points = [];
    let start, end, prevStart, prevEnd, label;

    if (view === 'week') {
      start = startOfWeek(anchor); end = addDays(start, 6);
      const wd = weekdays();
      for (let i = 0; i < 7; i++) {
        const day = addDays(start, i);
        points.push({ minutes: dayMin(s, day), tick: wd[i], full: day.getDate() + ' ' + M[day.getMonth()], future: day > today });
      }
      prevStart = addDays(start, -7); prevEnd = addDays(start, -1);
      label = start.getMonth() === end.getMonth()
        ? start.getDate() + '-' + end.getDate() + ' ' + M[end.getMonth()]
        : start.getDate() + ' ' + M[start.getMonth()] + ' - ' + end.getDate() + ' ' + M[end.getMonth()];
    } else if (view === 'month') {
      const y = anchor.getFullYear(), mo = anchor.getMonth();
      start = new Date(y, mo, 1); end = new Date(y, mo + 1, 0);
      const nd = end.getDate();
      for (let d = 1; d <= nd; d++) {
        const day = new Date(y, mo, d);
        // ticks: day 1, the last day, and every multiple of 5 - but drop a
        // multiple that sits right beside the last day (e.g. 30 next to 31, where
        // we keep the real last day 31).
        const show = d === 1 || d === nd || (d % 5 === 0 && d !== nd - 1);
        points.push({ minutes: dayMin(s, day), tick: show ? String(d) : '', full: d + ' ' + M[mo], future: day > today });
      }
      prevStart = new Date(y, mo - 1, 1); prevEnd = new Date(y, mo, 0);
      label = M[mo] + ' ' + y;
    } else { // year
      const y = anchor.getFullYear();
      start = new Date(y, 0, 1); end = new Date(y, 11, 31);
      for (let mo = 0; mo < 12; mo++) {
        const mk = y + '-' + pad(mo + 1);
        const fut = y > today.getFullYear() || (y === today.getFullYear() && mo > today.getMonth());
        points.push({ minutes: rangeTotal(s, mk + '-01', mk + '-31'), tick: M[mo].charAt(0), full: M[mo] + ' ' + y, future: fut });
      }
      prevStart = new Date(y - 1, 0, 1); prevEnd = new Date(y - 1, 11, 31);
      label = String(y);
    }

    const sKey = dateKey(start), eKey = dateKey(end);
    const total = rangeTotal(s, sKey, eKey);
    const activeDays = rangeActiveDays(s, sKey, eKey);
    const prevTotal = rangeTotal(s, dateKey(prevStart), dateKey(prevEnd));

    // null when there is no previous period to compare against (renders as '-')
    let deltaPct = null;
    if (prevTotal > 0) deltaPct = Math.round((total - prevTotal) / prevTotal * 100);

    const first = parseKey(sample.firstUse);
    return {
      points, label,
      total, prevTotal, allTime: s.totalMinutes || 0,
      avg: activeDays ? total / activeDays : 0,
      deltaPct,
      canPrev: periodStart(view, anchor) > periodStart(view, first),
      canNext: periodStart(view, anchor) < periodStart(view, today)
    };
  }

  // Shape-preserving cubic interpolation: smooth joins without dipping below
  // a local minimum (including the zero baseline) or overshooting a peak.
  function smoothPath(xs, ys) {
    const n = xs.length;
    if (!n) return '';
    if (n === 1) return 'M ' + xs[0] + ' ' + ys[0];
    const gaps = [], slopes = [], tangents = [];
    for (let i = 0; i < n - 1; i++) {
      gaps.push(xs[i + 1] - xs[i]);
      slopes.push((ys[i + 1] - ys[i]) / gaps[i]);
    }
    tangents[0] = slopes[0];
    tangents[n - 1] = slopes[n - 2];
    for (let i = 1; i < n - 1; i++) {
      const before = slopes[i - 1], after = slopes[i];
      const w1 = 2 * gaps[i] + gaps[i - 1], w2 = gaps[i] + 2 * gaps[i - 1];
      tangents[i] = before * after <= 0 ? 0 : (w1 + w2) / (w1 / before + w2 / after);
    }
    let d = 'M ' + xs[0].toFixed(1) + ' ' + ys[0].toFixed(1);
    for (let i = 0; i < n - 1; i++) {
      const step = gaps[i] / 3;
      d += ' C ' + (xs[i] + step).toFixed(1) + ' ' + (ys[i] + tangents[i] * step).toFixed(1) +
        ', ' + (xs[i + 1] - step).toFixed(1) + ' ' + (ys[i + 1] - tangents[i + 1] * step).toFixed(1) +
        ', ' + xs[i + 1].toFixed(1) + ' ' + ys[i + 1].toFixed(1);
    }
    return d;
  }

  function drawChart(points) {
    const chart = $('statsChart'), axis = $('statsAxis');
    if (!chart) return;
    const W = 1000, H = 300, padT = 22, padB = 26, innerH = H - padT - padB;
    const n = points.length;

    // line/area only over real (non-future) days; positions keep the full-period
    // spacing so past and current periods read at the same scale.
    const drawn = [];
    points.forEach((p, i) => { if (!p.future) drawn.push({ i, p }); });
    const max = Math.max(1, ...drawn.map(o => o.p.minutes));
    const xf = [], topf = [], dpts = [];
    const xs = [], ys = [];
    drawn.forEach(o => {
      const x = n === 1 ? W / 2 : (o.i / (n - 1)) * W;
      const y = padT + (1 - o.p.minutes / max) * innerH;
      xs.push(x); ys.push(y);
      xf.push(n === 1 ? 0.5 : o.i / (n - 1));
      topf.push(y / H);
      dpts.push(o.p);
    });

    let svg = '<svg class="stats-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="statsGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop class="grad-top" offset="0"/><stop class="grad-bot" offset="1"/>' +
      '</linearGradient></defs>';
    if (xs.length >= 2) {
      const line = smoothPath(xs, ys);
      const area = line + ' L ' + xs[xs.length - 1].toFixed(1) + ' ' + H + ' L ' + xs[0].toFixed(1) + ' ' + H + ' Z';
      svg += '<path class="stats-area" d="' + area + '"/><path class="stats-line" d="' + line + '"/>';
    }
    svg += '</svg>' +
      '<div class="scrub" id="statsScrub"><div class="scrub-line"></div><div class="scrub-dot"></div><div class="scrub-label"></div></div>';
    chart.innerHTML = svg;

    // single real day in the period (e.g. Monday in week view): no line spans, so
    // place a guide line + dot so the chart reads as "one day" instead of empty.
    if (xs.length === 1) {
      const lx = (xf[0] * 100).toFixed(2), ly = (topf[0] * 100).toFixed(2);
      const mk = document.createElement('div');
      mk.className = 'single-pt';
      mk.innerHTML = '<div class="sp-line" style="left:' + lx + '%"></div>' +
                     '<div class="sp-dot" style="left:' + lx + '%;top:' + ly + '%"></div>';
      chart.appendChild(mk);
    }

    // x-axis ticks span the full period (so the scale shows even where the curve
    // stops at today). First/last are edge-aligned to avoid clipping.
    let ax = '';
    points.forEach((p, i) => {
      if (!p.tick) return;
      const left = n === 1 ? 50 : (i / (n - 1)) * 100;
      const cls = i === 0 ? ' class="first"' : i === n - 1 ? ' class="last"' : '';
      ax += '<span' + cls + ' style="left:' + left.toFixed(2) + '%">' + p.tick + '</span>';
    });
    axis.innerHTML = ax;

    cur = { xf: xf, topf: topf, pts: dpts };
    wireScrub();
  }

  // ----- scrub (Apple-Health-style glowing label that follows the pointer) -----
  function wireScrub() {
    if (scrubWired) return; scrubWired = true;
    const chart = $('statsChart');
    const at = e => {
      if (!cur || !cur.xf.length) return;
      const r = chart.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      let k = 0, best = Infinity;
      for (let j = 0; j < cur.xf.length; j++) { const d = Math.abs(cur.xf[j] - f); if (d < best) { best = d; k = j; } }
      showScrub(k);
    };
    chart.addEventListener('pointermove', at);
    chart.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' && chart.setPointerCapture) chart.setPointerCapture(e.pointerId); at(e); });
    chart.addEventListener('pointerleave', hideScrub);
    chart.addEventListener('pointercancel', hideScrub);
    chart.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') hideScrub(); });
  }
  function showScrub(k) {
    const scrub = $('statsScrub'); if (!scrub || !cur) return;
    const left = cur.xf[k] * 100, top = cur.topf[k] * 100;
    scrub.classList.add('on');
    scrub.querySelector('.scrub-line').style.left = left + '%';
    const dot = scrub.querySelector('.scrub-dot');
    dot.style.left = left + '%'; dot.style.top = top + '%';
    const lab = scrub.querySelector('.scrub-label');
    lab.textContent = cur.pts[k].full + ' · ' + fmtMins(cur.pts[k].minutes);
    lab.style.left = Math.max(15, Math.min(85, left)) + '%';
  }
  function hideScrub() { const s = $('statsScrub'); if (s) s.classList.remove('on'); }

  // "vs previous" card: small coloured arrow + % (green up, coral down - fixed
  // colours, independent of the accent so "down" never turns green). Plain '-'
  // when there is no previous period to compare against.
  function renderDelta(p) {
    const el = $('statDelta');
    if (p.deltaPct == null) { el.textContent = '-'; return; }
    const up = p.deltaPct >= 0;
    el.innerHTML = '<span class="' + (up ? 'up' : 'down') + '">' +
      '<span class="arrow">' + (up ? '▲' : '▼') + '</span>' +
      Math.abs(p.deltaPct) + '%</span>';
  }

  // ----- render -----
  function render() {
    const p = buildPeriod();
    document.querySelectorAll('#statsViews .stats-view-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.view === view));
    $('statsPeriodLabel').textContent = p.label;
    $('statsPrev').disabled = !p.canPrev;
    $('statsNext').disabled = !p.canNext;
    $('statsHero').textContent = fmtMins(p.total);
    $('statAvg').textContent = fmtMins(p.avg);
    renderDelta(p);
    $('statTotal').textContent = fmtMins(p.allTime);
    drawChart(p.points);
  }

  function renderReport() { view = App.prefs.get('statsView') || 'month'; anchor = snapshotDate(); render(); }
  function setView(v) { if (v !== view) { view = v; anchor = snapshotDate(); App.prefs.set('statsView', v); render(); } }
  function nav(dir) {
    const today = snapshotDate(); today.setHours(0, 0, 0, 0);
    const first = parseKey(sample.firstUse);
    if (view === 'week') anchor = addDays(periodStart('week', anchor), dir * 7);
    else if (view === 'month') anchor = new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
    else anchor = new Date(anchor.getFullYear() + dir, 0, 1);
    if (anchor < first) anchor = new Date(first);
    if (anchor > today) anchor = new Date(today);
    render();
  }

  App.stats = { renderReport, setView, nav };
})(window.App = window.App || {});
