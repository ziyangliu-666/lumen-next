/* The theme for direction A. Loaded in <head> before the styles paint, so a
   dark page never flashes white. The OS setting decides; D toggles it for
   review, and the choice holds across the three pages. */
(function () {
  var root = document.documentElement;
  var os = window.matchMedia('(prefers-color-scheme: dark)');
  function saved() {
    try {
      return localStorage.getItem('lumen-theme');
    } catch (e) {
      return null;
    }
  }
  function apply() {
    root.setAttribute('data-theme', saved() || (os.matches ? 'dark' : 'light'));
    root.dispatchEvent(new Event('themechange'));
  }
  apply();
  os.addEventListener('change', apply);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'd' && e.key !== 'D') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return;
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('lumen-theme', next);
    } catch (err) {}
    apply();
  });
})();
