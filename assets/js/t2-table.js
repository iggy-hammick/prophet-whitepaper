/* Stability versus Agility: the table (Tension 2)

   The same pinned lockup as the other tensions, but instead of rings the dots
   sit on two platforms. Scrolling plays the story:
     1. the Rated line fades away and two platforms rise up from the bottom of
        the screen, one under each word with a gap between them. They run off
        the bottom, so only their left, top and right edges show
     2. 10 dots fade in where they sit on the Stability platform, stacked in two
        rows of 5 (one straight on top of the other), building up from the
        bottom row, as "Still until the
        ground shakes." lifts in centred below the title, with an arrow from Stability,
        and Agility dims to 25%
     3. the pile starts to tremble, then at the swap the dots jump one after
        another from the top of the pile, high over "Tension 2 of 3", and
        restack from the bottom up as a pyramid (4, 3, 2, 1) on the Agility platform, as Agility comes
        back to full strength, Stability dims and the Agility line lifts in
     4. it holds, then the light blue section below slides up over the scene
   Scrolling back plays it all in reverse.

   Shares its layout and styles with the ring scenes (.t1ring in index.html);
   this script sets the pin's height from the timings below. With reduced
   motion nothing pins: the platforms and dots sit still under Stability and both
   lines of subcopy show. */
