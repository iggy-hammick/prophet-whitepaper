/* Hero spiral: dots travelling along the Figma spiral.

   The spiral is one long line that makes 50 loops around a centre. Each loop
   stands for a team. Dots flow along the line, and every dot takes the colour
   of its loop, so all the dots on one arm share a colour.

   Each .hero27-art SVG holds the spiral artwork plus a .hero27-dots layer, and
   says how its dots behave with data attributes (all in the spiral file's own
   units, so the dots follow whatever position and scale the artwork has):
     data-src      the spiral SVG to follow
     data-split    where one loop hands over to the next, and so where dots
                   change colour: "outer" (the far tips) or "inner" (the turns
                   nearest the centre). Pick whichever is off-screen.
     data-radius   dot radius
     data-speed    typical travel speed per second
     data-dots     dots per loop (how busy it looks)
   With data-split="inner", dots also fade out near the centre so the colour
   change is never seen.

   Teams: each loop is one team, and shows on screen as one line. A team's
   dots stay on its line, all in the team's colour. Some teams are steady:
   their dots are evenly spaced and move in lockstep at the team's speed. The
   rest are erratic: each dot has its own speed and drifts faster and slower,
   so they bunch up and overtake one another. */
(function () {
  var arts = document.querySelectorAll('.hero27-art[data-src]');
  if (!arts.length) return;
  var NS = 'http://www.w3.org/2000/svg';
  var COLOURS = ['#F26F31', '#3D63DC', '#F9B830', '#18A090', '#FF6767', '#E6EDFE'];
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STEADY_SHARE = 0.5;          // share of teams whose dots move in lockstep
  var TEAM_PACE = [0.5, 1.6];      // a team's speed, as a multiple of data-speed
  var DOT_PACE = [0.4, 1.9];       // an erratic dot's speed, as a multiple of its team's
  function rand(a, b) { return a + Math.random() * (b - a); }

  // Read the path's points straight from the SVG (it uses M, L, H and V only).
  function parsePath(d) {
    var toks = d.match(/[MLHVZz]|-?\d*\.?\d+(?:e-?\d+)?/g), pts = [], cmd = '', x = 0, y = 0, i = 0;
    while (i < toks.length) {
      var t = toks[i];
      if (/[MLHVZz]/.test(t)) { cmd = t; i++; continue; }
      if (cmd === 'M' || cmd === 'L') { x = +toks[i]; y = +toks[i + 1]; i += 2; }
      else if (cmd === 'H') { x = +t; i++; }
      else if (cmd === 'V') { y = +t; i++; }
      else { i++; continue; }
      pts.push([x, y]);
    }
    return pts;
  }

  function build(pts, split) {
    var n = pts.length, cum = new Float64Array(n), minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, i;
    for (i = 0; i < n; i++) {
      var p = pts[i];
      if (i) cum[i] = cum[i - 1] + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    }
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, r = new Float64Array(n), rMin = Infinity, rMax = 0;
    for (i = 0; i < n; i++) { r[i] = Math.hypot(pts[i][0] - cx, pts[i][1] - cy); rMin = Math.min(rMin, r[i]); rMax = Math.max(rMax, r[i]); }

    // Find the turns where one loop hands over to the next.
    var outer = split === 'outer', turns = [];
    for (i = 1; i < n - 1; i++) {
      var isTurn = outer
        ? r[i] > r[i - 1] && r[i] >= r[i + 1] && r[i] > rMax * 0.94
        : r[i] < r[i - 1] && r[i] <= r[i + 1] && r[i] < rMin * 1.22;
      if (isTurn && (!turns.length || i - turns[turns.length - 1] > 20)) turns.push(i);
    }
    var loops = turns.length, loopAt = new Uint16Array(n), k = 0;
    for (i = 0; i < n; i++) {
      while (k < turns.length && i >= turns[k]) k++;
      loopAt[i] = (k - 1 + loops) % loops;   // the piece before the first turn joins the last loop
    }

    // How visible a dot is at each point. For inner hand-overs, hide dots near
    // the centre so the colour change happens out of sight.
    var alpha = new Float32Array(n).fill(1);
    if (!outer) {
      var f0 = rMin * 1.11, f1 = rMin * 1.44;
      for (i = 0; i < n; i++) { var t = Math.min(1, Math.max(0, (r[i] - f0) / (f1 - f0))); alpha[i] = t * t * (3 - 2 * t); }
    }
    // Each loop's far tip, used to spot loops drawn on top of one another.
    var tips = [], best = [];
    for (i = 0; i < n; i++) { var L = loopAt[i]; if (best[L] === undefined || r[i] > r[best[L]]) best[L] = i; }
    for (i = 0; i < loops; i++) tips.push(pts[best[i]]);
    return { pts: pts, cum: cum, total: cum[n - 1], loopAt: loopAt, loops: loops, alpha: alpha, turns: turns, tips: tips };
  }

  // Arms that sit side by side on screen are every other loop, so step through
  // the colours in a way that keeps those neighbours different.
  function loopColour(loop) {
    var half = Math.floor(COLOURS.length / 2);
    return COLOURS[(Math.floor(loop / 2) + (loop % 2) * half) % COLOURS.length];
  }

  function start(track, art) {
    var layer = art.querySelector('.hero27-dots');
    if (!layer) return;
    var radius = +art.dataset.radius || 8, speed = +art.dataset.speed || 110, perLoop = Math.max(1, Math.round(+art.dataset.dots || 2));
    var total = track.total, cum = track.cum, turns = track.turns, teams = [], dots = [], i, j;

    // One team per line on screen. A team owns one loop of the spiral, from one
    // hand-over turn to the next, plus its own colour, speed and character.
    // The artwork goes round twice along the same track, so every line is two
    // loops drawn on top of each other: only the first of each pair gets a team.
    for (i = 0; i < track.loops; i++) {
      var tip = track.tips[i], repeat = teams.some(function (t) { return Math.hypot(t.tip[0] - tip[0], t.tip[1] - tip[1]) < 6; });
      if (repeat) continue;
      var from = cum[turns[i]], to = i + 1 < turns.length ? cum[turns[i + 1]] : total + cum[turns[0]];
      teams.push({
        tip: tip,
        start: from, length: to - from,
        colour: loopColour(i),
        pace: speed * rand(TEAM_PACE[0], TEAM_PACE[1]),
        steady: Math.random() < STEADY_SHARE
      });
    }

    // Each team's dots. Steady teams: evenly spaced, all at the team's pace.
    // Erratic teams: scattered, each dot with its own pace and drift.
    teams.forEach(function (team) {
      var phase = Math.random() * team.length;
      for (j = 0; j < perLoop; j++) {
        var el = document.createElementNS(NS, 'circle');
        el.setAttribute('r', radius);
        el.setAttribute('fill', team.colour);
        layer.appendChild(el);
        dots.push({
          el: el, team: team, alpha: -1,
          u: team.steady ? (phase + j * team.length / perLoop) % team.length : Math.random() * team.length,
          own: team.steady ? 1 : rand(DOT_PACE[0], DOT_PACE[1]),
          wobble: team.steady ? 0 : rand(0.15, 0.5),
          wobbleRate: rand(0.4, 1.2),
          wobblePhase: rand(0, Math.PI * 2)
        });
      }
    });

    function locate(s) {
      var lo = 0, hi = cum.length - 1;
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
      return lo;
    }

    // Move every dot on by dt seconds (time is the running clock, for the drift).
    // A dot that reaches the end of its line starts it again; both ends are the
    // off-screen turns near the centre, where dots are faded out.
    function step(dt, time) {
      for (var k = 0; k < dots.length; k++) {
        var d = dots[k], team = d.team;
        var pace = team.pace * d.own * (1 + d.wobble * Math.sin(time * d.wobbleRate + d.wobblePhase));
        d.u = (d.u + pace * dt) % team.length;
        var s = (team.start + d.u) % total, lo = locate(s);
        var a = track.pts[lo], b = track.pts[lo + 1] || a, seg = (cum[lo + 1] - cum[lo]) || 1, f = (s - cum[lo]) / seg;
        d.el.setAttribute('cx', (a[0] + (b[0] - a[0]) * f).toFixed(1));
        d.el.setAttribute('cy', (a[1] + (b[1] - a[1]) * f).toFixed(1));
        var alpha = Math.round(track.alpha[lo] * 100) / 100;
        if (alpha !== d.alpha) { d.el.setAttribute('opacity', alpha); d.alpha = alpha; }
      }
    }

    var clock = 0, last = 0, running = false, visible = true;
    function frame(now) {
      if (!running) return;
      var dt = Math.min(now - last, 100) / 1000;   // no jump after a pause
      clock += dt;
      last = now;
      step(dt, clock);
      requestAnimationFrame(frame);
    }
    function update() {
      var run = !reduceMotion && visible && art.getClientRects().length > 0 && !document.hidden;
      if (run && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
      if (!run) running = false;
    }

    step(0, 0);
    if (reduceMotion) return;
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; update(); }).observe(art);
    document.addEventListener('visibilitychange', update);
    update();
  }

  var paths = {};   // each spiral file is fetched once, however many times it is used
  arts.forEach(function (art) {
    var src = art.dataset.src;
    paths[src] = paths[src] || fetch(src)
      .then(function (res) { return res.text(); })
      .then(function (text) { return parsePath(new DOMParser().parseFromString(text, 'image/svg+xml').querySelector('path').getAttribute('d')); });
    paths[src]
      .then(function (pts) { start(build(pts, art.dataset.split), art); })
      .catch(function () { /* the spiral still shows, just without dots */ });
  });
})();
