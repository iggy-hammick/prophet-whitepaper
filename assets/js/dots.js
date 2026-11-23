/* PROPHET dot grid
   The page is filled with as many whole teams as fit on screen: 4×4 blocks of
   lavender and red dots in a random mix. The dots bob around their spots, and
   each team sways together.

   Dots keep swapping teams in chains: a dot travels to a neighbouring team and
   takes one dot's place, and that dot sets off for another team, and so on,
   forever. Each chain starts with one spare dot, so every team stays at 16.

   When the mouse comes near, dots in a wide area bob faster. Closer still, the
   mouse pushes them away, and they spring back when it leaves. */
(function () {
  'use strict';

  /* ---------- Settings to play with ---------- */
  var SETTINGS = {
    colours: ['#8793cc', '#d33f56'],   // lavender, red (from the dot frames)
    dotSize: 4,          // dot diameter, px
    opacity: 0.5,        // dot opacity, kept low so text reads on top
    dotGap: 16,          // space between dots in a team, edge to edge, px
    teamGap: 48,         // space between teams, edge to edge, px
    margin: 48,          // smallest space kept clear around the page edge, px
    teamSize: 4,         // dots per side of a team (4 × 4 = 16)

    // Bobbing
    bob: 5,              // how far each dot wanders from its spot, px
    bobSpeed: 1.4,       // how quickly it wanders
    teamSway: 3,         // how far each whole team drifts together, px

    // Team swaps
    chains: 30,          // how many swap chains run at once (fewer on small screens)
    travelSpeed: 70,     // how fast a dot travels to its new team, px per second
    handover: 8,         // how close a traveller gets before the dot it replaces sets off, px

    // Mouse: a wide area that speeds the dots up...
    speedRadius: 280,    // how far the speed-up reaches, px
    speedUp: 4,          // extra speed with the mouse right on top (1 + this)
    // ...and a smaller area that pushes dots away
    pushRadius: 120,     // how far the push reaches, px
    push: 4000,          // how hard the mouse pushes

    spring: 38,          // how strongly dots pull back to where they should be
    damping: 9           // higher settles faster with less wobble
  };

  var canvas = document.getElementById('dots');
  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 0, H = 0, dpr = 1;
  var dots = [], teams = [], grid = [];
  var mouse = { x: -1e4, y: -1e4 };
  var time = 0;
  var swaps = 0;
  var TAU = Math.PI * 2;
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var pick = function (list) { return list[Math.floor(Math.random() * list.length)]; };

  function makeDot(hx, hy, team) {
    return {
      hx: hx, hy: hy, x: hx, y: hy, vx: 0, vy: 0,
      team: team,
      colour: pick(SETTINGS.colours),
      // Each dot wanders on its own slow loop
      px: rand(0, TAU), py: rand(0, TAU),
      wx: rand(0.6, 1.1), wy: rand(0.6, 1.1),
      clock: rand(0, 100),
      speed: 1,
      state: 'home',     // home, waiting (a spare about to set off), travelling
      target: null,      // while travelling: the dot whose place it will take
      targeted: false,   // true while a traveller is heading for this dot's place
      cameFrom: null,    // the team it last left, so it doesn't go straight back
      launchAt: 0
    };
  }

  /* ---------- Layout: as many whole teams as fit, centred ---------- */
  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var s = SETTINGS;
    var pitch = s.dotSize + s.dotGap;                          // dot to dot, centre to centre
    var teamSpan = (s.teamSize - 1) * pitch + s.dotSize;       // one team, edge to edge
    var teamPitch = teamSpan + s.teamGap;                      // team to team

    var cols = Math.max(1, Math.floor((W - 2 * s.margin + s.teamGap) / teamPitch));
    var rows = Math.max(1, Math.floor((H - 2 * s.margin + s.teamGap) / teamPitch));
    var startX = W / 2 - (cols * teamPitch - s.teamGap) / 2 + s.dotSize / 2;
    var startY = H / 2 - (rows * teamPitch - s.teamGap) / 2 + s.dotSize / 2;

    dots = []; teams = []; grid = [];
    for (var tr = 0; tr < rows; tr++) {
      grid.push([]);
      for (var tc = 0; tc < cols; tc++) {
        var ox = startX + tc * teamPitch, oy = startY + tr * teamPitch;
        var team = {
          row: tr, col: tc,
          cx: ox + (s.teamSize - 1) * pitch / 2, cy: oy + (s.teamSize - 1) * pitch / 2,
          px: rand(0, TAU), py: rand(0, TAU), wx: rand(0.2, 0.4), wy: rand(0.2, 0.4)
        };
        teams.push(team); grid[tr].push(team);
        for (var r = 0; r < s.teamSize; r++) {
          for (var c = 0; c < s.teamSize; c++) {
            dots.push(makeDot(ox + c * pitch, oy + r * pitch, team));
          }
        }
      }
    }

    // Each swap chain starts with a spare dot waiting in the middle of a team
    // (Capped at about two chains for every three teams, so phones don't get crowded)
    var chainCount = Math.min(s.chains, Math.floor(teams.length * 2 / 3));
    if (teams.length > 1) {
      for (var k = 0; k < chainCount; k++) {
        var home = pick(teams);
        var spare = makeDot(home.cx, home.cy, home);
        spare.state = 'waiting';
        spare.launchAt = time + rand(0.5, 2.5);
        dots.push(spare);
      }
    }
  }

  /* ---------- Swapping teams ---------- */
  function neighbours(team) {
    var out = [];
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        var row = grid[team.row + dr];
        if (row && row[team.col + dc]) out.push(row[team.col + dc]);
      }
    }
    return out;
  }

  // Send a dot off to take the place of a dot in a neighbouring team
  function launch(d) {
    var options = neighbours(d.team).filter(function (t) { return t !== d.cameFrom; });
    if (!options.length) options = neighbours(d.team);
    var dest = pick(options);
    var candidates = dots.filter(function (o) { return o.team === dest && o.state === 'home' && !o.targeted; });
    if (!candidates.length) { d.state = 'waiting'; d.launchAt = time + 1; return; }
    var target = pick(candidates);
    target.targeted = true;
    d.target = target;
    d.cameFrom = d.team;
    d.state = 'travelling';
  }

  // The traveller has reached its new team: it takes over the place, and the
  // dot it replaced sets off for another team
  function handOver(d) {
    var t = d.target;
    var from = d.cameFrom;
    d.hx = t.hx; d.hy = t.hy; d.team = t.team;
    d.state = 'home'; d.target = null;
    t.targeted = false;
    t.cameFrom = from;           // don't send it back where the newcomer came from
    swaps++;
    launch(t);
  }

  /* ---------- Motion ---------- */
  function step(dt) {
    var s = SETTINGS;
    time += dt;
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var dx = d.x - mouse.x, dy = d.y - mouse.y;
      var dist = Math.hypot(dx, dy);

      // Wide area: move faster the closer the mouse is (eased in and out)
      var near = Math.max(0, 1 - dist / s.speedRadius);
      near = near * near * (3 - 2 * near);
      d.speed += (1 + s.speedUp * near - d.speed) * Math.min(1, dt * 3);
      d.clock += dt * d.speed * s.bobSpeed;

      if (d.state === 'waiting' && time >= d.launchAt) launch(d);

      var tx, ty;
      if (d.state === 'travelling') {
        // Head for the dot it will replace
        tx = d.target.x; ty = d.target.y;
        if (Math.hypot(tx - d.x, ty - d.y) < s.handover) handOver(d);
      } else {
        // Its spot, plus its own bob, plus its team's sway
        var amp = s.bob * (1 + 0.5 * near);
        var tm = d.team;
        tx = d.hx + Math.sin(d.clock * d.wx + d.px) * amp + Math.sin(time * tm.wx + tm.px) * s.teamSway;
        ty = d.hy + Math.cos(d.clock * d.wy + d.py) * amp + Math.cos(time * tm.wy + tm.py) * s.teamSway;
      }

      var ax = (tx - d.x) * s.spring;
      var ay = (ty - d.y) * s.spring;

      // Close in: push away from the mouse, strongest right under it
      if (dist < s.pushRadius && dist > 0.01) {
        var f = 1 - dist / s.pushRadius;
        f = f * f * s.push;
        ax += (dx / dist) * f;
        ay += (dy / dist) * f;
      }

      ax -= d.vx * s.damping;
      ay -= d.vy * s.damping;
      d.vx += ax * dt; d.vy += ay * dt;

      // Travellers keep to an unhurried pace (quicker near the mouse)
      if (d.state === 'travelling') {
        var vmax = s.travelSpeed * d.speed;
        var v = Math.hypot(d.vx, d.vy);
        if (v > vmax) { d.vx *= vmax / v; d.vy *= vmax / v; }
      }

      d.x += d.vx * dt; d.y += d.vy * dt;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = SETTINGS.opacity;
    var r = SETTINGS.dotSize / 2;
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      ctx.beginPath();
      ctx.arc(d.x, d.y, r, 0, TAU);
      ctx.fillStyle = d.colour;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Run ---------- */
  var last = 0;
  function frame(now) {
    // Small fixed steps keep the springs stable even if a frame runs long
    var elapsed = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    var steps = Math.ceil(elapsed / 0.008);
    for (var k = 0; k < steps; k++) step(elapsed / steps);
    draw();
    requestAnimationFrame(frame);
  }

  function clearMouse() { mouse.x = mouse.y = -1e4; }
  window.addEventListener('pointermove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  document.addEventListener('pointerleave', clearMouse);
  document.documentElement.addEventListener('pointerleave', clearMouse);
  window.addEventListener('blur', clearMouse);
  window.addEventListener('pointerup', function (e) { if (e.pointerType === 'touch') clearMouse(); });
  window.addEventListener('resize', function () { build(); draw(); });

  build();
  draw();
  if (!reduceMotion) {
    requestAnimationFrame(function (now) { last = now; requestAnimationFrame(frame); });
  }

  // Handy for tweaking from the browser console, and for testing
  window.PROPHET_DOTS = {
    settings: SETTINGS,
    dots: function () { return dots; },
    teams: function () { return teams; },
    swaps: function () { return swaps; },
    rebuild: function () { build(); draw(); },
    step: step,
    draw: draw,
    mouse: mouse
  };
})();
