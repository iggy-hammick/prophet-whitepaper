/* Tension heroes: rings, dots and the side marker
   Runs for every tension hero on the page (#t1-hero, #t2-hero, #t3-hero).
   Moving the mouse between the left and right halves of the screen marks the
   side you're on (the line under the title, and the other word dimmed) on all
   of them. Each tension can have its own dot motion: see TENSIONS below.

   Tension 1, Efficiency vs Empathy:
   Six rings share the centre of the hero (Figma frame "7"). Light dots travel
   round them in an orderly way: every dot at the same speed, evenly spaced,
   with only a slight drift so it doesn't feel mechanical.

   Move the mouse to the right half of the screen (the Empathy side) and the
   dots slow to a stop and start pulsing, sending soft solid discs swelling out from each one,
   as if they've stopped working to think about other things. Move back to the
   left (Efficiency) and they set off again. On touch screens, tap a side. */
(function () {
  'use strict';


  /* ---------- Each tension's motion ----------
     t1 moves and pulses (Efficiency vs Empathy). t2 has no rings (its dot grid
     is drawn by tension-grid.js). t3 has no rings either (its
     cluster is drawn by tension-cluster.js). */
  var TENSIONS = {
    t1: {},
    t2: { radii: [] },                  // no rings: the dot grid takes over (tension-grid.js)
    t3: { radii: [] }                   // no rings: the cluster takes over (tension-cluster.js)
  };
  var instances = {};
  Object.keys(TENSIONS).forEach(function (key) {
    var hero = document.getElementById(key + '-hero');
    var canvas = document.getElementById(key + '-orbits');
    if (!hero || !canvas) return;
    instances[key] = initHero(hero, canvas, TENSIONS[key]);
  });
  window.PROPHET_TENSIONS = instances;
  window.PROPHET_T1 = instances.t1;   // kept for console tweaking

  function initHero(hero, canvas, overrides) {
  var ctx = canvas.getContext('2d');
  /* ---------- Settings to play with ---------- */
  var SETTINGS = {
    dotColour: '#505B7D',
    ringColour: 'rgba(255,255,255,0.1)',
    // Ring radii in Figma pixels (the frame is 1600 wide; the rings centre on the hero)
    radii: [201, 334, 469, 602, 736, 870],
    centreY: 0.5,           // ring centre, as a share of the hero's height (the top bar sits over the hero, as in Figma)
    dotSize: 16,            // dot diameter, Figma px
    spacing: 420,           // roughly one dot for every this many px of ring
    speed: 110,             // travel speed, Figma px per second (the same on every ring)
    drift: 0.06,            // how much each dot eases ahead or behind (0 = perfect lockstep)
    clockwise: true,

    // Empathy side
    settle: 1.6,            // how quickly dots stop and start again (higher is snappier)
    pulseEvery: [1.6, 2.4], // seconds for one pulse to grow out, per dot (random in this range)
    pulseRings: 2,          // how many pulses are on their way out at once
    pulseSize: 11,          // how far a pulse grows, as a multiple of the dot's radius
    pulseOpacity: 0.3       // how solid a pulse starts (it fades as it grows)
  };
  Object.keys(overrides).forEach(function (k) { SETTINGS[k] = overrides[k]; });

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU = Math.PI * 2;
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var W = 0, H = 0, dpr = 1, scale = 1, cx = 0, cy = 0;
  var rings = [];
  var empathy = 0;        // 0 = moving (Efficiency), 1 = stopped and pulsing (Empathy), eased in between
  var wantEmpathy = false;
  var time = 0;

  function build() {
    rings = SETTINGS.radii.map(function (r) {
      var count = Math.max(3, Math.round(TAU * r / SETTINGS.spacing));
      var start = rand(0, TAU);
      var dots = [];
      for (var d = 0; d < count; d++) {
        dots.push({
          angle: start + (d / count) * TAU,
          // Slight drift: each dot eases a little ahead and behind its place, never far
          driftRate: rand(0.2, 0.45), driftPhase: rand(0, TAU),
          // Pulse timing, so the dots don't all pulse together
          pulsePeriod: rand(SETTINGS.pulseEvery[0], SETTINGS.pulseEvery[1]),
          pulsePhase: Math.random()
        });
      }
      return { r: r, dots: dots, base: SETTINGS.speed / r };   // radians per second
    });
  }

  function resize() {
    var box = canvas.getBoundingClientRect();
    W = box.width; H = box.height;
    if (!W || !H) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.max(0.45, W / 1600);
    cx = W / 2;
    cy = H * SETTINGS.centreY;
  }

  // Smooth 0→1 ease
  function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

  function draw() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1;
    ctx.strokeStyle = SETTINGS.ringColour;
    rings.forEach(function (ring) {
      ctx.beginPath(); ctx.arc(cx, cy, ring.r * scale - 0.5, 0, TAU); ctx.stroke();
    });

    var dotR = (SETTINGS.dotSize / 2) * Math.max(scale, 0.65);
    var pulse = smooth((empathy - 0.35) / 0.65);   // pulses fade in once the dots have mostly stopped
    ctx.fillStyle = SETTINGS.dotColour;
    rings.forEach(function (ring) {
      var r = ring.r * scale;
      ring.dots.forEach(function (d) {
        var x = cx + Math.cos(d.angle) * r, y = cy + Math.sin(d.angle) * r;
        var reach = dotR * SETTINGS.pulseSize;
        if (x < -reach || x > W + reach || y < -reach || y > H + reach) return;

        if (pulse > 0.01) {
          // Solid discs swell out of the dot one after another, growing and fading
          var n = SETTINGS.pulseRings;
          var cycle = time / d.pulsePeriod + d.pulsePhase;
          for (var k = 0; k < n; k++) {
            var t = (cycle + k / n) % 1;
            var grow = 1 - Math.pow(1 - t, 3);          // quick burst out, then easing off
            ctx.beginPath();
            ctx.arc(x, y, dotR + (reach - dotR) * grow, 0, TAU);
            ctx.globalAlpha = SETTINGS.pulseOpacity * pulse * Math.pow(1 - t, 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        ctx.beginPath(); ctx.arc(x, y, dotR, 0, TAU); ctx.fill();
      });
    });
  }

  function step(dt) {
    time += dt;
    // Ease towards the side the mouse is on
    var target = wantEmpathy ? 1 : 0;
    empathy += (target - empathy) * Math.min(1, dt * SETTINGS.settle);
    if (Math.abs(target - empathy) < 0.001) empathy = target;
    var go = 1 - smooth(empathy);   // full speed on Efficiency, stopped on Empathy
    var dir = SETTINGS.clockwise ? 1 : -1;
    rings.forEach(function (ring) {
      ring.dots.forEach(function (d) {
        var pace = ring.base * (1 + SETTINGS.drift * Math.sin(time * d.driftRate + d.driftPhase));
        d.angle += dir * pace * go * dt;
      });
    });
  }

  /* ---------- The line under the title: measure each word's centre ---------- */
  var title = hero.querySelector('.t-title');
  function placeLine() {
    if (!title) return;
    var box = title.getBoundingClientRect();
    if (!box.width) return;
    ['a', 'b'].forEach(function (k) {
      var w = title.querySelector('.t-' + k).getBoundingClientRect();
      title.style.setProperty('--line-' + k, (w.left + w.width / 2 - box.left) + 'px');
    });
    if (!title.classList.contains('line-ready')) setTimeout(function () { title.classList.add('line-ready'); }, 50);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeLine);
  // Re-measure whenever the title or either word changes size (fonts loading, screen resizing, page switching)
  if (title && 'ResizeObserver' in window) {
    var ro = new ResizeObserver(placeLine);
    ro.observe(title); ro.observe(title.querySelector('.t-a')); ro.observe(title.querySelector('.t-b'));
  }

  /* ---------- Which side is the mouse on? ---------- */
  function sideFrom(x) { setSide(x > window.innerWidth / 2); }
  // The hero gets .is-empathy so the title can mark which side you're on
  function setSide(on) { wantEmpathy = on; hero.classList.toggle('is-empathy', on); }
  window.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') sideFrom(e.clientX); }, { passive: true });
  hero.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') sideFrom(e.clientX); });
  document.documentElement.addEventListener('mouseleave', function () { setSide(false); });

  /* ---------- Run only while the hero is on screen ---------- */
  var running = false, visible = false, last = 0;
  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    step(dt); draw();
    requestAnimationFrame(frame);
  }
  function update() {
    var shown = canvas.offsetParent !== null;
    if (shown && !W) { resize(); draw(); }
    var shouldRun = visible && shown && !document.hidden;
    if (shouldRun && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    if (!shouldRun) running = false;
  }

  new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; if (visible) { resize(); draw(); placeLine(); } update(); }).observe(canvas);
  document.addEventListener('visibilitychange', update);
  function onScreen() { setTimeout(function () { resize(); draw(); placeLine(); update(); }, 0); }
  window.addEventListener('hashchange', onScreen);
  window.addEventListener('prophet:screen', onScreen);
  window.addEventListener('resize', function () { resize(); draw(); placeLine(); });

  build();
  resize();
  if (reduceMotion) {
    // Still dots; the empathy pulse is left out too
    SETTINGS.speed = 0; SETTINGS.pulseOpacity = 0;
  }
  draw();
  placeLine();
  update();

  // Handy for tweaking from the browser console, and for testing
  return {
    settings: SETTINGS, rings: function () { return rings; },
    rebuild: function () { build(); resize(); draw(); },
    setEmpathy: function (on) { setSide(!!on); },
    state: function () { return { empathy: empathy, time: time }; },
    step: step, draw: draw
  };
  }
})();
