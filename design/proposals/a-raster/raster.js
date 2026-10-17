/* Behaviour shared by the three pages: the grid overlay, the composer, and
   the fade on scrolling regions. */
(function () {
  // G toggles the column overlay. Typing in a field never triggers it.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'g' && e.key !== 'G') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return;
    document.documentElement.classList.toggle('show-grid');
  });

  // The field grows with its text; Enter sends, Shift+Enter breaks the line.
  document.querySelectorAll('.field-input').forEach(function (el) {
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (el.form) el.form.requestSubmit();
      }
    });
  });

  // A form sends empty text only in free exploration, where an empty field
  // means "pick your own question". Anywhere else the field takes focus.
  document.querySelectorAll('form[data-composer]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      var input = form.querySelector('.field-input');
      var mode = form.querySelector('input[name="mode"]');
      if (mode && mode.value === 'free') return;
      if (input && !input.value.trim()) {
        e.preventDefault();
        input.focus();
        var hint = form.querySelector('.field-hint');
        if (hint && form.dataset.empty) {
          hint.textContent = form.dataset.empty;
          hint.classList.add('is-ask');
        }
      }
    });
  });

  // Tabs: one pressed tab. The placeholder and the hint line describe it.
  document.querySelectorAll('[data-tabs]').forEach(function (group) {
    var form = group.closest('form');
    var input = form.querySelector('.field-input');
    var hint = form.querySelector('.field-hint');
    var mode = form.querySelector('input[name="mode"]');
    var tabs = group.querySelectorAll('.tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === tab));
        });
        input.placeholder = tab.getAttribute('data-ph');
        if (hint) {
          hint.textContent = tab.getAttribute('data-hint');
          hint.classList.remove('is-ask');
        }
        form.dataset.empty = tab.getAttribute('data-empty') || '';
        if (mode) mode.value = tab.getAttribute('data-mode');
      });
    });
  });

  // Attach opens the file picker and names the file in the hint line.
  document.querySelectorAll('.field-attach').forEach(function (btn) {
    var pick = document.createElement('input');
    pick.type = 'file';
    pick.hidden = true;
    btn.after(pick);
    btn.addEventListener('click', function () {
      pick.click();
    });
    pick.addEventListener('change', function () {
      var hint = btn.closest('form').querySelector('.field-hint');
      if (pick.files.length && hint) hint.textContent = 'Attached: ' + pick.files[0].name;
    });
  });

  // A scrolling region fades at each edge that hides more content.
  function edges(el) {
    el.classList.toggle('more-above', el.scrollTop > 2);
    el.classList.toggle('more-below', el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }
  window.rasterEdges = edges;
  document.querySelectorAll('.scroll').forEach(function (el) {
    var top = document.createElement('span');
    var bottom = document.createElement('span');
    top.className = 'edge edge-top';
    bottom.className = 'edge edge-bottom';
    top.setAttribute('aria-hidden', 'true');
    bottom.setAttribute('aria-hidden', 'true');
    el.prepend(top);
    el.append(bottom);
    el.addEventListener(
      'scroll',
      function () {
        edges(el);
      },
      { passive: true },
    );
    window.addEventListener('resize', function () {
      edges(el);
    });
    edges(el);
  });
})();
