/* The landing image for direction A. A lumen is the unit of luminous flux,
   so the page is a halftone print of a lit sphere in space.

   It is a small 3D scene seen through a camera. The sphere sits at the
   centre of a field of stars, most of them in one tilted band, a galaxy.
   The sun is fixed in the scene. The camera circles the sphere on its own,
   drifts nearer and farther, and the cursor turns it: moving the cursor is
   looking round the sphere. So the sphere goes through its phases as the
   camera passes between it and the sun, it grows and shrinks with the
   distance, and the stars wheel past, the near ones faster than the far.

   It is printed, not rendered. The page has one fixed lattice, the faint
   grid of the paper, and it never moves. Every dot sits on it: the sphere is
   sampled at its cells and each star lights the cell nearest to it. Only
   what each cell prints changes as the view turns, the way a halftone
   screen does.

   Rules the loop keeps:
   - The sphere is always round: the camera moves, the sphere does not.
   - The camera always turns a little on its own; the cursor only steers it,
     and it eases there and never snaps, like a heavy camera on a head.
   - prefers-reduced-motion: one still frame, a three-quarter phase.
   - Tab hidden: the loop stops, so an idle tab costs nothing.
   - Dark theme: the page prints light, not ink. Dot area carries how much
     light a point returns, so the lit side is dense and the far side is gone,
     and stars are light. Light theme: ink prints the shadow, stars are ink. */
