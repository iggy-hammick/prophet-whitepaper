/* Welcome hero background (test): one grid of dots, using the Stability rules
   from Tension 2 (tension-grid.js).

   The grid fills the hero, its outer dots 64px in from every edge (24px on
   phones), with as many dots as keeps the gaps between them close to 40px.
   Dots near the mouse are drawn in towards it a little and tremble while
   they're held, then settle straight back with no bounce when it moves on.

   This replaces the spiral for now; the spiral's markup is parked in a comment
   in index.html, so swapping back is a matter of uncommenting it. */
(function () {
  'use strict';

  var canvas = document.getElementById('hero-grid');
  if (!canvas) return;
  var hero = canvas.parentElement;
  var ctx = canvas.getContext('2d');

  /* ---------- Settings to play with ---------- */
  var SETTINGS = {
    dotColour: '#505B7D',
    dotSize: 8,               // dot diameter, px
    gap: 40,                  // target space between neighbouring dots, edge to edge, px
    inset: 64,                // gap from the hero's edges to the outer dots' edges, px
    phoneInset: 24,
    phoneWidth: 820,
    reach: 320,               // how far from the mouse dots feel it, px
    pull: 24,                 // how far the dots move towards the mouse at most, px
    tremble: 1.6,             // how far a held dot shakes, px (strongest nearest the mouse)
    trembleSpeed: 55,         // how fast it shakes
    spring: 260,              // how strongly they pull back (higher is firmer)
    damping: 34               // how quickly they settle (high = no bounce)
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU = Math.PI * 2;
  var W = 0, H = 0, dpr = 1, dotR = 4;
  var dots = [];
  var mouse = { x: -1e5, y: -1e5 };
  var time = 0;

  function layout() {
    var box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    W = box.width; H = box.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    dotR = SETTINGS.dotSize / 2;
    var inset = W <= SETTINGS.phoneWidth ? SETTINGS.phoneInset : SETTINGS.inset;
    var left = inset + dotR, right = W - inset - dotR, top = inset + dotR, bottom = H - inset - dotR;
    var pitch = SETTINGS.gap + SETTINGS.dotSize;
    var cols = Math.max(2, Math.round((right - left) / pitch) + 1);
    var rows = Math.max(2, Math.round((bottom - top) / pitch) + 1);
    var pitchX = (right - left) / (cols - 1), pitchY = (bottom - top) / (rows - 1);
    dots = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var hx = left + c * pitchX, hy = top + r * pitchY;
        dots.push({ hx: hx, hy: hy, x: hx, y: hy, vx: 0, vy: 0, held: 0,
          phase: Math.random() * TAU, rate: 0.8 + Math.random() * 0.4 });
      }
    }
    return true;
  }

  function step(dt) {
    time += dt;
    var s = SETTINGS;
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var dx = d.hx - mouse.x, dy = d.hy - mouse.y;
      var dist = Math.hypot(dx, dy);
      var tx = d.hx, ty = d.hy, f = 0;
      if (dist < s.reach && dist > 0.001) {
        f = 1 - dist / s.reach;
        f = f * f * (3 - 2 * f);
        // Drawn in towards the mouse, never more than halfway to it
        var amount = -Math.min(s.pull * f, dist * 0.5);
        tx += (dx / dist) * amount;
        ty += (dy / dist) * amount;
      }
      d.held += (f - d.held) * Math.min(1, dt * 8);   // eases the tremble in and out
      d.vx += ((tx - d.x) * s.spring - d.vx * s.damping) * dt;
      d.vy += ((ty - d.y) * s.spring - d.vy * s.damping) * dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = SETTINGS.dotColour;
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i], jx = 0, jy = 0;
      if (d.held > 0.01 && !reduceMotion) {
        var t = time * SETTINGS.trembleSpeed * d.rate + d.phase, amp = SETTINGS.tremble * d.held;
        jx = (Math.sin(t) + 0.5 * Math.sin(t * 2.3 + 1)) * amp;
        jy = (Math.cos(t * 1.7) + 0.5 * Math.sin(t * 2.9 + 2)) * amp;
      }
      ctx.beginPath(); ctx.arc(d.x + jx, d.y + jy, dotR, 0, TAU); ctx.fill();
    }
  }

  /* ---------- Mouse ---------- */
  window.addEventListener('pointermove', function (e) {
    var box = canvas.getBoundingClientRect();
    mouse.x = e.clientX - box.left; mouse.y = e.clientY - box.top;
  }, { passive: true });
  function clearMouse() { mouse.x = mouse.y = -1e5; }
  hero.addEventListener('pointerleave', clearMouse);
  window.addEventListener('blur', clearMouse);
  window.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') clearMouse(); });

  /* ---------- Run only while the hero is on screen ---------- */
  var running = false, visible = false, last = 0;
  function frame(now) {
    if (!running) return;
    var elapsed = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    var n = Math.ceil(elapsed / 0.008);
    for (var k = 0; k < n; k++) step(elapsed / n);
    draw();
    requestAnimationFrame(frame);
  }
  function refresh() { if (layout()) draw(); }
  function update() {
    var shown = canvas.offsetParent !== null;
    if (shown && !dots.length) refresh();
    var shouldRun = !reduceMotion && visible && shown && !document.hidden;
    if (shouldRun && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    if (!shouldRun) running = false;
  }
  function onScreen() { setTimeout(function () { refresh(); update(); }, 0); }

  new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; if (visible) refresh(); update(); }).observe(canvas);
  document.addEventListener('visibilitychange', update);
  window.addEventListener('hashchange', onScreen);
  window.addEventListener('prophet:screen', onScreen);
  window.addEventListener('resize', refresh);

  refresh();
  update();

  // Handy for tweaking from the browser console, and for testing
  window.PROPHET_HERO_GRID = { settings: SETTINGS, dots: function () { return dots; }, mouse: mouse, step: step, draw: draw, refresh: refresh };
})();
