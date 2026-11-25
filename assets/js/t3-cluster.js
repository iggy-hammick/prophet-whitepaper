/* Proximity versus Engagement: the cluster (Tension 3)

   The same pinned lockup as the other tensions, but the dots form a cluster.
   Scrolling plays the story:
     1. the Rated line fades away; 6 dots rise up from below the screen and
        spread out inside a 500px circle centred on VERSUS, while 5 more
        settle much further out, scattered (3 roughly across the top, 2 lower
        down)
     2. once settled they jostle gently and pulse (soft solid circles, each
        dot at its own pace). A dotted circle fades in round the 6,
        "Close together, others alone." lifts in under Proximity (with its
        arrow) and Engagement dims to 25%
     3. at the swap the dotted circle grows to 600px and the 5 outer dots
        travel in to join the 6 inside it, settling in the spaces between them
        (the 6 stay put), as Engagement comes back to full strength, Proximity
        dims and "Reaching out, pulling in." lifts in
     4. it holds, then the light blue section below slides up over the scene
   Scrolling back plays it all in reverse.

   Shares its layout and styles with the other scenes (.t1ring in index.html);
   this script sets the pin's height from the timings below. With reduced
   motion nothing pins: the dots sit still in their first places with the
   circle round the group, and both lines of subcopy show. */
