/* Efficiency versus Empathy: one pinned scene (Figma 7018:616)

   The intro lockup (Tension 1 of 3, Efficiency VERSUS Empathy, Rated Poised)
   sits centred on the screen and stays pinned. Scrolling plays the story:
     1. three bare rings rise up from below and settle with VERSUS in the
        middle of the middle ring, while the Rated Poised line fades away
     2. coloured dots fade in and travel round the rings (same speed, uneven
        gaps), "Fast, linear and on track" fades in under Efficiency, and the
        Empathy headline dims to half strength
     3. after a little more scroll they swap: "Stopping to relate" fades in
        under Empathy, Empathy comes back to full strength and Efficiency dims
        to half, and the dots stop and pulse (soft solid circles growing out,
        each dot at its own pace)
     4. it holds, then the pale section below slides up over the whole scene
   Scrolling back up plays it in reverse. The dots keep moving at whatever
   speed the scroll has reached, so they don't freeze when you stop scrolling.

   The pinned stretch is worked out from the timings below, so this script sets
   the height of .t1ring itself; the pale panel (.t1x-panel) overlaps its last
   screenful in the CSS. With reduced motion nothing pins: the rings sit in
   place with still dots, and both lines of subcopy show. */
(function () {
  'use strict';

  var pin = document.getElementById('t1-ring');
  if (!pin) return;
  var section = pin.closest('[data-step]') || pin;
  var stage = pin.querySelector('.t1ring-stage');
  var canvas = pin.querySelector('canvas');
  var vs = pin.querySelector('.t1x-vs');
  var rated = pin.querySelector('.t1x-rated');
  var wordEff = pin.querySelector('.t1x-a'), wordEmp = pin.querySelector('.t1x-b');
  var subEff = pin.querySelector('.t1x-sub--eff');
  var subEmp = pin.querySelector('.t1x-sub--emp');
  var ctx = canvas.getContext('2d');

  /* ---------- Settings to play with (sizes in Figma pixels, where the outer ring is 800 across) ---------- */
  var SETTINGS = {
    rings: [500, 650, 800],     // ring diameters, inner to outer (shown at 90% of this)
    dotsPerRing: [8, 12, 16],   // dots on each ring, inner to outer
    minGap: 0.4,                // dots are unevenly spaced, but never closer than this share of an even gap
    ringColour: 'rgba(255,255,255,0.3)',
    dotColours: ['#3D63DC', '#FF6767'],   // Prophet Bright blue and Accreditation Coral red, picked at random per dot
    dotSize: 14.4,              // dot diameter
    speed: 500,                 // how fast the dots travel, px per second (same on every ring)
    trail: 3,                   // faint copies behind each dot while it's moving (0 = none)
    pulseEvery: [1.4, 3.2],     // seconds for one pulse to ripple out: each dot picks its own pace in this range
    pulseRings: 2,              // ripples on their way out at once, per dot
    pulseSize: 12,              // how far a ripple grows, as a multiple of the dot's size
    pulseOpacity: 0.2,          // pulses are solid circles, starting at this opacity
    dimWord: 0.5,               // the headline word that isn't in focus drops to this opacity

    // Timing, in px of scroll. The rings rise one for one with the scroll, then:
    ratedFade: [0.35, 0.8],     // Rated Poised fades out over this part of the rings' rise
    dotsIn: 260,                // dots and Efficiency's line fade in over this much, ending just after the rings settle
    effHold: 500,               // Efficiency's line holds for this much
    swap: 160,                  // then fades out while Empathy's fades in, and the dots slow to a stop
    pulseOver: 100,             // pulses fade in over this much after the swap
    pulseHold: 500              // and hold for this much before the pale section slides up
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) pin.classList.add('is-static');
  var TAU = Math.PI * 2, TOP = -Math.PI / 2;
  var W = 0, H = 0, dpr = 1, ringPx = 720;
  var travelled = 0, time = 0, scrolled = 0, at = {};
  var dots = [];

  function clamp(v) { return Math.max(0, Math.min(1, v)); }
  function ease(t) { return t * t * (3 - 2 * t); }
  function span(from, over) { return ease(clamp((scrolled - from) / over)); }

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

  // The outer ring's size on screen: resolve the stage's --ring calc() on a hidden element
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

  // Work out the story in px of scroll (0 = the scene has just pinned), and size the pin to fit it
  function layout() {
    var s = SETTINGS, topH = bars(), vh = window.innerHeight, stageH = stage.offsetHeight;
    var st = stage.getBoundingClientRect(), v = vs.getBoundingClientRect();
    var outer = s.rings[2] / 2 * ringPx / 800;
    var cx = v.left + v.width / 2 - st.left, cy = v.top + v.height / 2 - st.top;   // the rings settle centred on VERSUS
    var start = stageH + outer + 8;                    // ...starting just out of sight below the stage
    var rise = start - cy;
    var settled = rise;
    var effOut = settled + s.dotsIn * 0.4 + s.effHold;
    var change = effOut + s.swap;
    var panel = change + s.pulseOver + s.pulseHold;
    var travel = panel + vh - topH;                    // the pale panel rises from the screen's bottom until it covers the stage
    at = { cx: cx, cy: cy, rise: rise, settled: settled, effOut: effOut, change: change, panel: panel };
    var want = Math.round(stageH + travel);
    if (Math.abs(pin.offsetHeight - want) > 1) pin.style.height = want + 'px';
  }

  function readScroll() {
    var topH = bars();
    scrolled = topH - pin.getBoundingClientRect().top;   // px scrolled into the pin
  }

  function ringY() { return reduceMotion ? at.cy : at.cy + Math.max(0, at.rise - scrolled); }
  function dotsNow() { return reduceMotion ? 1 : span(at.settled - SETTINGS.dotsIn * 0.6, SETTINGS.dotsIn); }
  function speedNow() { return 1 - span(at.effOut, SETTINGS.swap); }
  function pulseNow() { return span(at.change, SETTINGS.pulseOver); }

  function text() {
    if (reduceMotion) return;
    var s = SETTINGS;
    rated.style.opacity = (1 - span(at.rise * s.ratedFade[0], at.rise * (s.ratedFade[1] - s.ratedFade[0]))).toFixed(3);
    var effIn = dotsNow(), swap = span(at.effOut, s.swap), dim = 1 - s.dimWord;
    subEff.style.opacity = (effIn * (1 - span(at.effOut, s.swap * 0.6))).toFixed(3);
    subEmp.style.opacity = span(at.effOut + s.swap * 0.4, s.swap * 0.6).toFixed(3);
    // The word not in focus dims (as its colour, so the subcopy under it stays full white)
    wordEmp.style.color = 'rgba(255,255,255,' + (1 - dim * effIn * (1 - swap)).toFixed(3) + ')';
    wordEff.style.color = 'rgba(255,255,255,' + (1 - dim * swap).toFixed(3) + ')';
  }

  function draw() {
    var s = SETTINGS, k = ringPx / 800, cx = at.cx, cy = ringY(), r = s.dotSize / 2 * k;
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = s.ringColour; ctx.lineWidth = 1;
    s.rings.forEach(function (d) { ctx.beginPath(); ctx.arc(cx, cy, d / 2 * k, 0, TAU); ctx.stroke(); });

    var show = dotsNow();
    if (show <= 0.001) return;
    var v = reduceMotion ? 0 : speedNow();
    var pulse = reduceMotion ? 0 : pulseNow();
    for (var i = 0; i < dots.length; i++) {
      var dot = dots[i], R = dot.r * k;
      // Same travel speed on every ring, so the outer rings turn a little slower
      var a = (dot.offset + travelled / (TAU * dot.r)) * TAU + TOP;
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
          ctx.globalAlpha = show * s.pulseOpacity * pulse * (1 - f * f);   // stays near full strength, then fades at the edge
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
    layout();
    readScroll();
    text();
    draw();
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

  // Handy for tweaking from the browser console, and for testing
  window.PROPHET_T1_RING = { settings: SETTINGS, refresh: tick, timing: function () { return at; }, scrolled: function () { return scrolled; }, dots: dots.length };
})();
