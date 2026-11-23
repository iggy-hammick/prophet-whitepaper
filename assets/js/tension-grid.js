/* Tension 2 hero: Stability vs Agility, two dot grids
   Two grids of small dots, in the Tension 1 dot colour, fill the hero behind
   the content: Stability on the left half, Agility on the right, with a 120px
   gap down the middle. The outer dots sit 64px in from the screen edges, 64px
   below the top bar's bottom line and 64px above the bottom of the screen
   (24px on phones). Each grid fits as many dots as keeps the gaps between them
   as close to 40px as possible.

   Each grid has its own rules, whichever side the mouse is on:
   - Stability (left): dots near the mouse are drawn in towards it a little and
     tremble while they're held, then settle straight back with no bounce when
     the mouse moves on.
   - Agility (right): the mouse shoves the dots away as it moves through them,
     a short way (about 8% of the screen's width), and they spring back with some bounce. The
     shove only lasts while the mouse is moving, so they always return, even if
     the mouse stops on top of them. */
(function () {
  'use strict';

  var hero = document.getElementById('t2-hero');
  var canvas = document.getElementById('t2-scene');
  if (!hero || !canvas) return;
  var ctx = canvas.getContext('2d');

  /* ---------- Settings to play with ---------- */
  var SETTINGS = {
    dotColour: '#505B7D',
    dotSize: 8,               // dot diameter, px
    gap: 40,                  // target space between neighbouring dots, edge to edge, px
    inset: 64,                // gap from the screen edges (and the top bar) to the outer dots' edges, px
    phoneInset: 24,           // the same on phones
    phoneWidth: 820,
    middleGap: 120,           // space between the two grids, px

    // Stability (left grid): firm and structured; dots are drawn towards the mouse and tremble
    stability: {
      reach: 320,             // how far from the mouse dots feel it, px
      pull: 24,               // how far the dots move towards the mouse at most, px
      tremble: 1.6,           // how far a held dot shakes, px (strongest nearest the mouse)
      trembleSpeed: 55,       // how fast it shakes
      spring: 260,            // how strongly they pull back (higher is firmer)
      damping: 34             // how quickly they settle (high = no bounce)
    },
    // Agility (right grid): loose and bouncy; dots are shoved away
    agility: {
      reach: 220,             // how far from the mouse dots feel it, px
      push: 0.08,             // how far the dots are shoved, as a share of the screen's width
      spring: 38,
      damping: 5.5            // low = lots of bounce
    },
    // The Agility shove fades when the mouse stops, so the dots always return
    fullPushSpeed: 120,       // mouse speed (px per second) that gives the full push
    pushFade: 6               // how quickly the push dies away once the mouse slows (higher is quicker)
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU = Math.PI * 2;
  var W = 0, H = 0, dpr = 1, dotR = 8;
  var dots = [];
  var mouse = { x: -1e5, y: -1e5 };
  var time = 0;
  var activity = 0;           // 0 = mouse still, 1 = mouse moving; scales the push
  var lastMouse = { x: -1e5, y: -1e5 };

  /* ---------- Layout: two grids, a 64px inset, a 120px gap between them, ~40px between dots ---------- */
  function layout() {
    var box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    W = box.width; H = box.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    dotR = SETTINGS.dotSize / 2;
    var phone = W <= SETTINGS.phoneWidth;
    // Fill the hero: outer dot edges 64px from the screen edges and below the top bar
    var bar = document.querySelector('.top');
    var barB = bar ? bar.offsetHeight : 72;   // the top bar sits over the top of the hero
    var inset = phone ? SETTINGS.phoneInset : SETTINGS.inset;
    var top = barB + inset + dotR, bottom = H - inset - dotR;
    var half = SETTINGS.middleGap / 2;
    var areas = [
      { side: 'stability', left: inset + dotR, right: W / 2 - half - dotR },
      { side: 'agility', left: W / 2 + half + dotR, right: W - inset - dotR }
    ];
    // Each grid: as many dots as keep the gaps closest to 40px, then spread exactly edge to edge
    var pitch = SETTINGS.gap + SETTINGS.dotSize;
    var rows = Math.max(2, Math.round((bottom - top) / pitch) + 1);
    var pitchY = (bottom - top) / (rows - 1);
    var next = [];
    areas.forEach(function (area) {
      var cols = Math.max(2, Math.round((area.right - area.left) / pitch) + 1);
      var pitchX = (area.right - area.left) / (cols - 1);
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          next.push({ side: area.side, hx: area.left + c * pitchX, hy: top + r * pitchY });
        }
      }
    });
    var keep = dots.length === next.length;
    dots = next.map(function (n, i) {
      var o = keep ? dots[i] : null;
      n.x = o ? o.x - o.hx + n.hx : n.hx; n.y = o ? o.y - o.hy + n.hy : n.hy;
      n.vx = o ? o.vx : 0; n.vy = o ? o.vy : 0;
      n.held = 0; n.phase = Math.random() * TAU; n.rate = 0.8 + Math.random() * 0.4;
      return n;
    });
    return true;
  }

  /* ---------- Motion ---------- */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function step(dt) {
    time += dt;
    var s = SETTINGS.stability, a = SETTINGS.agility;
    // How much the mouse is moving right now: the Agility shove follows it and dies away when it stops
    var moved = (lastMouse.x > -1e4 && mouse.x > -1e4) ? Math.hypot(mouse.x - lastMouse.x, mouse.y - lastMouse.y) : 0;
    lastMouse.x = mouse.x; lastMouse.y = mouse.y;
    var speedNow = dt > 0 ? Math.min(1, moved / dt / SETTINGS.fullPushSpeed) : 0;
    // Rise quickly when the mouse moves, fade at pushFade when it stops
    activity += (speedNow - activity) * Math.min(1, dt * (speedNow > activity ? 20 : SETTINGS.pushFade));
    var shove = a.push * W * activity;

    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var stable = d.side === 'stability';
      var rule = stable ? s : a;
      var dx = d.hx - mouse.x, dy = d.hy - mouse.y;
      var dist = Math.hypot(dx, dy);
      var tx = d.hx, ty = d.hy, f = 0;
      if (dist < rule.reach && dist > 0.001) {
        f = 1 - dist / rule.reach;
        f = f * f * (3 - 2 * f);
        // Stability: drawn in towards the mouse, never more than halfway to it.
        // Agility: shoved straight away from it.
        var amount = stable ? -Math.min(s.pull * f, dist * 0.5) : shove * f;
        tx += (dx / dist) * amount;
        ty += (dy / dist) * amount;
      }
      if (stable) d.held += (f - d.held) * Math.min(1, dt * 8);   // eases the tremble in and out
      // Spring towards that spot
      var ax = (tx - d.x) * rule.spring - d.vx * rule.damping;
      var ay = (ty - d.y) * rule.spring - d.vy * rule.damping;
      d.vx += ax * dt; d.vy += ay * dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = SETTINGS.dotColour;
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var jx = 0, jy = 0;
      if (d.held > 0.01 && !reduceMotion) {
        // Held Stability dots tremble, more the closer they are to the mouse
        var t = time * SETTINGS.stability.trembleSpeed * d.rate + d.phase, amp = SETTINGS.stability.tremble * d.held;
        jx = (Math.sin(t) + 0.5 * Math.sin(t * 2.3 + 1)) * amp;
        jy = (Math.cos(t * 1.7) + 0.5 * Math.sin(t * 2.9 + 2)) * amp;
      }
      ctx.beginPath(); ctx.arc(d.x + jx, d.y + jy, dotR, 0, TAU); ctx.fill();
    }
  }

  /* ---------- Mouse ---------- */
  function setMouse(e) {
    var box = canvas.getBoundingClientRect();
    mouse.x = e.clientX - box.left; mouse.y = e.clientY - box.top;
  }
  function clearMouse() { mouse.x = mouse.y = -1e5; }
  window.addEventListener('pointermove', setMouse, { passive: true });
  hero.addEventListener('pointerleave', clearMouse);
  window.addEventListener('blur', clearMouse);
  window.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') clearMouse(); });

  /* ---------- Run only while the hero is on screen ---------- */
  var running = false, visible = false, last = 0;
  function frame(now) {
    if (!running) return;
    // Small fixed steps keep the springs stable even if a frame runs long
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
  window.PROPHET_T2 = {
    settings: SETTINGS, dots: function () { return dots; }, mouse: mouse,
    step: step, draw: draw, refresh: refresh
  };
})();