(function () {
  'use strict';

  var pin = document.querySelector('.t1ring--cluster');
  if (!pin) return;
  var section = pin.closest('[data-step]') || pin;
  var stage = pin.querySelector('.t1ring-stage');
  var canvas = pin.querySelector('canvas');
  var title = pin.querySelector('.t1x-title');
  var vs = pin.querySelector('.t1x-vs');
  var rated = pin.querySelector('.t1x-rated');
  var wordA = pin.querySelector('.t1x-a'), wordB = pin.querySelector('.t1x-b');
  var subA = pin.querySelector('.t1x-sub--eff'), subB = pin.querySelector('.t1x-sub--emp');
  var arrows = window.ProphetArrows ? window.ProphetArrows(pin) : null;   // right-angle arrows from the words to the subcopy (t-arrows.js)
  var ctx = canvas.getContext('2d');

  /* ---------- Settings to play with (sizes in design px at the 1600-wide layout; positions from the middle of VERSUS) ---------- */
  var SETTINGS = {
    dotColours: ['#3D63DC', '#FF6767'],   // Prophet Bright blue and Accreditation Coral red, shared out evenly (in a random order)
    dotSize: 26,                // dot diameter
    circle: 500,                // the dotted circle round the inner group...
    circleGrown: 600,           // ...and how big it grows as the outer dots come in
    // The inner group: 6 places spread round inside the circle, kept far enough in that their pulses stay inside it
    inner: [[-132, -114], [53, -167], [163, -26], [-172, 35], [-53, 132], [106, 141]],
    // The outer dots: scattered well away, 3 roughly across the top and 2 lower down...
    outer: [[-620, -240], [-90, -300], [470, -255], [-520, 240], [380, 260]],
    // ...and where they settle inside the grown circle, in the spaces between the 6 (pulses inside the ring too)
    outerIn: [[-206, -80], [-64, -213], [194, -106], [-201, 93], [184, 125]],
    jostle: 3,                  // how far the settled dots wander, px at design size
    pulseEvery: [1.4, 3.2],     // seconds for one pulse to grow out: each dot picks its own pace in this range
    pulseRings: 2,              // pulses on their way out at once, per dot
    pulseSize: 5,               // how far a pulse grows, as a multiple of the dot's size
    pulseOpacity: 0.2,          // pulses are solid circles, starting at this opacity
    lineColour: 'rgba(255,255,255,0.6)',
    dimWord: 0.25,              // the word not in focus drops to this opacity
    subLift: 24,                // subcopy rises this far as it fades in
    wordLift: 10,               // and its word rises this far with it

    // Timing, in px of scroll from when the scene pins
    ratedOut: [0, 300],         // Rated line fades out
    riseStart: 100,             // the first inner dot starts to rise
    riseEach: 520,              // each dot's rise into place takes this much scroll
    riseStagger: 45,            // the next dot starts this much later (inner dots first, then outer)
    circleIn: 260,              // the dotted circle and Proximity's line fade in over this much, as the last dots settle
    hold: 450,                  // the Proximity moment holds for this much
    circleGrow: 300,            // at the swap the circle grows over this much
    moveEach: 420,              // each outer dot's trip into the circle takes this much
    moveStagger: 50,
    swap: 260,                  // the subcopy and word dimming swap over this much, as the circle goes
    endHold: 450                // everything holds this long before the light blue section slides up
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) pin.classList.add('is-static');
  var W = 0, H = 0, dpr = 1, scrolled = 0, at = {};

  // The dots: inner first (they stay put), then outer (they travel in at the swap)
  // Colours shared out evenly (6 and 5 for 11 dots), then shuffled
  var total = SETTINGS.inner.length + SETTINGS.outer.length, colours = [];
  for (var c = 0; c < total; c++) colours.push(SETTINGS.dotColours[c % SETTINGS.dotColours.length]);
  for (c = colours.length - 1; c > 0; c--) { var j = Math.floor(Math.random() * (c + 1)), tmp = colours[c]; colours[c] = colours[j]; colours[j] = tmp; }
  var dots = SETTINGS.inner.concat(SETTINGS.outer).map(function (p, i) {
    var outer = i >= SETTINGS.inner.length;
    return {
      home: p, end: outer ? SETTINGS.outerIn[i - SETTINGS.inner.length] : p, outer: outer, order: outer ? i - SETTINGS.inner.length : 0,
      colour: colours[i],
      seed: Math.random() * 100, rate: 0.6 + Math.random() * 0.6,
      pulseEvery: SETTINGS.pulseEvery[0] + Math.random() * (SETTINGS.pulseEvery[1] - SETTINGS.pulseEvery[0]), pulsePhase: Math.random()
    };
  });

  function clamp(v) { return Math.max(0, Math.min(1, v)); }
  function ease(t) { return t * t * (3 - 2 * t); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function span(from, over) { return ease(clamp((scrolled - from) / over)); }
  function lin(from, over) { return clamp((scrolled - from) / over); }

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
    return true;
  }

  function layout() {
    var s = SETTINGS, topH = bars(), vh = window.innerHeight, st = stage.getBoundingClientRect();
    var k = parseFloat(getComputedStyle(title).fontSize) / 112.9;   // design px to screen px
    var v = vs.getBoundingClientRect();
    var n = dots.length;
    var settled = s.riseStart + (n - 1) * s.riseStagger + s.riseEach;
    var swapAt = settled + s.hold;
    var moveFrom = swapAt + s.circleGrow * 0.3;
    var moved = moveFrom + (s.outer.length - 1) * s.moveStagger + s.moveEach;
    var panel = moved + s.endHold;
    var travel = panel + vh - topH;
    at = { k: k, cx: v.left + v.width / 2 - st.left, cy: v.top + v.height / 2 - st.top, stageH: st.height,
           settled: settled, swapAt: swapAt, moveFrom: moveFrom, moved: moved, panel: panel };
    var want = Math.round(st.height + travel);
    if (Math.abs(pin.offsetHeight - want) > 1) pin.style.height = want + 'px';
  }

  function readScroll() { scrolled = bars() - pin.getBoundingClientRect().top; }

  function text() {
    if (reduceMotion) return;
    var s = SETTINGS, k = at.k;
    rated.style.opacity = (1 - span(s.ratedOut[0], s.ratedOut[1] - s.ratedOut[0])).toFixed(3);
    var inA = span(at.settled - s.circleIn, s.circleIn), swap = span(at.swapAt, s.swap), dim = 1 - s.dimWord;
    var outA = span(at.swapAt, s.swap * 0.6), inB = span(at.swapAt + s.swap * 0.4, s.swap * 0.6);
    subA.style.opacity = (inA * (1 - outA)).toFixed(3);
    subB.style.opacity = inB.toFixed(3);
    if (arrows) arrows.update(inA, inA * (1 - outA), inB, inB);
    subA.style.transform = 'translateY(' + ((1 - inA) * s.subLift * k).toFixed(1) + 'px)';
    subB.style.transform = 'translateY(' + ((1 - inB) * s.subLift * k).toFixed(1) + 'px)';
    wordA.style.transform = 'translateY(' + (-inA * (1 - swap) * s.wordLift * k).toFixed(1) + 'px)';
    wordB.style.transform = 'translateY(' + (-swap * s.wordLift * k).toFixed(1) + 'px)';
    wordB.style.color = 'rgba(255,255,255,' + (1 - dim * inA * (1 - swap)).toFixed(3) + ')';
    wordA.style.color = 'rgba(255,255,255,' + (1 - dim * swap).toFixed(3) + ')';
  }

  function draw() {
    var s = SETTINGS, k = at.k, r = s.dotSize / 2 * k, now = performance.now() / 1000;
    ctx.clearRect(0, 0, W, H);

    // Where each dot is now (before jostle), and how settled it is
    var places = dots.map(function (d, i) {
      var hx = at.cx + d.home[0] * k, hy = at.cy + d.home[1] * k;
      if (reduceMotion) return { x: hx, y: hy, calm: 0, shown: true };
      // Rise from just below the stage into its place
      var rise = easeOut(lin(s.riseStart + i * s.riseStagger, s.riseEach));
      var startY = at.stageH + r * 2 + 40 * k;
      var x = hx, y = startY + (hy - startY) * rise;
      // At the swap the outer dots travel in to their places inside the grown circle
      if (d.outer) {
        var m = ease(lin(at.moveFrom + d.order * s.moveStagger, s.moveEach));
        if (m > 0) { x = hx + (at.cx + d.end[0] * k - hx) * m; y = hy + (at.cy + d.end[1] * k - hy) * m; }
      }
      return { x: x, y: y, calm: rise >= 1 ? 1 : rise * rise, shown: rise > 0 };
    });

    // The dotted circle round the inner group, growing as the outer dots come in
    var circle = reduceMotion ? 1 : span(at.settled - s.circleIn, s.circleIn);
    if (circle > 0.001) {
      var grow = reduceMotion ? 0 : span(at.swapAt, s.circleGrow);
      var radius = (s.circle + (s.circleGrown - s.circle) * grow) / 2 * k * (0.94 + 0.06 * circle);
      ctx.save();
      ctx.globalAlpha = circle; ctx.strokeStyle = s.lineColour; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.setLineDash([0.1, 9 * k]);
      ctx.beginPath(); ctx.arc(at.cx, at.cy, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // The dots: pulsing and jostling a little once they've settled
    var pulse = reduceMotion ? 0 : span(at.settled - s.circleIn, s.circleIn);
    dots.forEach(function (d, i) {
      var p = places[i];
      if (!p.shown) return;
      var amp = reduceMotion ? 0 : s.jostle * k * p.calm;
      var x = p.x + amp * (Math.sin(now * 1.3 * d.rate + d.seed) + 0.5 * Math.sin(now * 2.9 * d.rate + d.seed * 2));
      var y = p.y + amp * (Math.cos(now * 1.1 * d.rate + d.seed * 1.5) + 0.5 * Math.cos(now * 2.3 * d.rate + d.seed * 3));
      ctx.fillStyle = d.colour;
      if (pulse > 0.01) {
        for (var n = 0; n < s.pulseRings; n++) {
          var f = ((now / d.pulseEvery + d.pulsePhase + n / s.pulseRings) % 1 + 1) % 1;
          var g = 1 - Math.pow(1 - f, 3);
          ctx.globalAlpha = s.pulseOpacity * pulse * (1 - f * f);   // stays near full strength, then fades at the edge
          ctx.beginPath(); ctx.arc(x, y, r + r * (s.pulseSize - 1) * g, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    });
  }

  function tick() {
    if (!size()) return false;
    layout(); readScroll(); text(); draw();
    return true;
  }

  /* ---------- Run only while it's on screen ---------- */
  var running = false, visible = false;
  function frame() { if (!running) return; tick(); requestAnimationFrame(frame); }
  function update() {
    var shouldRun = !reduceMotion && visible && !document.hidden;
    if (shouldRun && !running) { running = true; requestAnimationFrame(frame); }
    if (!shouldRun) running = false;
  }
  new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) tick(); update(); }).observe(pin);
  document.addEventListener('visibilitychange', update);
  window.addEventListener('resize', tick);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(tick);
  tick();

  window.PROPHET_T3_CLUSTER = { settings: SETTINGS, refresh: tick, timing: function () { return at; }, scrolled: function () { return scrolled; } };
})();
