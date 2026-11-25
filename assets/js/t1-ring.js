/* Efficiency versus Empathy: the pinned ring
   A ring of dots sits under the "Rated Poised" line. When it reaches the middle
   of the screen it pins in place, and scrolling plays it through:
     1. the dots start still, then speed up around the ring the further you
        scroll, and the first line of text comes up below
     2. they slow down and stop
     3. they start to pulse, and the second line of text replaces the first
     4. it holds for a moment, then unpins and the page carries on
   Scrolling back up plays it in reverse. The dots keep moving at whatever
   speed the scroll has reached, so they don't freeze if you stop scrolling.

   The stretch of scrolling it takes is set by the height of .t1ring in the CSS.
   With reduced motion it doesn't pin: the ring is static and both lines show. */
(function () {
  'use strict';

  var pin = document.getElementById('t1-ring');
  if (!pin) return;
  var stage = pin.querySelector('.t1ring-stage');
  var canvas = pin.querySelector('canvas');
  var caps = pin.querySelectorAll('.t1ring-cap');
  var ctx = canvas.getContext('2d');

  /* ---------- Settings to play with ---------- */
  var SETTINGS = {
    dots: 24,                 // how many dots around the ring
    dotSize: 12,              // dot diameter, px
    dotColour: '#505B7D',
    ringColour: '#D5DBEA',
    ringRadius: 0.36,         // ring radius as a share of the canvas size
    topSpeed: 1.6,            // fastest spin, turns per second
    trail: 6,                 // faint copies behind each dot when it's moving fast (0 = none)
    pulseEvery: 1.8,          // seconds for one pulse to grow out
    pulseRings: 2,            // pulses on their way out at once
    pulseSize: 4,             // how far a pulse grows, as a multiple of the dot's radius
    pulseOpacity: 0.35,       // how solid a pulse starts (it fades as it grows)
    pulseWave: 0,             // 0 = every dot pulses together; 1 = a wave runs once round the ring per pulse

    // The story, as shares of the pinned scroll (0 = just pinned, 1 = about to unpin)
    speedUp: [0.04, 0.40],    // dots go from still to top speed
    slowDown: [0.40, 0.56],   // and from top speed back to still
    firstText: [0.16, 0.56],  // first line shows between these points
    pulseIn: [0.60, 0.68],    // pulses fade in
    secondText: 0.64          // second line shows from here on
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) pin.classList.add('is-static');
  var TAU = Math.PI * 2;
  var W = 0, dpr = 1;
  var angle = 0, time = 0, progress = 0;

  function clamp(v) { return Math.max(0, Math.min(1, v)); }
  function ease(t) { return t * t * (3 - 2 * t); }
  function between(p, r) { return clamp((p - r[0]) / (r[1] - r[0])); }

  // Keep the sticky stage between the top bar and the bottom navigation
  function bars() {
    var top = document.querySelector('.top'), nav = document.querySelector('.navbar');
    var t = top && top.offsetParent !== null ? top.offsetHeight : 0;
    var n = nav && nav.offsetParent !== null ? nav.offsetHeight : 0;
    pin.style.setProperty('--t1-top', t + 'px');
    pin.style.setProperty('--t1-nav', n + 'px');
    return t;
  }

  function size() {
    var box = canvas.getBoundingClientRect();
    if (!box.width) return false;
    var d = Math.min(window.devicePixelRatio || 1, 2);
    if (box.width !== W || d !== dpr) {
      W = box.width; dpr = d;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(W * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return true;
  }

  function readScroll() {
    var topH = bars();
    var r = pin.getBoundingClientRect();
    var travel = r.height - stage.offsetHeight;
    progress = travel > 0 ? clamp((topH - r.top) / travel) : 0;
  }

  function speedNow() {
    var s = SETTINGS, p = progress;
    if (p < s.slowDown[0]) return ease(between(p, s.speedUp));
    return 1 - ease(between(p, s.slowDown));
  }

  function captions() {
    var s = SETTINGS, p = progress;
    caps[0].classList.toggle('on', reduceMotion || (p >= s.firstText[0] && p < s.firstText[1]));
    caps[1].classList.toggle('on', reduceMotion || p >= s.secondText);
  }

  function draw() {
    if (!size()) return;
    var s = SETTINGS, c = W / 2, R = W * s.ringRadius, r = s.dotSize / 2;
    ctx.clearRect(0, 0, W, W);
    ctx.strokeStyle = s.ringColour; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.stroke();

    var v = reduceMotion ? 0 : speedNow();
    var pulse = reduceMotion ? 0 : ease(between(progress, s.pulseIn));
    ctx.fillStyle = s.dotColour;
    for (var i = 0; i < s.dots; i++) {
      var a = angle + (i / s.dots) * TAU - Math.PI / 2;
      var x = c + Math.cos(a) * R, y = c + Math.sin(a) * R;

      // A fading trail behind the dot, longer the faster it's going
      if (s.trail && v > 0.05) {
        for (var k = 1; k <= s.trail; k++) {
          var b = a - k * v * 0.045;
          ctx.globalAlpha = 0.35 * v * (1 - k / (s.trail + 1));
          ctx.beginPath(); ctx.arc(c + Math.cos(b) * R, c + Math.sin(b) * R, r * (1 - k * 0.06), 0, TAU); ctx.fill();
        }
      }
      // Pulses growing out from the dot
      if (pulse > 0.01) {
        var cycle = time / s.pulseEvery - s.pulseWave * (i / s.dots);
        for (var n = 0; n < s.pulseRings; n++) {
          var t = ((cycle + n / s.pulseRings) % 1 + 1) % 1;
          var grow = 1 - Math.pow(1 - t, 3);
          ctx.globalAlpha = s.pulseOpacity * pulse * Math.pow(1 - t, 2);
          ctx.beginPath(); ctx.arc(x, y, r + r * (s.pulseSize - 1) * grow, 0, TAU); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  }

  /* ---------- Run only while it's on screen ---------- */
  var running = false, visible = false, last = 0;
  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    time += dt;
    readScroll();
    angle += speedNow() * SETTINGS.topSpeed * TAU * dt;
    captions();
    draw();
    requestAnimationFrame(frame);
  }
  function update() {
    var shouldRun = !reduceMotion && visible && !document.hidden;
    if (shouldRun && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    if (!shouldRun) running = false;
  }
  function refresh() { bars(); readScroll(); captions(); draw(); }

  new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; if (visible) refresh(); update(); }).observe(pin);
  document.addEventListener('visibilitychange', update);
  window.addEventListener('resize', refresh);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  refresh();

  // Handy for tweaking from the browser console, and for testing
  window.PROPHET_T1_RING = { settings: SETTINGS, refresh: refresh, progress: function () { return progress; } };
})();
