/* Sets the theme before the first paint, so a dark screen never flashes white.
   It is a file and not an inline script because the server's Content Security
   Policy allows scripts from this origin only (script-src 'self').

   Dark for everyone at first. A stored choice ('light' or 'dark' under
   'lumen-theme', written by src/core/theme.ts) overrides it. The class "dark"
   on <html> is the one switch that src/styles/theme.css reads. */
(function () {
  var root = document.documentElement;
  var saved = null;
  try {
    saved = localStorage.getItem('lumen-theme');
  } catch (e) {
    /* Storage can be disabled; the page is then dark. */
  }
  var dark = saved !== 'light';
  root.classList.toggle('dark', dark);
})();