(function () {
  'use strict';

  var pin = document.querySelector('.t1ring--table');
  if (!pin) return;
  var section = pin.closest('[data-step]') || pin;
  var stage = pin.querySelector('.t1ring-stage');
  var canvas = pin.querySelector('canvas');
  var title = pin.querySelector('.t1x-title');
  var kick = pin.querySelector('.t1x-kick');
  var rated = pin.querySelector('.t1x-rated');
  var wordA = pin.querySelector('.t1x-a'), wordB = pin.querySelector('.t1x-b');
  var subA = pin.querySelector('.t1x-sub--eff'), subB = pin.querySelector('.t1x-sub--emp');
  var arrows = window.ProphetArrows ? window.ProphetArrows(pin) : null;   // right-angle arrows from the words to the subcopy (t-arrows.js)
  var ctx = canvas.getContext('2d');

  /* ---------- Settings to play with (sizes in design px at the 1600-wide layout) ---------- */
  var SETTINGS = {
    rowsFrom: [5, 5],           // the pile on Stability, bottom row first
    rowsTo: [4, 3, 2, 1],       // and the pile it rebuilds on Agility. Both must add up to the same number of dots.
                                // A row one shorter than the one below sits in its gaps; a row the same length sits straight on top
    dotColours: ['#3D63DC', '#FF6767'],   // Prophet Bright blue and Accreditation Coral red, picked at random per dot
    dotSize: 30,                // dot diameter
    dotSpace: 4,                // gap between neighbouring dots
    platformGap: 180,           // space between the two platforms; each is centred under its word
    platformTop: 290,           // their tops sit this far below the words' baseline, leaving room for the subcopy
    shake: 3,                   // how far the dots tremble before they jump, px at design size
    lineColour: 'rgba(255,255,255,0.6)',
    lineWidth: 1.5,
    jumpClear: 150,             // the jump's highest point is this far above the top of "Tension 2 of 3"
    dimWord: 0.25,              // the word not in focus drops to this opacity
    subLift: 24,                // subcopy rises this far as it fades in
    wordLift: 10,               // and its word rises this far with it

    // Timing, in px of scroll from when the scene pins
    ratedOut: [0, 300],         // Rated line fades out
    platformsIn: [100, 480],    // the platforms rise up from the bottom of the screen
    fadeStart: 460,             // the first dot (bottom left) starts to fade in
    fadeEach: 200,              // each dot's fade takes this much scroll
    fadeStagger: 35,            // and the next one starts this much later
    hold: 300,                  // the pile sits on Stability for this much
    shakeOver: 260,             // then trembles for this much, getting stronger, before the first jump
    jumpEach: 360,              // each dot's jump takes this much
    jumpStagger: 70,
    swap: 260,                  // the subcopy and word dimming swap over this much, as the jump starts
    endHold: 450                // everything holds this long before the light blue section slides up
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) pin.classList.add('is-static');
  var W = 0, H = 0, dpr = 1, scrolled = 0, at = {};
  // A pile's slots, bottom row first, left to right: [x offset, height] in dot spacings
  function pile(rows) {
    var slots = [], h = 0;
    rows.forEach(function (n, row) {
      if (row) h += n < rows[row - 1] ? Math.sqrt(3) / 2 : 1;   // nestled in the gaps, or straight on top
      for (var j = 0; j < n; j++) slots.push({ x: j - (n - 1) / 2, h: h });
    });
    return slots;
  }
  var from = pile(SETTINGS.rowsFrom), to = pile(SETTINGS.rowsTo);
  // Dots leave Stability from the top of the pile down, and fill Agility from the bottom up:
  // the k-th dot to jump takes slot (last - k) on Stability and slot k on Agility.
  var dots = to.map(function (_, k) {
    return { from: from[from.length - 1 - k], to: to[k], colour: SETTINGS.dotColours[Math.floor(Math.random() * SETTINGS.dotColours.length)], seed: Math.random() * 100 };
  });

  function clamp(v) { return Math.max(0, Math.min(1, v)); }
  function ease(t) { return t * t * (3 - 2 * t); }
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

  // Measure the words (ignoring their lift) and work out the story in px of scroll
  function layout() {
    var s = SETTINGS, topH = bars(), vh = window.innerHeight, st = stage.getBoundingClientRect();
    var k = parseFloat(getComputedStyle(title).fontSize) / 120;   // design px to screen px
    var liftA = (at.liftA || 0), liftB = (at.liftB || 0);
    var a = wordA.getBoundingClientRect(), b = wordB.getBoundingClientRect(), kk = kick.getBoundingClientRect();
    var base = a.bottom - liftA - st.top;                          // the words' baseline (they're trimmed to it)
    var lineY = base + s.platformTop * k;                          // platform tops
    var mid = W / 2, half = s.platformGap / 2 * k;
    var cA = (a.left + a.right) / 2 - st.left, cB = (b.left + b.right) / 2 - st.left;
    // Each platform's inner edge is half the gap from the middle; its outer edge mirrors that around its word
    var platA = [Math.min(2 * cA - (mid - half), mid - half - 40 * k), mid - half];
    var platB = [mid + half, Math.max(2 * cB - (mid + half), mid + half + 40 * k)];
    var rowA = (platA[0] + platA[1]) / 2, rowB = (platB[0] + platB[1]) / 2;
    var landed = s.fadeStart + (dots.length - 1) * s.fadeStagger + s.fadeEach;
    var jump = landed + s.hold + s.shakeOver;
    var jumped = jump + (dots.length - 1) * s.jumpStagger + s.jumpEach;
    var panel = jumped + s.endHold;
    var travel = panel + vh - topH;
    at = {
      k: k, lineY: lineY, platA: platA, platB: platB, stageH: st.height,
      rowA: rowA, rowB: rowB, apex: kk.top - st.top - s.jumpClear * k,
      landed: landed, jump: jump, jumped: jumped, panel: panel, liftA: liftA, liftB: liftB
    };
    var want = Math.round(st.height + travel);
    if (Math.abs(pin.offsetHeight - want) > 1) pin.style.height = want + 'px';
  }

  function readScroll() { scrolled = bars() - pin.getBoundingClientRect().top; }

  function text() {
    if (reduceMotion) return;
    var s = SETTINGS, k = at.k;
    rated.style.opacity = (1 - span(s.ratedOut[0], s.ratedOut[1] - s.ratedOut[0])).toFixed(3);
    var inA = span(s.fadeStart, at.landed - s.fadeStart), swap = span(at.jump, s.swap), dim = 1 - s.dimWord;
    var outA = span(at.jump, s.swap * 0.6), inB = span(at.jump + s.swap * 0.4, s.swap * 0.6);
    subA.style.opacity = (inA * (1 - outA)).toFixed(3);
    subB.style.opacity = inB.toFixed(3);
    if (arrows) arrows.update(inA, inA * (1 - outA), inB, inB);
    subA.style.transform = 'translateY(' + ((1 - inA) * s.subLift * k).toFixed(1) + 'px)';
    subB.style.transform = 'translateY(' + ((1 - inB) * s.subLift * k).toFixed(1) + 'px)';
    at.liftA = -inA * (1 - swap) * s.wordLift * k;
    at.liftB = -swap * s.wordLift * k;
    wordA.style.transform = 'translateY(' + at.liftA.toFixed(1) + 'px)';
    wordB.style.transform = 'translateY(' + at.liftB.toFixed(1) + 'px)';
    wordB.style.color = 'rgba(255,255,255,' + (1 - dim * inA * (1 - swap)).toFixed(3) + ')';
    wordA.style.color = 'rgba(255,255,255,' + (1 - dim * swap).toFixed(3) + ')';
  }

  function draw() {
    var s = SETTINGS, k = at.k, r = s.dotSize / 2 * k, gap = s.dotGap * k;
    ctx.clearRect(0, 0, W, H);

    // The platforms rise from below the screen; their bottoms run off it, so only three sides show
    var up = reduceMotion ? 1 : span(s.platformsIn[0], s.platformsIn[1] - s.platformsIn[0]);
    var off = (1 - up) * (at.stageH - at.lineY + 4);
    if (up > 0) {
      ctx.strokeStyle = s.lineColour; ctx.lineWidth = s.lineWidth; ctx.lineJoin = 'miter';
      [at.platA, at.platB].forEach(function (p) {
        var top = at.lineY + off, bottom = at.stageH + 4;
        ctx.beginPath(); ctx.moveTo(p[0], bottom); ctx.lineTo(p[0], top); ctx.lineTo(p[1], top); ctx.lineTo(p[1], bottom); ctx.stroke();
      });
    }

    var restY = at.lineY - r - s.lineWidth / 2, step = (s.dotSize + s.dotSpace) * k;
    var now = performance.now() / 1000, n = dots.length;
    for (var i = 0; i < n; i++) {
      var d = dots[i];
      var xA = at.rowA + d.from.x * step, yA = restY - d.from.h * step;
      var xB = at.rowB + d.to.x * step, yB = restY - d.to.h * step;
      var x = xA, y = yA, alpha = 1;
      if (!reduceMotion) {
        // Fade in where it sits, bottom row first
        alpha = span(s.fadeStart + (n - 1 - i) * s.fadeStagger, s.fadeEach);
        if (alpha <= 0.001) continue;
        var jt = lin(at.jump + i * s.jumpStagger, s.jumpEach);
        if (jt <= 0) {
          // Tremble, growing stronger, until this dot jumps
          var quake = clamp((scrolled - (at.jump - s.shakeOver)) / s.shakeOver);
          if (quake > 0) {
            var amp = s.shake * k * quake;
            x += Math.sin(now * 47 + d.seed) * amp;
            y += Math.cos(now * 53 + d.seed * 1.7) * amp * 0.6;
          }
        } else {
          // Arc up over "Tension 2 of 3" and down into its new slot
          var p = ease(jt), top = 2 * at.apex - (yA + yB) / 2;
          x = xA + (xB - xA) * p;
          y = (1 - jt) * (1 - jt) * yA + 2 * jt * (1 - jt) * top + jt * jt * yB;
        }
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = d.colour;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
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

  window.PROPHET_T2_TABLE = { settings: SETTINGS, refresh: tick, timing: function () { return at; }, scrolled: function () { return scrolled; } };
})();
