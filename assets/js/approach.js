/* Introduction: when "Our approach" scrolls into view, the arrow draws out of the
   label and the four cards rise in, one after another (timings are in the CSS). */
(function () {
  'use strict';
  var sec = document.getElementById('intro-sec');
  if (!sec || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var row = sec.querySelector('.approach-row');
  sec.classList.add('will-animate');

  // Play once the arrow row is a fifth of the way up the screen
  var io = new IntersectionObserver(function (entries) {
    if (!entries[0].isIntersecting) return;
    sec.classList.add('in');
    io.disconnect();
  }, { rootMargin: '0px 0px -20% 0px' });
  io.observe(row);
})();
