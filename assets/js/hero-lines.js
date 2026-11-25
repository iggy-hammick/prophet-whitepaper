/* Welcome hero: dots travelling along the lines in the #hero-lines SVG (now the
   spirograph; the earlier three brand lines are parked in a comment in index.html).

   Each line's group says how its dots move with data-pace:
     steady   dots evenly spaced, all moving together at one speed
     random   every dot has its own speed, and drifts a little faster and
              slower, so they bunch up and overtake one another
   Dots run from one end of a line to the other and start again at the beginning
   (the spirograph is a closed loop, so they just keep going round). A random
   line can say how many dots it carries with data-dots.

   Dots take random colours from the brand palette.

   A line marked data-align="title" (used by the brand lines) is tied to the title rather than placed
   from Figma: its lowest horizontal run sits level with the middle of TEAM,
   and its long vertical run lines up with the I in DYNAMICS. It's re-placed
   whenever the screen size or fonts change, since the title and the artwork
   scale differently.

   All sizes and speeds are in the Figma frame's units (1600 x 960), so they
   scale with the artwork. */
(function () {
  'use strict';

  var svg = document.getElementById('hero-lines');
  if (!svg) return;
  var NS = 'http://www.w3.org/2000/svg';

  /* ---------- Settings to play with ---------- */
  var SETTINGS = {
    radius: 5,                // dot radius, 10 across (half Figma's example dot)
    colours: ['#F26F31', '#3D63DC', '#F9B830', '#18A090', '#FF6767', '#E6EDFE'],
    steadyGap: 150,           // steady lines: distance between dots along the line
    steadySpeed: 70,          // steady lines: speed, units per second
    randomDots: 14,           // random lines: how many dots per line, unless the line sets data-dots
    randomSpeed: [30, 140],   // random lines: slowest and fastest dot
    drift: 0.35               // random lines: how much a dot's speed wanders (0 = constant)
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function rand(a, b) { return a + Math.random() * (b - a); }

  var lines = [].map.call(svg.querySelectorAll('g[data-pace]'), function (g) {
    var path = g.querySelector('path'), layer = g.querySelector('.hero27-dots');
    var length = path.getTotalLength(), steady = g.getAttribute('data-pace') === 'steady';
    var count = steady ? Math.max(1, Math.round(length / SETTINGS.steadyGap)) : (parseInt(g.getAttribute('data-dots'), 10) || SETTINGS.randomDots);
    var dots = [];
    for (var i = 0; i < count; i++) {
      var el = document.createElementNS(NS, 'circle');
      el.setAttribute('r', SETTINGS.radius);
      el.setAttribute('fill', SETTINGS.colours[Math.floor(Math.random() * SETTINGS.colours.length)]);
      layer.appendChild(el);
      dots.push({
        el: el,
        at: steady ? (i / count) * length : Math.random() * length,
        speed: steady ? SETTINGS.steadySpeed : rand(SETTINGS.randomSpeed[0], SETTINGS.randomSpeed[1]),
        phase: Math.random() * Math.PI * 2,
        wobble: rand(0.15, 0.4)
      });
    }
    return { path: path, length: length, steady: steady, dots: dots };
  });

  /* ---------- Tie the left line to the title ---------- */
  // In the line's own drawing: the lowest horizontal run is at y = 0.5, the long vertical run at x = 307.267
  var RUN_Y = 0.5, RUN_X = 307.267;
  function alignToTitle() {
    var g = svg.querySelector('g[data-align="title"]');
    var team = document.querySelector('.hero27-title');
    var dyn = document.querySelector('.hero27-indent');
    if (!g || !team || !dyn || !svg.getScreenCTM()) return;
    var text = [].filter.call(dyn.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); })[0];
    if (!text || !team.getBoundingClientRect().width) return;
    // Middle of TEAM: halfway between its cap height and baseline (the title is trimmed to exactly those)
    var title = document.querySelector('.hero27-title');
    var fs = parseFloat(getComputedStyle(title).fontSize);
    // The title is three lines, line-height 0.871em, trimmed cap height to baseline, so its height
    // is two line pitches plus one cap height
    var tb = title.getBoundingClientRect();
    var capH = tb.height - 2 * 0.871 * fs;
    var midY = tb.top + capH / 2;
    // Centre of the I in DYNAMICS
    var i = text.textContent.toUpperCase().indexOf('I');
    var r = document.createRange(); r.setStart(text, i); r.setEnd(text, i + 1);
    var ib = r.getBoundingClientRect();
    var midX = ib.left + ib.width / 2;
    // Screen to artwork units
    var inv = svg.getScreenCTM().inverse();
    var pt = svg.createSVGPoint(); pt.x = midX; pt.y = midY;
    var a = pt.matrixTransform(inv);
    g.setAttribute('transform', 'translate(' + (a.x - RUN_X).toFixed(2) + ' ' + (a.y + RUN_Y).toFixed(2) + ') scale(1 -1)');
  }

  var time = 0;
  function step(dt) {
    time += dt;
    lines.forEach(function (line) {
      line.dots.forEach(function (d) {
        var v = d.speed;
        if (!line.steady) v *= 1 + SETTINGS.drift * Math.sin(time * d.wobble + d.phase);
        d.at = (d.at + v * dt) % line.length;
      });
    });
  }
  function draw() {
    lines.forEach(function (line) {
      line.dots.forEach(function (d) {
        var p = line.path.getPointAtLength(d.at);
        d.el.setAttribute('cx', p.x.toFixed(2));
        d.el.setAttribute('cy', p.y.toFixed(2));
      });
    });
  }

  /* ---------- Run only while the hero is on screen ---------- */
  var running = false, visible = false, last = 0;
  function frame(now) {
    if (!running) return;
    step(Math.min(0.05, (now - last) / 1000 || 0));
    last = now;
    draw();
    requestAnimationFrame(frame);
  }
  function update() {
    var shouldRun = !reduceMotion && visible && !document.hidden && svg.getBoundingClientRect().width > 0;
    if (shouldRun && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    if (!shouldRun) running = false;
  }
  new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; update(); }).observe(svg);
  document.addEventListener('visibilitychange', update);
  window.addEventListener('prophet:screen', function () { setTimeout(update, 0); });

  window.addEventListener('resize', function () { alignToTitle(); draw(); });
  window.addEventListener('prophet:screen', function () { setTimeout(function () { alignToTitle(); draw(); }, 0); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { alignToTitle(); draw(); });
  alignToTitle();
  draw();
  update();

  // Handy for tweaking from the browser console, and for testing
  window.PROPHET_HERO_LINES = { settings: SETTINGS, lines: lines, step: step, draw: draw, align: alignToTitle };
})();