(function () {
  var canvas = document.querySelector('[data-light]');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var paper = document.createElement('canvas');
  var pctx = paper.getContext('2d');
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');

  var W = 0,
    H = 0,
    dpr = 1,
    S = 8,
    margin = 40;
  var dark = false,
    inkColour = '#000';
  var running = false,
    last = 0,
    clock = 0;

  // Where the sphere's centre appears on screen, and its size at rest.
  var anchor = { x: 0, y: 0 },
    restR = 0,
    focal = 0;
  // The camera: turned by yaw and pitch, at a distance in sphere radii.
  var D0 = 3.2;
  var cam = { yaw: -0.7, pitch: 0.18, dist: D0 };
  var steer = { yaw: 0, pitch: 0 };
  var pointer = { x: 0, y: 0, on: false };
  // The sun, fixed in the scene: up and to one side.
  var SUN = norm({ x: 0.85, y: 0.35, z: 0.4 });
  var stars = new Float32Array(0);

  function norm(v) {
    var l = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    return { x: v.x / l, y: v.y / l, z: v.z / l };
  }
  function css(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v ? parseFloat(v) : fallback;
  }
  function readTheme() {
    dark = document.documentElement.getAttribute('data-theme') === 'dark';
    inkColour =
      getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#000';
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    [canvas, paper].forEach(function (c) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    });
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    margin = css('--margin', 40);
    readTheme();
    var narrow = W < 720;
    S = narrow ? 7 : 8;
    // Desktop: the sphere stands right of the text column, on its centre
    // line. Narrow: it is centred above the text.
    restR = narrow ? Math.min(W * 0.26, H * 0.13) : Math.min(H * 0.28, W * 0.2);
    anchor.x = narrow ? W * 0.5 : W - margin - restR - W * 0.06;
    anchor.y = narrow ? H * 0.2 : H * 0.48;
    // The focal length that shows a unit sphere at restR from distance D0.
    focal = restR * Math.sqrt(D0 * D0 - 1);
    if (!stars.length) seedStars();
    drawPaper();
    draw();
  }

  // Stars in a shell round the sphere: most in a tilted band, the galaxy,
  // the rest anywhere. Seeded, so the sky is the same sky on every load.
  function seedStars() {
    var n = 1400,
      seed = 11;
    function rnd() {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    }
    function gauss() {
      return Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(6.2832 * rnd());
    }
    stars = new Float32Array(n * 4);
    var tilt = 0.5,
      ct = Math.cos(tilt),
      st = Math.sin(tilt);
    for (var i = 0; i < n; i++) {
      var a = rnd() * 6.2832;
      var band = rnd() < 0.65;
      var y = band ? gauss() * 0.12 : rnd() * 2 - 1;
      var r = Math.sqrt(Math.max(0, 1 - y * y));
      var x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      // Tilt the band out of the horizontal.
      var ty = y * ct - x * st,
        tx = x * ct + y * st;
      var dist = 6 + rnd() * 14;
      stars[i * 4] = tx * dist;
      stars[i * 4 + 1] = ty * dist;
      stars[i * 4 + 2] = z * dist;
      stars[i * 4 + 3] = rnd();
    }
  }

  // The empty paper: the fixed lattice, drawn once and copied every frame.
  function drawPaper() {
    pctx.clearRect(0, 0, W, H);
    pctx.fillStyle = inkColour;
    pctx.globalAlpha = dark ? 0.12 : 0.09;
    var x0 = margin % S;
    for (var y = S / 2; y < H; y += S) {
      for (var x = x0; x < W; x += S) {
        pctx.beginPath();
        pctx.arc(x, y, 0.55, 0, 6.2832);
        pctx.fill();
      }
    }
    pctx.globalAlpha = 1;
  }

  function dot(x, y, ink) {
    // Area, not radius, carries the tone, as on a real halftone screen.
    var rad = S * 0.56 * Math.sqrt(ink);
    if (rad < 0.55) return;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, 6.2832);
    ctx.fill();
  }

  // The camera orbits the origin and looks at it. Its axes in world space:
  // right, up, and forward toward the sphere.
  function basis() {
    var cy = Math.cos(cam.yaw),
      sy = Math.sin(cam.yaw);
    var cp = Math.cos(cam.pitch),
      sp = Math.sin(cam.pitch);
    var fwd = { x: -sy * cp, y: -sp, z: -cy * cp };
    var right = { x: cy, y: 0, z: -sy };
    var up = {
      x: right.y * fwd.z - right.z * fwd.y,
      y: right.z * fwd.x - right.x * fwd.z,
      z: right.x * fwd.y - right.y * fwd.x,
    };
    var pos = { x: -fwd.x * cam.dist, y: -fwd.y * cam.dist, z: -fwd.z * cam.dist };
    return { right: right, up: up, fwd: fwd, pos: pos };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(paper, 0, 0, W, H);
    ctx.fillStyle = inkColour;
    var B = basis();
    var x0 = margin % S;
    var R = focal / Math.sqrt(cam.dist * cam.dist - 1);
    var cx = anchor.x,
      cy = anchor.y;

    // Stars: project, then light the nearest lattice cell.
    for (var i = 0; i < stars.length; i += 4) {
      var px = stars[i] - B.pos.x,
        py = stars[i + 1] - B.pos.y,
        pz = stars[i + 2] - B.pos.z;
      var vz = px * B.fwd.x + py * B.fwd.y + pz * B.fwd.z;
      if (vz < 0.5) continue;
      var vx = px * B.right.x + py * B.right.y + pz * B.right.z;
      var vy = px * B.up.x + py * B.up.y + pz * B.up.z;
      var sx = cx + (focal * vx) / vz,
        sy = cy - (focal * vy) / vz;
      if (sx < 0 || sx > W || sy < 0 || sy > H) continue;
      sx = x0 + Math.round((sx - x0) / S) * S;
      sy = S / 2 + Math.round((sy - S / 2) / S) * S;
      // Behind the sphere: hidden.
      var ox = sx - cx,
        oy = sy - cy;
      if (ox * ox + oy * oy < R * R * 1.1 && vz > cam.dist) continue;
      var seed = stars[i + 3];
      var near = Math.min(1, 9 / vz);
      var beat = still.matches
        ? 0.7
        : 0.55 + 0.45 * Math.sin((clock / (2500 + seed * 5000)) * 6.2832 + seed * 40);
      ctx.globalAlpha = (dark ? 0.2 : 0.1) + near * beat * (dark ? 0.75 : 0.4);
      ctx.beginPath();
      ctx.arc(sx, sy, 0.6 + near * (0.5 + seed * 1.1) * beat, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // The sun, seen from the camera (screen y points down).
    var lx = SUN.x * B.right.x + SUN.y * B.right.y + SUN.z * B.right.z;
    var ly = -(SUN.x * B.up.x + SUN.y * B.up.y + SUN.z * B.up.z);
    var lz = -(SUN.x * B.fwd.x + SUN.y * B.fwd.y + SUN.z * B.fwd.z);

    // The sphere, sampled at the lattice cells it covers.
    var ya = Math.floor((cy - R) / S) * S + S / 2;
    for (var y = ya; y < cy + R; y += S) {
      for (var x = x0 + Math.floor((cx - R - x0) / S) * S; x < cx + R; x += S) {
        var nx = (x - cx) / R,
          ny = (y - cy) / R;
        var q = nx * nx + ny * ny;
        if (q > 1) continue;
        var nz = Math.sqrt(1 - q);
        var ndl = nx * lx + ny * ly + nz * lz;
        // A soft terminator, so the edge of a crescent prints as a gradient.
        var lambert = Math.max(0, (ndl + 0.15) / 1.15);
        var rz = Math.min(1, Math.max(0, 2 * ndl * nz - lz));
        var spec = Math.pow(rz, 24);
        var lit = Math.min(1, 0.04 + 0.86 * lambert + 0.3 * spec);
        // Dots on the outline shrink by how much of their cell is inside the
        // circle, so the edge reads round rather than stepped.
        var cover = Math.max(0, Math.min(1, ((1 - Math.sqrt(q)) * R) / S + 0.5));
        if (dark) dot(x, y, cover * Math.min(0.7, 0.74 * Math.pow(lit, 1.3)));
        // On paper the limb would print as a solid ring; ink thins toward it,
        // the way a printer opens up the darkest tones.
        else dot(x, y, cover * Math.max(0.03, (0.4 + 0.6 * nz) * 0.66 * Math.pow(1 - lit, 1.2)));
      }
    }
  }

  function frame(t) {
    if (!running) return;
    var dt = last ? Math.min(t - last, 64) : 16;
    last = t;
    clock += dt;
    var s = clock / 1000;
    // The cursor steers: across the page turns the camera round the sphere,
    // up and down tilts it.
    var wantYaw = 0,
      wantPitch = 0;
    if (pointer.on) {
      wantYaw = (pointer.x / W - 0.5) * 2.4;
      wantPitch = (pointer.y / H - 0.5) * 0.9;
    }
    var ease = 1 - Math.pow(0.06, dt / 1000);
    steer.yaw += (wantYaw - steer.yaw) * ease;
    steer.pitch += (wantPitch - steer.pitch) * ease;
    // On its own the camera circles once a minute, rises and falls, and
    // comes nearer and goes farther on slower beats.
    cam.yaw = -0.7 + (s * 6.2832) / 60 + steer.yaw;
    cam.pitch = Math.max(-1.1, Math.min(1.1, 0.18 + Math.sin(s * 0.21) * 0.22 + steer.pitch));
    cam.dist = D0 * (1 + 0.16 * Math.sin(s * 0.17) + 0.06 * Math.sin(s * 0.41 + 1));
    draw();
    requestAnimationFrame(frame);
  }

  function start() {
    if (running || still.matches || document.hidden) return;
    running = true;
    last = 0;
    requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
  }

  window.addEventListener(
    'pointermove',
    function (e) {
      if (e.pointerType === 'touch') return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.on = true;
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', function () {
    pointer.on = false;
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else start();
  });
  still.addEventListener('change', function () {
    if (still.matches) {
      stop();
      resize();
    } else start();
  });
  window.addEventListener('resize', resize);
  document.documentElement.addEventListener('themechange', resize);

  resize();
  start();
})();
