/* 01B: Efficiency versus Empathy, the earlier version (an option for the client)

   Unlike Tension 1's single pinned scene, here the title scrolls away like
   ordinary page content and only the rings pin:
     1. three bare rings sit about 200px under the Rated line and scroll up
        with the page
     2. as the bottom of the outer ring comes onto the screen, the top of the
        "Efficiency / Fast, linear, on track." caption comes up from the bottom
        edge on the left, and blue and red dots fade in, travelling round the
        rings (all at the same speed, unevenly spaced)
     3. the rings pin in the middle of the screen. Efficiency keeps scrolling up
        past them, with "Empathy / Stopping to relate." following on the right,
        the height of the middle ring behind
     4. the moment Efficiency reaches the top of the middle ring, Empathy is at
        its bottom: the dots stop and pulse (soft solid circles, each dot at its
        own pace)
     5. Empathy keeps scrolling up, and once it's level with the middle of the
        rings the pale panel below slides up over them until it covers them
   Scrolling back up plays it all in reverse.

   The pinned stretch is worked out from that timing, so this script sets the
   height of .t1b-ring itself; the pale panel (.t1b-panel) overlaps its last
   screenful in the CSS. With reduced motion nothing pins: the rings and dots
   are still, and both captions show. */
(function () {
  'use strict';

  var pin = document.getElementById('t1b-ring');
  if (!pin) return;
  var section = pin.closest('[data-step]') || pin;
  var stage = pin.querySelector('.t1b-stage');
  var canvas = pin.querySelector('canvas');
  var capEff = pin.querySelector('.t1b-cap--eff');
  var capEmp = pin.querySelector('.t1b-cap--emp');
  var ctx = canvas.getContext('2d');

  /* ---------- Settings to play with (sizes in Figma px, where the outer ring is 800 across) ---------- */
  var SETTINGS = {
    rings: [500, 650, 800],     // ring diameters, inner to outer (shown at 90% of this)
    dotsPerRing: [8, 12, 16],   // dots on each ring, inner to outer
    minGap: 0.4,                // dots are unevenly spaced, but never closer than this share of an even gap
    ringColour: 'rgba(255,255,255,0.3)',
    dotColours: ['#3D63DC', '#FF6767'],   // Prophet Bright blue and Accreditation Coral red, picked at random per dot
    dotSize: 14.4,              // dot diameter
    speed: 500,                 // how fast the dots travel, px per second (same on every ring)
    trail: 3,                   // faint copies behind each dot while it's moving (0 = none)
    pulseEvery: [1.4, 3.2],     // seconds for one pulse to grow out: each dot picks its own pace in this range
    pulseRings: 2,              // pulses on their way out at once, per dot
    pulseSize: 12,              // how far a pulse grows, as a multiple of the dot's size
    pulseOpacity: 0.2,          // pulses are solid circles, starting at this opacity

    // Timing, in px of scroll
    dotsFadeOver: 220,          // the dots fade in over this much scroll, from when Efficiency appears
    stopOver: 140,              // the dots slow to a stop over this much, ending as the captions straddle the middle ring
    pulseOver: 100              // and the pulses fade in over this much after that
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) pin.classList.add('is-static');
  var TAU = Math.PI * 2, TOP = -Math.PI / 2;
  var W = 0, H = 0, dpr = 1, ringPx = 720;
  var travelled = 0, time = 0, scrolled = 0, at = { enter: 0, change: 1, end: 1 };
  var dots = [];

  function clamp(v) { return Math.max(0, Math.min(1, v)); }
  function ease(t) { return t * t * (3 - 2 * t); }

  // Dots on each ring: uneven gaps (never too close), a random colour each, their own pulse pace
  SETTINGS.rings.forEach(function (d, ring) {
    var n = SETTINGS.dotsPerRing[ring], gaps = [], sum = 0, i;
    for (i = 0; i < n; i++) { var g = SETTINGS.minGap + Math.random() * (2 - 2 * SETTINGS.minGap); gaps.push(g); sum += g; }
    var pos = Math.random();
    for (i = 0; i < n; i++) {
      dots.push({
        r: d / 2, offset: pos % 1, colour: SETTINGS.dotColours[Math.floor(Math.random() * SETTINGS.dotColours.length)],
        pulseEvery: SETTINGS.pulseEvery[0] + Math.random() * (SETTINGS.pulseEvery[1] - SETTINGS.pulseEvery[0]),
        pulsePhase: Math.random()
      });
      pos += gaps[i] / sum;
    }
  });

  // The outer ring's size on screen: resolve the --ring calc() on a hidden element
  var measure = document.createElement('div');
  measure.style.cssText = 'position:absolute;visibility:hidden;width:var(--ring);height:0';
  stage.appendChild(measure);

  function bars() {
    var top = document.querySelector('.top'), nav = document.querySelector('.navbar');
    var t = top && top.offsetParent !== null ? top.offsetHeight : 0;
    var n = nav && nav.offsetParent !== null ? nav.offsetHeight : 0;
    section.style.setProperty('--t1-top', t + 'px');
    section.style.setProperty('--t1-nav', n + 'px');
    return t;
  }

  function size() {
    var box = canvas.getBoundingClientRect();
    if (!box.width) return false;
    var d = Math.min(window.devicePixelRatio || 1, 2);
    if (box.width !== W || box.height !== H || d !== dpr) {
      W = box.width; H = box.height; dpr = d;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ringPx = measure.getBoundingClientRect().width || Math.min(W * 0.83, H * 0.8, 720);
    return true;
  }

  // Work out the story in px of scroll (0 = the rings have just pinned), and size the pin to fit it
  function layout() {
    var topH = bars(), vh = window.innerHeight, stageH = stage.offsetHeight, k = ringPx / 800;
    var centre = stageH / 2, mid = SETTINGS.rings[1] / 2 * k, outer = SETTINGS.rings[2] / 2 * k;
    var enter = topH + centre + outer - vh;            // bottom of the outer ring reaches the bottom of the screen
    var change = enter + vh - (topH + centre - mid);    // Efficiency has risen to the top of the middle ring
    var end = change + mid;                             // Empathy has risen to the middle of the rings
    var travel = end + vh - topH;                       // the pale panel rises from the screen's bottom until it covers the stage
    at = { topH: topH, vh: vh, centre: centre, mid: mid, enter: enter, change: change, end: end };
    var want = Math.round(stageH + travel);
    if (Math.abs(pin.offsetHeight - want) > 1) pin.style.height = want + 'px';
  }

  function readScroll() { scrolled = bars() - pin.getBoundingClientRect().top; }   // px into the pin (negative before it pins)

  function dotsNow() { return ease(clamp((scrolled - at.enter) / SETTINGS.dotsFadeOver)); }
  function speedNow() { return 1 - ease(clamp((scrolled - (at.change - SETTINGS.stopOver)) / SETTINGS.stopOver)); }
  function pulseNow() { return ease(clamp((scrolled - at.change) / SETTINGS.pulseOver)); }

  // Captions move up the screen one for one with the scroll, as if they were ordinary page content
  function captions() {
    if (reduceMotion) return;
    var stageTop = stage.getBoundingClientRect().top;
    var effY = at.vh - (scrolled - at.enter) - stageTop;   // Efficiency's top, within the stage
    capEff.style.transform = 'translateY(' + effY.toFixed(1) + 'px)';
    capEmp.style.transform = 'translateY(' + (effY + 2 * at.mid).toFixed(1) + 'px)';
    capEff.style.visibility = capEmp.style.visibility = 'visible';
  }

  function draw() {
    var s = SETTINGS, k = ringPx / 800, cx = W / 2, cy = H / 2, r = s.dotSize / 2 * k;
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = s.ringColour; ctx.lineWidth = 1;
    s.rings.forEach(function (d) { ctx.beginPath(); ctx.arc(cx, cy, d / 2 * k, 0, TAU); ctx.stroke(); });

    var show = reduceMotion ? 1 : dotsNow();
    if (show <= 0.001) return;
    var v = reduceMotion ? 0 : speedNow();
    var pulse = reduceMotion ? 0 : pulseNow();
    for (var i = 0; i < dots.length; i++) {
      var dot = dots[i], R = dot.r * k;
      var a = (dot.offset + travelled / (TAU * dot.r)) * TAU + TOP;   // same travel speed on every ring
      var x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      ctx.fillStyle = dot.colour;
      if (s.trail && v > 0.05) {
        for (var t = 1; t <= s.trail; t++) {
          var b = a - t * v * (s.dotSize * 0.7) / dot.r;
          ctx.globalAlpha = show * 0.3 * v * (1 - t / (s.trail + 1));
          ctx.beginPath(); ctx.arc(cx + Math.cos(b) * R, cy + Math.sin(b) * R, r * (1 - t * 0.1), 0, TAU); ctx.fill();
        }
      }
      if (pulse > 0.01) {
        for (var n = 0; n < s.pulseRings; n++) {
          var f = ((time / dot.pulseEvery + dot.pulsePhase + n / s.pulseRings) % 1 + 1) % 1;
          var grow = 1 - Math.pow(1 - f, 3);
          ctx.globalAlpha = show * s.pulseOpacity * pulse * (1 - f * f);
          ctx.beginPath(); ctx.arc(x, y, r + r * (s.pulseSize - 1) * grow, 0, TAU); ctx.fill();
        }
      }
      ctx.globalAlpha = show;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function tick() {
    if (!size()) return false;
    layout(); readScroll(); captions(); draw();
    return true;
  }

  /* ---------- Run only while it's on screen ---------- */
  var running = false, visible = false, last = 0;
  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    time += dt;
    travelled += speedNow() * SETTINGS.speed * dt / (ringPx / 800 || 1);   // px on screen per second
    tick();
    requestAnimationFrame(frame);
  }
  function update() {
    var shouldRun = !reduceMotion && visible && !document.hidden;
    if (shouldRun && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    if (!shouldRun) running = false;
  }

  new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; if (visible) tick(); update(); }).observe(pin);
  document.addEventListener('visibilitychange', update);
  window.addEventListener('resize', tick);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(tick);
  tick();

  window.PROPHET_T1B_RING = { settings: SETTINGS, refresh: tick, timing: function () { return at; }, scrolled: function () { return scrolled; } };
})();
