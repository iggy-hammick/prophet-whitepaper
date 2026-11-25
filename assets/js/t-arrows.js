/* Right-angle arrows for the tension heroes

   Each hero has two lines of subcopy centred under the title. As a line fades
   in, a small arrow fades in with it: fixed in place, dropping straight down
   from under the middle of its headline word, round a rounded corner and
   across towards the line (the same distance across as down), level with the
   middle of the text. Efficiency's (the left word) turns right; Empathy's
   (the right word) turns left.

   Used by t1-ring.js and t2-table.js: each makes one with
   window.ProphetArrows(pin) and calls .update(inA, fadeA, inB, fadeB) every
   frame: each arrow's opacity is the smaller of the two. They stay fixed in
   place, centred under their word. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  var SETTINGS = {
    drop: 24,       // the arrow starts this far below the word's baseline, px at design size
    radius: 40,     // the rounded corner on the bend
    head: 7         // arrowhead size
  };

  window.ProphetArrows = function (pin) {
    var stage = pin.querySelector('.t1ring-stage'), title = pin.querySelector('.t1x-title');
    var words = [pin.querySelector('.t1x-a'), pin.querySelector('.t1x-b')];
    var texts = [pin.querySelector('.t1x-sub--eff'), pin.querySelector('.t1x-sub--emp')];
    var spot = pin.querySelector('.t1x-under');   // where the lines come to rest (they lift into it, but this doesn't move)
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 't1x-arrows');
    svg.setAttribute('aria-hidden', 'true');
    stage.insertBefore(svg, pin.querySelector('.t1x-intro'));
    var arrows = [0, 1].map(function () {
      var g = document.createElementNS(NS, 'g'), line = document.createElementNS(NS, 'path'), head = document.createElementNS(NS, 'path');
      g.appendChild(line); g.appendChild(head); svg.appendChild(g);
      return { g: g, line: line, head: head };
    });

    function place(i, draw, fade) {
      var a = arrows[i];
      if (draw <= 0.001 || fade <= 0.001) { a.g.style.opacity = 0; return; }
      var st = stage.getBoundingClientRect(), w = words[i].getBoundingClientRect(), base = title.getBoundingClientRect().bottom, rest = spot.getBoundingClientRect().top;
      var k = parseFloat(getComputedStyle(title).fontSize) / 120;
      var dir = i === 0 ? 1 : -1;                             // Efficiency turns right, Empathy turns left
      // Measured from things that don't move (the title's baseline and the text's resting spot), so the arrow stays put
      var y1 = rest - st.top + parseFloat(getComputedStyle(texts[i]).fontSize) * 0.4;   // level with the middle of the letters
      var y0 = base - st.top + SETTINGS.drop * k;              // the start, a little below the words' baseline
      var len = y1 - y0;                                       // down, and the same distance across
      if (len < 8) { a.g.style.opacity = 0; return; }
      var x0 = (w.left + w.right) / 2 - st.left;              // straight down from the middle of the word
      var x1 = x0 + dir * len, r = Math.min(SETTINGS.radius * k, len);
      a.line.setAttribute('d', 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + 'V' + (y1 - r).toFixed(1) +
        'A' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 0 ' + (dir > 0 ? 0 : 1) + ' ' + (x0 + dir * r).toFixed(1) + ' ' + y1.toFixed(1) + 'H' + x1.toFixed(1));
      var h = SETTINGS.head * k * 1.4;
      a.head.setAttribute('d', 'M' + (x1 - dir * h).toFixed(1) + ' ' + (y1 - h).toFixed(1) + 'L' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'L' + (x1 - dir * h).toFixed(1) + ' ' + (y1 + h).toFixed(1));
      a.g.style.opacity = Math.min(draw, fade).toFixed(3);
    }

    return {
      update: function (drawA, fadeA, drawB, fadeB) { place(0, drawA, fadeA); place(1, drawB, fadeB); },
      settings: SETTINGS
    };
  };
})();
