/* Home page: four small interactive labs (pendulum, projectile, float or sink, photosynthesis). They only run while they are on screen. */
(function () {
  'use strict';
  var panel = document.getElementById('labPanel'), tabs = document.getElementById('labTabs');
  if (!panel || !tabs) return;
  var h = BL.h, NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var C = { blue: '#2f8fe0', cyan: '#5cc8ff', gold: '#d9a017', green: '#1f9d55', red: '#d9432b', white: '#f2f7fc', mute: '#a9bdd1', line: 'rgba(255,255,255,.18)' };

  function s(tag, attrs, parent) { var e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (parent) parent.appendChild(e); return e; }
  function slider(id, label, min, max, step, val, fmt, on) {
    var out = h('b', { text: fmt(val) }), inp = h('input', { type: 'range', id: id, min: min, max: max, step: step, value: val });
    inp.addEventListener('input', function () { out.textContent = fmt(+inp.value); on(+inp.value); });
    return h('div', { class: 'sl' }, h('label', { for: id }, label, out), inp);
  }
  function choice(label, opts, val, on) {
    var box = h('div', { class: 'choice' }, h('span', { class: 'cl', text: label }));
    opts.forEach(function (o) {
      var b = h('button', { type: 'button', class: 'tab' + (o[0] === val ? ' on' : ''), text: o[1], onclick: function () { [].forEach.call(box.querySelectorAll('button'), function (x) { x.classList.remove('on'); }); b.classList.add('on'); on(o[0]); } });
      box.appendChild(b);
    });
    return box;
  }
  function readout(items) {
    var vals = items.map(function (x) { return h('b', { text: '—' }); });
    return { el: h('div', { class: 'readout' }, items.map(function (x, i) { return h('div', null, x, vals[i]); })), set: function (a) { a.forEach(function (t, i) { if (vals[i].textContent !== t) vals[i].textContent = t; }); } };
  }

  // ---------------------------------------------------------------- 1. pendulum
  function pendulum(box) {
    var st = { L: 1.5, g: 9.8, amp: 30 }, W = 420, px = 210, py = 20, ph = 0;
    var svg = s('svg', { viewBox: '0 0 420 230', role: 'img', 'aria-label': 'A swinging pendulum' });
    s('rect', { x: 120, y: 12, width: 180, height: 8, rx: 4, fill: '#c2d1e5' }, svg);
    var arc = s('path', { fill: 'none', stroke: 'rgba(92,200,255,.4)', 'stroke-dasharray': '4 5', 'stroke-width': 1.5 }, svg);
    var rod = s('line', { stroke: C.white, 'stroke-width': 2, 'stroke-linecap': 'round' }, svg);
    s('circle', { cx: px, cy: py, r: 4, fill: C.white }, svg);
    var bob = s('circle', { r: 15, fill: C.blue, stroke: C.cyan, 'stroke-width': 2 }, svg), shine = s('circle', { r: 4.5, fill: 'rgba(255,255,255,.55)' }, svg);
    var cnt = s('text', { x: 410, y: 222, 'text-anchor': 'end', fill: C.mute, 'font-size': 12 }, svg);
    var rd = readout(['Time for one swing, T', 'Swings per second, f', 'Swings in 10 s']);
    function draw(dt) {
      var T = 2 * Math.PI * Math.sqrt(st.L / st.g), a = st.amp * Math.PI / 180, Lp = 30 + st.L * 55;
      ph += 2 * Math.PI * dt / T;
      var th = a * Math.cos(ph), x = px + Lp * Math.sin(th), y = py + Lp * Math.cos(th);
      rod.setAttribute('x1', px); rod.setAttribute('y1', py); rod.setAttribute('x2', x); rod.setAttribute('y2', y);
      bob.setAttribute('cx', x); bob.setAttribute('cy', y); shine.setAttribute('cx', x - 4.5); shine.setAttribute('cy', y - 5);
      arc.setAttribute('d', 'M' + (px - Lp * Math.sin(a)) + ' ' + (py + Lp * Math.cos(a)) + ' A' + Lp + ' ' + Lp + ' 0 0 0 ' + (px + Lp * Math.sin(a)) + ' ' + (py + Lp * Math.cos(a)));
      cnt.textContent = 'Swings so far: ' + Math.floor(ph / (2 * Math.PI));
      rd.set([T.toFixed(2) + ' s', (1 / T).toFixed(2) + ' Hz', (10 / T).toFixed(1)]);
    }
    return { svg: svg, draw: draw,
      info: { cls: 'Class 8 · Motion and time', title: 'A longer string swings slower', text: 'Change the length, the planet and the angle. Notice that the weight of the bob is not in the formula, and that a big swing takes the same time as a small one.', formula: 'T = 2π √(L ÷ g)' },
      controls: [slider('pL', 'String length', 0.5, 3, 0.1, 1.5, function (v) { return v.toFixed(1) + ' m'; }, function (v) { st.L = v; }),
        slider('pA', 'Starting angle', 5, 60, 5, 30, function (v) { return v + '°'; }, function (v) { st.amp = v; }),
        choice('Where', [[9.8, 'Earth'], [1.6, 'Moon'], [24.8, 'Jupiter']], 9.8, function (v) { st.g = v; })], readout: rd.el };
  }

  // ---------------------------------------------------------------- 2. projectile (with a target)
  function projectile(box) {
    var st = { v: 25, a: 45 }, G = 10, K = 2.1, X0 = 22, GY = 198, t = 0, phase = 'fly', wait = 0, target = 95, msg = 'Aim for the flag';
    var svg = s('svg', { viewBox: '0 0 420 230', role: 'img', 'aria-label': 'A ball thrown at a target' });
    s('rect', { x: 0, y: GY, width: 420, height: 32, fill: 'rgba(31,157,85,.35)' }, svg);
    var guide = s('polyline', { fill: 'none', stroke: 'rgba(92,200,255,.45)', 'stroke-width': 1.6, 'stroke-dasharray': '3 5' }, svg);
    var flag = s('g', {}, svg); s('line', { x1: 0, y1: 0, x2: 0, y2: -34, stroke: C.white, 'stroke-width': 2 }, flag); s('path', { d: 'M0 -34 L18 -28 L0 -22 Z', fill: C.red }, flag);
    var tlabel = s('text', { y: GY + 20, 'text-anchor': 'middle', fill: C.mute, 'font-size': 11 }, svg);
    var trail = s('polyline', { fill: 'none', stroke: C.gold, 'stroke-width': 2, 'stroke-linecap': 'round' }, svg), pts = [];
    s('circle', { cx: X0, cy: GY, r: 5, fill: C.white }, svg);
    var ball = s('circle', { r: 8, fill: C.gold, stroke: '#fff', 'stroke-width': 1.5 }, svg);
    var note = s('text', { x: 410, y: 20, 'text-anchor': 'end', fill: C.white, 'font-size': 13, 'font-weight': 600 }, svg);
    var rd = readout(['Range', 'Highest point', 'Time in the air']);
    function metrics() { var r = st.a * Math.PI / 180, vx = st.v * Math.cos(r), vy = st.v * Math.sin(r); return { vx: vx, vy: vy, T: 2 * vy / G, R: vx * 2 * vy / G, H: vy * vy / (2 * G) }; }
    function place() { flag.setAttribute('transform', 'translate(' + (X0 + target * K) + ',' + GY + ')'); tlabel.setAttribute('x', X0 + target * K); tlabel.textContent = target + ' m'; }
    function guideLine() { var m = metrics(), p = []; for (var i = 0; i <= 40; i++) { var tt = m.T * i / 40; p.push((X0 + m.vx * tt * K).toFixed(1) + ',' + (GY - (m.vy * tt - 0.5 * G * tt * tt) * K).toFixed(1)); } guide.setAttribute('points', p.join(' ')); rd.set([m.R.toFixed(0) + ' m', m.H.toFixed(0) + ' m', m.T.toFixed(1) + ' s']); }
    function launch() { t = 0; phase = 'fly'; pts = []; msg = 'Aim for the flag'; }
    function newTarget() { target = 60 + Math.round(Math.random() * 90 / 5) * 5; place(); launch(); }
    function draw(dt) {
      var m = metrics();
      if (phase === 'fly') {
        t += dt * 1.5;
        if (t >= m.T) { t = m.T; phase = 'done'; wait = 1.8; var miss = m.R - target; msg = Math.abs(miss) <= 4 ? 'Hit! The ball landed on the flag' : 'Landed ' + Math.abs(miss).toFixed(0) + ' m ' + (miss > 0 ? 'past' : 'short of') + ' the flag'; }
      } else if (phase === 'done') { wait -= dt; if (wait <= 0) launch(); }
      var x = X0 + m.vx * t * K, y = GY - (m.vy * t - 0.5 * G * t * t) * K;
      ball.setAttribute('cx', x); ball.setAttribute('cy', Math.min(GY - 8, y));
      if (phase === 'fly') { pts.push(x.toFixed(1) + ',' + y.toFixed(1)); if (pts.length > 90) pts.shift(); } trail.setAttribute('points', pts.join(' '));
      note.textContent = msg; note.setAttribute('fill', msg.indexOf('Hit') === 0 ? '#7fe3b0' : C.white);
    }
    place(); guideLine();
    return { svg: svg, draw: draw,
      info: { cls: 'Class 9 · Motion', title: 'Hit the flag', text: 'Change the speed and the angle, then see where the ball lands. The dotted line shows the path before it flies. Which angle throws the farthest?', formula: 'Range = v² sin 2θ ÷ g' },
      controls: [slider('jV', 'Throwing speed', 10, 40, 1, 25, function (v) { return v + ' m/s'; }, function (v) { st.v = v; guideLine(); launch(); }),
        slider('jA', 'Angle', 10, 80, 5, 45, function (v) { return v + '°'; }, function (v) { st.a = v; guideLine(); launch(); }),
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary small', text: 'Throw again', onclick: launch }), h('button', { type: 'button', class: 'btn ghost small', text: 'New flag', onclick: newTarget }))], readout: rd.el };
  }

  // ---------------------------------------------------------------- 3. float or sink
  function floating(box) {
    var st = { d: 600, liq: 1000 }, SZ = 58, TOP = 78, BOT = 208, y = 40, t = 0, bubbles = [];
    var svg = s('svg', { viewBox: '0 0 420 230', role: 'img', 'aria-label': 'A block in a tank of liquid' });
    var liquid = s('rect', { x: 90, width: 240, fill: 'rgba(47,143,224,.45)' }, svg);
    var wave = s('path', { fill: 'rgba(92,200,255,.55)' }, svg);
    var cube = s('rect', { width: SZ, height: SZ, rx: 6, fill: '#c9a46a', stroke: '#fff', 'stroke-width': 2 }, svg), grain = s('path', { d: '', stroke: 'rgba(80,50,10,.5)', fill: 'none', 'stroke-width': 1.5 }, svg);
    var bl = s('g', {}, svg);
    s('path', { d: 'M90 60 V' + BOT + ' H330 V60', fill: 'none', stroke: C.white, 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg);
    var lab = s('text', { x: 210, text: '', 'text-anchor': 'middle', 'font-size': 12, fill: '#2b1d05', 'font-weight': 700 }, svg);
    var verdict = s('text', { x: 14, y: 30, fill: C.white, 'font-size': 15, 'font-weight': 700 }, svg), verdict2 = s('text', { x: 14, y: 48, fill: C.mute, 'font-size': 11.5 }, svg);
    var rd = readout(['Block density', 'Liquid density', 'Part under the liquid']);
    function draw(dt) {
      t += dt;
      var f = Math.min(1, st.d / st.liq), floats = st.d < st.liq, surf = TOP;
      var target = floats ? surf - (1 - f) * SZ + Math.sin(t * 2.2) * 2.5 : BOT - SZ - 2;
      y += (target - y) * Math.min(1, dt * (floats ? 4 : 2.2));
      liquid.setAttribute('y', surf); liquid.setAttribute('height', BOT - surf);
      var d = 'M90 ' + surf; for (var x = 90; x <= 330; x += 10) d += ' L' + x + ' ' + (surf + Math.sin(x / 22 + t * 2.4) * 2.4); d += ' V' + (surf + 12) + ' H90 Z'; wave.setAttribute('d', d);
      cube.setAttribute('x', 210 - SZ / 2); cube.setAttribute('y', y); grain.setAttribute('d', 'M' + (182 + 8) + ' ' + (y + 14) + ' h40 M' + (190) + ' ' + (y + 30) + ' h32 M' + (190) + ' ' + (y + 44) + ' h40');
      lab.setAttribute('y', y + SZ / 2 + 4); lab.textContent = st.d;
      if (!floats && Math.random() < dt * 5 && y > surf) bubbles.push({ x: 190 + Math.random() * 40, y: y + 6, r: 1.5 + Math.random() * 2 });
      while (bl.firstChild) bl.removeChild(bl.firstChild);
      bubbles = bubbles.filter(function (b) { b.y -= dt * 40; return b.y > surf; });
      bubbles.forEach(function (b) { s('circle', { cx: b.x, cy: b.y, r: b.r, fill: 'none', stroke: 'rgba(255,255,255,.7)' }, bl); });
      verdict.textContent = floats ? 'It floats' : st.d === st.liq ? 'It hangs' : 'It sinks'; verdict2.textContent = floats ? 'less dense than the liquid' : 'denser than the liquid';
      verdict.setAttribute('fill', floats ? '#7fe3b0' : '#ffb4a8');
      rd.set([st.d + ' kg/m³', st.liq + ' kg/m³', floats ? Math.round(f * 100) + ' %' : '100 %']);
    }
    return { svg: svg, draw: draw,
      info: { cls: 'Class 8 · Pressure and force', title: 'Will it float or sink?', text: 'Change how dense the block is and what liquid it is in. A block floats when it is less dense than the liquid, and the part under the surface matches the ratio of the two densities.', formula: 'Floats when ρ(block) < ρ(liquid)' },
      controls: [slider('fD', 'Block density', 200, 2500, 50, 600, function (v) { return v + ' kg/m³'; }, function (v) { st.d = v; }),
        choice('Liquid', [[800, 'Oil'], [1000, 'Water'], [1200, 'Salt water']], 1000, function (v) { st.liq = v; })], readout: rd.el };
  }

  // ---------------------------------------------------------------- 4. photosynthesis (limiting factor)
  function plant(box) {
    var st = { light: 70, co2: 40 }, t = 0, bub = [], co = [], acc = 0;
    var svg = s('svg', { viewBox: '0 0 420 230', role: 'img', 'aria-label': 'A water plant making oxygen bubbles' });
    var sun = s('g', { transform: 'translate(62,52)' }, svg), rays = s('g', {}, sun);
    for (var i = 0; i < 12; i++) s('line', { x1: 0, y1: -32, x2: 0, y2: -46, stroke: C.gold, 'stroke-width': 4, 'stroke-linecap': 'round', transform: 'rotate(' + i * 30 + ')' }, rays);
    var disc = s('circle', { r: 24, fill: C.gold }, sun);
    s('rect', { x: 150, y: 64, width: 190, height: 150, rx: 10, fill: 'rgba(47,143,224,.32)', stroke: C.white, 'stroke-width': 3 }, svg);
    var stems = s('g', {}, svg), parts = s('g', {}, svg);
    var gl = s('rect', { x: 150, y: 64, width: 190, height: 150, rx: 10, fill: '#ffe27a', opacity: 0 }, svg);
    var tip = s('text', { x: 245, y: 228, 'text-anchor': 'middle', fill: C.mute, 'font-size': 11.5 }, svg);
    var rd = readout(['Oxygen bubbles per minute', 'Holding it back', 'Light · CO₂']);
    function limit() { return Math.min(st.light, st.co2); }
    function draw(dt) {
      t += dt; acc += dt * limit() / 100 * 5;
      rays.setAttribute('transform', 'rotate(' + (t * 14) + ')'); rays.setAttribute('opacity', 0.15 + st.light / 130); disc.setAttribute('r', 20 + st.light / 25);
      gl.setAttribute('opacity', st.light / 100 * 0.14);
      while (stems.firstChild) stems.removeChild(stems.firstChild);
      for (var k = 0; k < 5; k++) { var bx = 190 + k * 28, sw = Math.sin(t * 1.4 + k) * 5; s('path', { d: 'M' + bx + ' 214 Q' + (bx + sw) + ' 170 ' + (bx + sw * 1.6) + ' 120', stroke: C.green, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, stems);
        for (var j = 0; j < 4; j++) { var yy = 196 - j * 24, xx = bx + sw * (1 - (yy - 120) / 94) * 1.2; s('ellipse', { cx: xx + (j % 2 ? 9 : -9), cy: yy, rx: 9, ry: 4, fill: '#2fbf7a', transform: 'rotate(' + (j % 2 ? 25 : -25) + ' ' + xx + ' ' + yy + ')' }, stems); } }
      while (acc >= 1) { acc -= 1; bub.push({ x: 188 + Math.random() * 110, y: 120 + Math.random() * 10, r: 2 + Math.random() * 2.2, v: 26 + Math.random() * 14 }); }
      if (Math.random() < dt * st.co2 / 100 * 7) co.push({ x: 156 + Math.random() * 178, y: 70, v: 14 + Math.random() * 10 });
      bub = bub.filter(function (b) { b.y -= dt * b.v; b.x += Math.sin(b.y / 9) * 0.25; return b.y > 66; });
      co = co.filter(function (c) { c.y += dt * c.v; return c.y < 190; });
      while (parts.firstChild) parts.removeChild(parts.firstChild);
      co.forEach(function (c) { s('text', { x: c.x, y: c.y, fill: '#cfdcea', 'font-size': 8, opacity: 0.85 }, parts).textContent = 'CO₂'; });
      bub.forEach(function (b) { s('circle', { cx: b.x, cy: b.y, r: b.r, fill: 'rgba(255,255,255,.28)', stroke: '#fff', 'stroke-width': 1.2 }, parts); });
      tip.textContent = 'Bubbles are oxygen made by the plant';
      var rate = Math.round(limit() * 0.6), why = st.light < st.co2 ? 'Light' : st.co2 < st.light ? 'Carbon dioxide' : 'Nothing: both are enough';
      rd.set([String(rate), limit() >= 100 ? 'Nothing' : why, st.light + '% · ' + st.co2 + '%']);
    }
    return { svg: svg, draw: draw,
      info: { cls: 'Class 7 · Plants and nutrition', title: 'What limits photosynthesis?', text: 'A plant needs light and carbon dioxide to make food and oxygen. Turn one up while the other stays low, and see that the scarcer one sets the speed.', formula: 'Carbon dioxide + water → food + oxygen (in light)' },
      controls: [slider('lL', 'Light', 0, 100, 10, 70, function (v) { return v + '%'; }, function (v) { st.light = v; }),
        slider('lC', 'Carbon dioxide', 0, 100, 10, 40, function (v) { return v + '%'; }, function (v) { st.co2 = v; })], readout: rd.el };
  }

  // ---------------------------------------------------------------- tabs + loop
  var LABS = [['Pendulum', pendulum], ['Projectile', projectile], ['Float or sink', floating], ['Photosynthesis', plant]], cur = null, visible = false, running = false, last = 0;
  function show(i) {
    [].forEach.call(tabs.children, function (b, k) { b.classList.toggle('on', k === i); b.setAttribute('aria-selected', k === i); });
    cur = LABS[i][1]();
    var inf = cur.info;
    panel.replaceChildren(
      h('div', null, h('div', { class: 'eyebrow', text: inf.cls }), h('h3', { class: 'lab-title', text: inf.title }), h('p', { class: 'lab-text', text: inf.text }), h('div', { class: 'formula', text: inf.formula }),
        h('div', { class: 'micro', style: 'margin-top:14px', text: 'This is one small lab. Every chapter has a set of them, with questions to check yourself.' })),
      h('div', { class: 'glow-card' }, h('div', { class: 'sketch' }, cur.svg), h('div', { class: 'sliders lab-controls' }, cur.controls), cur.readout));
    cur.draw(0); kick();
  }
  function loop(ts) {
    if (!visible || document.hidden || reduce) { running = false; return; }
    var dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    if (cur) cur.draw(dt);
    requestAnimationFrame(loop);
  }
  function kick() { if (!running && visible && !reduce) { running = true; last = performance.now(); requestAnimationFrame(loop); } }
  panel.addEventListener('input', function () { if (reduce && cur) cur.draw(0); });
  LABS.forEach(function (l, i) { tabs.appendChild(h('button', { class: 'tab', role: 'tab', type: 'button', text: l[0], onclick: function () { show(i); } })); });
  var sec = document.getElementById('labs');
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; kick(); }, { threshold: 0.15 }).observe(sec); else visible = true;
  document.addEventListener('visibilitychange', kick);
  show(0);
})();
