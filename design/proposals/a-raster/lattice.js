/* The background of home and session: the landing's halftone screen, at
   rest. A faint lattice of dots lies under the paper surfaces, and the
   cursor is a small light: dots near it grow, as if lit, and settle again
   when it moves on. It is the landing's idea in one quiet line, so the
   three pages read as one product.

   Rules the loop keeps:
   - Only the dots near the light are drawn each frame; the rest of the
     lattice is drawn once and copied.
   - The light eases toward the cursor and fades out when the cursor leaves
     or stops, so a still screen is a still screen.
   - The lattice is one even field. Cutting it around text left dark boxes
     in the pattern, so instead the dots stay small and faint enough to sit
     under text, and the light only lifts them a little.
   - prefers-reduced-motion, touch, or a hidden tab: the lattice only. */
(function () {
  var canvas = document.createElement('canvas');
  canvas.className = 'lattice';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  var ctx = canvas.getContext('2d');
  var base = document.createElement('canvas');
  var bctx = base.getContext('2d');
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');

  var W = 0,
    H = 0,
    dpr = 1,
    S = 12,
    margin = 40,
    ink = '#000',
    dark = false;
  var light = { x: -999, y: -999, a: 0 };
  var target = { x: -999, y: -999, on: false, t: 0 };
  var running = false,
    last = 0;
  var REACH = 180;
  function readTheme() {
    var cs = getComputedStyle(document.documentElement);
    ink = cs.getPropertyValue('--ink').trim() || '#000';
    margin = parseFloat(cs.getPropertyValue('--margin')) || 40;
    dark = document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    [canvas, base].forEach(function (c) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    });
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    readTheme();
    drawBase();
  }

  function drawBase() {
    bctx.clearRect(0, 0, W, H);
    bctx.fillStyle = ink;
    bctx.globalAlpha = dark ? 0.12 : 0.09;
    for (var y = S / 2; y < H; y += S) {
      for (var x = margin % S; x < W; x += S) {
        bctx.beginPath();
        bctx.arc(x, y, 0.6, 0, 6.2832);
        bctx.fill();
      }
    }
    bctx.globalAlpha = 1;
    draw();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0, W, H);
    if (light.a < 0.01) return;
    ctx.fillStyle = ink;
    var x0 = margin % S;
    var ys = Math.max(S / 2, Math.floor((light.y - REACH) / S) * S + S / 2);
    var xs = x0 + Math.max(0, Math.floor((light.x - REACH - x0) / S)) * S;
    for (var y = ys; y < light.y + REACH && y < H; y += S) {
      for (var x = xs; x < light.x + REACH && x < W; x += S) {
        var dx = x - light.x,
          dy = y - light.y;
        var d = Math.sqrt(dx * dx + dy * dy) / REACH;
        if (d >= 1) continue;
        // Smooth falloff: full at the centre, nothing at the reach.
        var k = (1 - d * d) * (1 - d * d) * light.a;
        ctx.globalAlpha = (dark ? 0.12 : 0.09) + k * (dark ? 0.16 : 0.14);
        ctx.beginPath();
        ctx.arc(x, y, 0.6 + k * 0.9, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function frame(t) {
    if (!running) return;
    var dt = last ? Math.min(t - last, 64) : 16;
    last = t;
    var ease = 1 - Math.pow(0.002, dt / 1000);
    light.x += (target.x - light.x) * ease;
    light.y += (target.y - light.y) * ease;
    // The light stays while the cursor moves and fades a second after it stops.
    var want = target.on && t - target.t < 1000 ? 1 : 0;
    light.a += (want - light.a) * (1 - Math.pow(0.02, dt / 1000));
    draw();
    if (want === 0 && light.a < 0.01) {
      running = false;
      light.a = 0;
      draw();
      return;
    }
    requestAnimationFrame(frame);
  }
  function start() {
    if (running || still.matches || document.hidden) return;
    running = true;
    last = 0;
    requestAnimationFrame(frame);
  }

  window.addEventListener(
    'pointermove',
    function (e) {
      if (e.pointerType === 'touch') return;
      if (!target.on || light.a < 0.01) {
        light.x = e.clientX;
        light.y = e.clientY;
      }
      target.x = e.clientX;
      target.y = e.clientY;
      target.on = true;
      target.t = performance.now();
      start();
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', function () {
    target.on = false;
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) running = false;
  });
  window.addEventListener('resize', resize);
  document.documentElement.addEventListener('themechange', resize);
  resize();
})();
