/* Layout grid overlay for design checks. Press G to show or hide it.
   Columns, margin and gutter come from the --grid-* tokens in brand.css.
   It stays on across reloads until you press G again. */
(function () {
  'use strict';
  var KEY = 'prophet-grid';

  var style = document.createElement('style');
  style.textContent =
    '.grid-overlay{position:fixed;inset:0;z-index:9999;pointer-events:none;display:none}' +
    '.grid-overlay.on{display:block}' +
    '.grid-overlay__cols{box-sizing:border-box;height:100%;max-width:var(--grid-max,1600px);margin:0 auto;padding:0 var(--grid-margin,80px);' +
      'display:grid;grid-template-columns:repeat(var(--grid-columns,12),minmax(0,1fr));column-gap:var(--grid-gutter,20px)}' +
    '.grid-overlay__col{background:rgba(255,103,103,.12);box-shadow:inset 1px 0 rgba(255,103,103,.45),inset -1px 0 rgba(255,103,103,.45)}';
  document.head.appendChild(style);

  var overlay = document.createElement('div');
  overlay.className = 'grid-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  var cols = document.createElement('div');
  cols.className = 'grid-overlay__cols';
  for (var i = 0; i < 12; i++) { var c = document.createElement('div'); c.className = 'grid-overlay__col'; cols.appendChild(c); }
  overlay.appendChild(cols);
  document.body.appendChild(overlay);

  function set(on) {
    overlay.classList.toggle('on', on);
    try { localStorage.setItem(KEY, on ? '1' : ''); } catch (e) {}
  }
  try { if (localStorage.getItem(KEY)) set(true); } catch (e) {}

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'g' && e.key !== 'G') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;   // don't fire while typing
    set(!overlay.classList.contains('on'));
  });
})();
