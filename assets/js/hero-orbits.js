/* PROPHET hero: teams in orbit
   Six rings share a centre just above the top-right corner, as in the Figma
   hero (frame "2", 1600 × 960). Each ring is a team, and dots travel round it.

   Every ring moves its own way. One ring always moves in lockstep (every dot at
   the same speed, evenly spaced). One ring always gives every dot its own
   speed, so they overtake each other. The rest fall somewhere in between, and
   which ring gets which is shuffled on each visit. */
(function () {
  'use strict';

  var canvas = document.getElementById('hero-orbits');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');

  /* ---------- Settings to play with ---------- */
  var SETTINGS = {
    // Dot colours, from the Figma hero
    colours: ['#F26F31', '#18A090', '#3D63DC', '#E6EDFE', '#FF6767', '#F9B830'],
    // Ring radii and centre, in Figma pixels (the frame is 1600 wide, 960 tall)
    radii: [227, 378, 530, 681, 833, 984],
    centreFromRight: 159,   // the centre sits this far in from the right edge
    centreY: -195,          // and this far above the top
    dotSize: 16,            // dot diameter in Figma pixels
    ringColour: 'rgba(255,255,255,0.2)',
    dotsPerRing: [8, 32],   // fewest and most dots on a ring (random in between)
    speed: [60, 180]        // typical travel speed range for a ring, Figma px per second
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU = Math.PI * 2;
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var W = 0, H = 0, dpr = 1, scale = 1, cx = 0, cy = 0;
  var rings = [];

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  /* ---------- Build the teams ---------- */
  function build() {
    var n = SETTINGS.radii.length;
    // How much each ring's dots differ in speed: 0 = lockstep, 1 = every dot its own pace.
    // Always one of each extreme; the rest somewhere in between.
    var spreads = [0, 1];
    for (var k = 2; k < n; k++) spreads.push(rand(0.15, 0.75));
    shuffle(spreads);

    rings = SETTINGS.radii.map(function (r, i) {
      var spread = spreads[i];
      var count = Math.round(rand(SETTINGS.dotsPerRing[0], SETTINGS.dotsPerRing[1]));
      if (spread === 0) count = Math.max(count, 12);      // the lockstep ring reads best with plenty of dots
      var dir = Math.random() < 0.7 ? 1 : -1;              // most go clockwise, some the other way
      var base = rand(SETTINGS.speed[0], SETTINGS.speed[1]) / r;   // radians per second
      var startAngle = rand(0, TAU);
      var dots = [];
      for (var d = 0; d < count; d++) {
        var even = startAngle + (d / count) * TAU;
        dots.push({
          // Lockstep dots are evenly spaced; others are scattered, more so the bigger the spread
          angle: even + rand(-1, 1) * spread * (TAU / count) * 2,
          // Each dot's own pace, around the ring's base speed
          // (on the free-for-all ring, from under half to over twice the base speed)
          speed: base * (1 + spread * rand(-0.6, 1.6)),
          // Free-spirited dots also speed up and slow down a little over time
          wobble: spread * 0.35, wobbleRate: rand(0.15, 0.5), wobblePhase: rand(0, TAU),
          colour: SETTINGS.colours[Math.floor(Math.random() * SETTINGS.colours.length)]
        });
      }
      return { r: r, dir: dir, spread: spread, dots: dots };
    });
  }

  /* ---------- Size: scale the Figma layout to the hero ---------- */
  function resize() {
    var box = canvas.getBoundingClientRect();
    W = box.width; H = box.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Match the Figma frame at 1600 × 960; shrink with the screen but stay readable on phones
    scale = Math.max(0.42, Math.min(W / 1600, H / 960));
    cx = W - SETTINGS.centreFromRight * scale;
    cy = SETTINGS.centreY * scale;
  }

  /* ---------- Draw ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1;
    ctx.strokeStyle = SETTINGS.ringColour;
    rings.forEach(function (ring) {
      ctx.beginPath();
      ctx.arc(cx, cy, ring.r * scale - 0.5, 0, TAU);
      ctx.stroke();
    });
    var dotR = (SETTINGS.dotSize / 2) * Math.max(scale, 0.6);
    rings.forEach(function (ring) {
      var r = ring.r * scale;
      ring.dots.forEach(function (d) {
        var x = cx + Math.cos(d.angle) * r, y = cy + Math.sin(d.angle) * r;
        if (x < -dotR || x > W + dotR || y < -dotR || y > H + dotR) return;   // off screen
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, TAU);
        ctx.fillStyle = d.colour;
        ctx.fill();
      });
    });
  }

  var time = 0;
  function step(dt) {
    time += dt;
    rings.forEach(function (ring) {
      ring.dots.forEach(function (d) {
        var pace = d.speed * (1 + d.wobble * Math.sin(time * d.wobbleRate + d.wobblePhase));
        d.angle += ring.dir * pace * dt;
      });
    });
  }

  /* ---------- Run, but only while the hero is on screen ---------- */
  var running = false, visible = true, last = 0;
  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    step(dt);
    draw();
    requestAnimationFrame(frame);
  }
  function update() {
    var shouldRun = !reduceMotion && visible && canvas.offsetParent !== null && !document.hidden;
    if (shouldRun && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    if (!shouldRun) running = false;
  }

  new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; update(); }).observe(canvas);
  document.addEventListener('visibilitychange', update);
  function onScreen() { setTimeout(function () { resize(); draw(); update(); }, 0); }
  window.addEventListener('hashchange', onScreen);
  window.addEventListener('prophet:screen', onScreen);
  window.addEventListener('resize', function () { resize(); draw(); });

  build();
  resize();
  if (reduceMotion) {
    // A still frame: spread the dots out a little so it isn't just the start positions
    step(20);
  }
  draw();
  update();

  // Handy for tweaking from the browser console, and for testing
  window.PROPHET_ORBITS = { settings: SETTINGS, rings: function () { return rings; }, rebuild: function () { build(); resize(); draw(); }, step: step, draw: draw };
})();
