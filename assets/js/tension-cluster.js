/* Tension 3 hero: Proximity vs Engagement, the cluster
   Based on the client's demo, in the same style as Tension 1: soft #505B7D
   dots that pulse with fading solid discs.

   - Proximity side (mouse on the left half, or no mouse): a tight cluster of
     dots in the middle of the hero pulses together, while a few dots out
     towards the corners pulse on their own, each to its own rhythm. Close
     together, others alone.
   - Engagement side (mouse on the right half): the outlying dots all set off at
     once, travel in and land in the cluster with a little bounce, and the whole
     group falls into step, pulsing together. Move back to Proximity and they
     glide out to their own spots again.

   Every dot meanders gently around its spot the whole time.

   Which side you're on comes from tension-orbits.js, which sets .is-empathy on
   the hero when the mouse is on the right half. */
(function () {
  'use strict';

  var hero = document.getElementById('t3-hero');
  var canvas = document.getElementById('t3-scene');
  if (!hero || !canvas) return;
  var ctx = canvas.getContext('2d');

  /* ---------- Settings to play with ---------- */
  var SETTINGS = {
    dotColour: '#505B7D',
    dotSize: 16,              // dot diameter in Figma px (scales down on smaller screens, as on Tension 1)
    clusterDots: 7,           // in the middle from the start
    // The outliers on Proximity, as shares of the hero's width and height
    outliers: [[0.1, 0.27], [0.9, 0.24], [0.13, 0.8], [0.87, 0.79], [0.7, 0.15]],
    spacing: 50,              // how far apart the cluster's dots sit, Figma px

    // Pulses (as on Tension 1's Empathy side)
    pulseEvery: 2.2,          // seconds for one pulse to grow out
    pulseRings: 2,            // how many pulses are on their way out at once
    pulseSize: 11,            // how far a pulse grows, as a multiple of the dot's radius
    pulseOpacity: 0.3,        // how solid a pulse starts (it fades as it grows)

    // Coming together: the outliers all set off at once and spring into place
    spring: 26,               // how strongly they're pulled to where they're going (higher is quicker)
    bounceIn: 4.2,            // damping on the way in (lower = more bounce when they arrive)
    settleOut: 9,             // damping on the way back out (higher = smooth, no bounce)

    // Wandering: every dot meanders gently around its spot
    wander: 12,               // how far a dot can stray, px
    wanderSpeed: 0.35         // how quickly it meanders
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU = Math.PI * 2;
  var GOLDEN = Math.PI * (3 - Math.sqrt(5));   // sunflower spacing for the cluster
  var W = 0, H = 0, dpr = 1, scale = 1, dotR = 8;
  var dots = [];
  var time = 0;

  function build() {
    var total = SETTINGS.clusterDots + SETTINGS.outliers.length;
    dots = [];
    for (var i = 0; i < total; i++) {
      var outlier = i >= SETTINGS.clusterDots;
      dots.push({
        slot: i,                                        // place in the full cluster (sunflower order)
        out: outlier ? SETTINGS.outliers[i - SETTINGS.clusterDots] : null,
        // Cluster dots share one beat; outliers each keep their own until they join
        beat: outlier ? Math.random() : 0,
        x: null, y: null, vx: 0, vy: 0,                 // outliers: where they are now (spring physics)
        // Each dot's own meander: two slow waves per axis, so the path never quite repeats
        wx: Math.random() * TAU, wy: Math.random() * TAU, wx2: Math.random() * TAU, wy2: Math.random() * TAU,
        ws: 0.7 + Math.random() * 0.6
      });
    }
  }

  function layout() {
    var box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    W = box.width; H = box.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.max(0.45, W / 1600);
    dotR = (SETTINGS.dotSize / 2) * Math.max(scale, 0.65);
    // Put the outliers straight where they should be for the current side
    var engaged = hero.classList.contains('is-empathy');
    dots.forEach(function (d) {
      if (!d.out) return;
      var t = engaged ? slotPos(d.slot) : outPos(d);
      d.x = t.x; d.y = t.y; d.vx = d.vy = 0;
    });
    return true;
  }

  // Sunflower layout: slot 0 in the middle, each later slot a little further out
  function slotPos(i) {
    var r = SETTINGS.spacing * Math.max(scale, 0.65) * Math.sqrt(i + 0.5);
    var a = i * GOLDEN;
    return { x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r };
  }

  function outPos(d) { return { x: d.out[0] * W, y: d.out[1] * H }; }

  function step(dt) {
    time += dt;
    var engaged = hero.classList.contains('is-empathy');
    // Outliers all head off together and spring to where they're going:
    // a bounce as they arrive in the cluster, a smooth glide back out
    var damping = engaged ? SETTINGS.bounceIn : SETTINGS.settleOut;
    dots.forEach(function (d) {
      if (!d.out || d.x === null) return;
      var t = engaged ? slotPos(d.slot) : outPos(d);
      d.vx += ((t.x - d.x) * SETTINGS.spring - d.vx * damping) * dt;
      d.vy += ((t.y - d.y) * SETTINGS.spring - d.vy * damping) * dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
    });
  }

  // How far along its way into the cluster an outlier is (0 out on its own, 1 in place)
  function joined(d) {
    var o = outPos(d), s = slotPos(d.slot);
    var full = Math.hypot(s.x - o.x, s.y - o.y) || 1;
    return Math.max(0, Math.min(1, 1 - Math.hypot(s.x - d.x, s.y - d.y) / full));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var reach = dotR * SETTINGS.pulseSize;
    var n = SETTINGS.pulseRings;

    dots.forEach(function (d) {
      var home = slotPos(d.slot);
      var x = home.x, y = home.y, k = 1;
      if (d.out && d.x !== null) { x = d.x; y = d.y; k = joined(d); }
      if (!reduceMotion) {
        // Meander gently around the spot, never more than the wander allowance
        var w = SETTINGS.wander, sp = SETTINGS.wanderSpeed * d.ws;
        x += (Math.sin(time * sp + d.wx) * 0.7 + Math.sin(time * sp * 2.3 + d.wx2) * 0.3) * w;
        y += (Math.cos(time * sp * 0.9 + d.wy) * 0.7 + Math.sin(time * sp * 1.9 + d.wy2) * 0.3) * w;
      }

      // Pulse: outliers ease into the cluster's beat as they join (the short way round)
      var beat = d.beat;
      if (d.out) { var diff = ((0 - beat) % 1 + 1.5) % 1 - 0.5; beat = beat + diff * k; }
      if (!reduceMotion) {
        var cycle = time / SETTINGS.pulseEvery + beat;
        ctx.fillStyle = SETTINGS.dotColour;
        for (var r = 0; r < n; r++) {
          var t = ((cycle + r / n) % 1 + 1) % 1;
          var grow = 1 - Math.pow(1 - t, 3);
          ctx.beginPath();
          ctx.arc(x, y, dotR + (reach - dotR) * grow, 0, TAU);
          ctx.globalAlpha = SETTINGS.pulseOpacity * Math.pow(1 - t, 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = SETTINGS.dotColour;
      ctx.beginPath(); ctx.arc(x, y, dotR, 0, TAU); ctx.fill();
    });
  }

  /* ---------- Run only while the hero is on screen ---------- */
  var running = false, visible = false, last = 0;
  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    step(dt); draw();
    requestAnimationFrame(frame);
  }
  function refresh() { if (layout()) draw(); }
  function update() {
    var shown = canvas.offsetParent !== null;
    if (shown && !W) refresh();
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

  build();
  refresh();
  update();

  // Handy for tweaking from the browser console, and for testing
  window.PROPHET_T3 = {
    settings: SETTINGS, dots: function () { return dots; },
    step: step, draw: draw, refresh: refresh, rebuild: function () { build(); refresh(); }
  };
})();
