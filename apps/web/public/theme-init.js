/* Sets the theme before the first paint, so a dark screen never flashes white.
   It is a file and not an inline script because the server's Content Security
   Policy allows scripts from this origin only (script-src 'self').

   The OS setting decides. A stored choice ('light' or 'dark' under
   'lumen-theme', written by src/core/theme.ts) overrides it. The class "dark"
   on <html> is the one switch that src/styles/theme.css reads. */
(function () {
  var root = document.documentElement;
  var saved = null;
  try {
    saved = localStorage.getItem('lumen-theme');
  } catch (e) {
    /* Storage can be disabled; the OS setting still applies. */
  }
  var dark =
    saved === 'dark' ||
    (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark);
})();
