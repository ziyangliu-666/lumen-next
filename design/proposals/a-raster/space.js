/* One scene behind every page: a halftone sphere in a galaxy of stars, the
   sun fixed in the scene, a camera that circles on its own and that the
   cursor steers. It is the landing scene (light.js) made persistent, so the
   app never cuts from one background to another: each page is a shot of the
   same scene, and changing page moves the camera.

   Close round the sphere a belt of small bodies circles it; they are near
   the camera, so they stream past fast while the stars barely move, and
   that difference is the depth of the scene.

   Two giants are made of the same particles as the stars, never of solid
   surfaces: a black hole, thousands of particles circling it in a disk
   forty times the sphere's size, inner ones faster and brighter, round a
   shadow that nothing comes back from and a thin ring of bent light; and
   far off, a spiral galaxy of thousands more, turning slowly.

   Everything sits on one fixed page lattice that never moves. The sphere is
   sampled at its cells, each star lights its nearest cell, and when the
   camera moves fast each star lights the cells along its path, so a jump
   between shots prints as streaks on the grid and settles back to points.

   The theme change is printed too: from the cursor outward, every cell grows
   a dot of the new paper colour until the page is covered, the theme
   switches underneath, and the dots shrink away.

   window.lumenSpace.shot(name) moves the camera to a shot.
   window.lumenSpace.wipe(x, y, apply) runs the theme change from a point and
   calls apply() when the page is covered.

   Rules the loop keeps:
   - The sphere is always round: the camera moves, the sphere does not.
   - Every move eases in and out; nothing snaps.
   - prefers-reduced-motion: shots cut, no streaks, the theme changes at once.
   - Tab hidden: the loop stops. */
(function () {
  var canvas = document.querySelector('[data-space]');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var paper = document.createElement('canvas');
  var pctx = paper.getContext('2d');
  var veil = document.querySelector('[data-veil]');
  var vctx = veil ? veil.getContext('2d') : null;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');

  var W = 0,
    H = 0,
    dpr = 1,
    S = 8,
    margin = 40;
  var dark = false,
    inkColour = '#000',
    paperColour = '#fff';
  var running = false,
    last = 0,
    clock = 0;

  // Shots: where the sphere stands on screen (fractions of the page), how
  // big it is at rest (fraction of the page height), how near the camera is
  // (sphere radii), how much the scene shows (1 = full, lower = dimmed for
  // reading), and a turn of the camera so each shot sees a different phase.
  var SHOTS = {
    landing: { ax: 0.71, ay: 0.48, size: 0.28, dist: 3.2, show: 1, yaw: 0 },
    home: { ax: 0.86, ay: 0.16, size: 0.07, dist: 9, show: 0.42, yaw: 1.4 },
    session: { ax: 0.9, ay: 0.12, size: 0.05, dist: 12, show: 0.32, yaw: 2.6 },
    quiet: { ax: 0.88, ay: 0.14, size: 0.06, dist: 10, show: 0.36, yaw: -1.2 },
  };
  var NARROW = {
    landing: { ax: 0.5, ay: 0.2, size: 0.13, dist: 3.2, show: 1, yaw: 0 },
  };
  var from = null,
    to = null,
    tShot = 1,
    shotMs = 1600;
  var view = { ax: 0, ay: 0, size: 0, dist: 3.2, show: 1, yaw: 0 };

  var cam = { yaw: -0.7, pitch: 0.18, dist: 3.2 };
  var steer = { yaw: 0, pitch: 0 };
  var pointer = { x: 0, y: 0, on: false };
  var SUN = norm({ x: 0.85, y: 0.35, z: 0.4 });
  var stars = new Float32Array(0),
    trail = new Float32Array(0);

  // The belt: angle, distance from the sphere and height, per body. Seeded.
  var belt = (function () {
    var n = 520,
      seed = 5,
      out = new Float32Array(n * 3);
    function rnd() {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    }
    for (var i = 0; i < n; i++) {
      out[i * 3] = rnd() * 6.2832;
      out[i * 3 + 1] = 1.9 + rnd() * 0.9;
      out[i * 3 + 2] = (rnd() - 0.5) * 0.12;
    }
    return out;
  })();

  // The giants, as particle clouds. Positions are in sphere radii.
  function seeded(seed) {
    return function () {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
  }
  function axes(n) {
    n = norm(n);
    var a = Math.abs(n.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    var u = norm({ x: a.y * n.z - a.z * n.y, y: a.z * n.x - a.x * n.z, z: a.x * n.y - a.y * n.x });
    var w = { x: n.y * u.z - n.z * u.y, y: n.z * u.x - n.x * u.z, z: n.x * u.y - n.y * u.x };
    return { n: n, u: u, w: w };
  }
  // The black hole: behind the sphere from the landing shot, tilted so the
  // disk is seen nearly edge-on from most of the orbit.
  var HOLE = { c: { x: -40, y: -5, z: -48 }, shadow: 5, f: axes({ x: 0.2, y: 1, z: 0.35 }) };
  var disk = (function () {
    var n = 5200,
      rnd = seeded(23),
      out = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      // More particles near the inside, where the disk is hottest.
      var r = 7 + Math.pow(rnd(), 1.8) * 22;
      out[i * 3] = rnd() * 6.2832;
      out[i * 3 + 1] = r;
      out[i * 3 + 2] = (rnd() - 0.5) * 0.5 * (r / 12);
    }
    return out;
  })();
  // The galaxy: far, large, seen from above its plane.
  var GAL = { c: { x: 170, y: -20, z: 300 }, r: 160, f: axes({ x: -0.45, y: -0.8, z: -0.6 }) };
  var galaxy = (function () {
    var n = 6000,
      rnd = seeded(41),
      out = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var core = rnd() < 0.28;
      var t = core ? Math.pow(rnd(), 2) * 0.18 : 0.08 + rnd() * 0.92;
      // Two logarithmic arms, with scatter that grows outward.
      var arm = rnd() < 0.5 ? 0 : Math.PI;
      var a = core ? rnd() * 6.2832 : arm + Math.log(t) * 2.4 + (rnd() - 0.5) * (0.35 + t * 0.6);
      out[i * 3] = a;
      out[i * 3 + 1] = t;
      out[i * 3 + 2] = rnd();
    }
    return out;
  })();

  // The theme wipe: its origin, its clock, and what to call when covered.
  var wipe = null;

  function norm(v) {
    var l = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    return { x: v.x / l, y: v.y / l, z: v.z / l };
  }
  function css(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v ? parseFloat(v) : fallback;
  }
  function readTheme() {
    var cs = getComputedStyle(document.documentElement);
    dark = document.documentElement.getAttribute('data-theme') === 'dark';
    inkColour = cs.getPropertyValue('--ink').trim() || '#000';
    paperColour = cs.getPropertyValue('--paper').trim() || '#fff';
  }
  function shotFor(name) {
    var narrow = W < 720;
    return (narrow && NARROW[name]) || SHOTS[name] || SHOTS.quiet;
  }
  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    [canvas, paper, veil].forEach(function (c) {
      if (!c) return;
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      c.style.width = W + 'px';
      c.style.height = H + 'px';
    });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (vctx) vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    margin = css('--margin', 40);
    readTheme();
    S = W < 720 ? 7 : 8;
    if (!stars.length) seedStars();
    if (!to) {
      to = shotFor(document.documentElement.getAttribute('data-shot') || 'landing');
      from = to;
      tShot = 1;
    }
    blend();
    drawPaper();
    draw(0);
  }

  // Stars in a shell round the sphere: most in a tilted band, the galaxy.
  // Seeded, so the sky is the same sky on every load.
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
    trail = new Float32Array(n * 2).fill(-1);
    var tilt = 0.5,
      ct = Math.cos(tilt),
      st = Math.sin(tilt);
    for (var i = 0; i < n; i++) {
      var a = rnd() * 6.2832;
      var y = rnd() < 0.65 ? gauss() * 0.12 : rnd() * 2 - 1;
      var r = Math.sqrt(Math.max(0, 1 - y * y));
      var x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      var dist = 6 + rnd() * 14;
      stars[i * 4] = (x * ct + y * st) * dist;
      stars[i * 4 + 1] = (y * ct - x * st) * dist;
      stars[i * 4 + 2] = z * dist;
      stars[i * 4 + 3] = rnd();
    }
  }

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

  function snapX(x) {
    var x0 = margin % S;
    return x0 + Math.round((x - x0) / S) * S;
  }
  function snapY(y) {
    return S / 2 + Math.round((y - S / 2) / S) * S;
  }

  function dot(x, y, ink) {
    var rad = S * 0.56 * Math.sqrt(ink);
    if (rad < 0.55) return;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, 6.2832);
    ctx.fill();
  }

  // The shot in between two shots, by the eased clock of the move.
  function blend() {
    var k = ease(Math.min(1, tShot));
    for (var key in view) view[key] = from[key] + (to[key] - from[key]) * k;
  }

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
    return {
      right: right,
      up: up,
      fwd: fwd,
      pos: { x: -fwd.x * cam.dist, y: -fwd.y * cam.dist, z: -fwd.z * cam.dist },
    };
  }

  function draw(speed) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(paper, 0, 0, W, H);
    ctx.fillStyle = inkColour;
    var B = basis();
    var x0 = margin % S;
    var cx = view.ax * W,
      cy = view.ay * H;
    var restR = view.size * H;
    var focal = restR * Math.sqrt(view.dist * view.dist - 1);
    var R = focal / Math.sqrt(cam.dist * cam.dist - 1);
    var show = view.show;
    // Streaks only while the camera moves fast; their length follows speed.
    var streak = still.matches ? 0 : Math.min(1, speed);

    for (var i = 0, j = 0; i < stars.length; i += 4, j += 2) {
      var px = stars[i] - B.pos.x,
        py = stars[i + 1] - B.pos.y,
        pz = stars[i + 2] - B.pos.z;
      var vz = px * B.fwd.x + py * B.fwd.y + pz * B.fwd.z;
      if (vz < 0.5) {
        trail[j] = -1;
        continue;
      }
      var vx = px * B.right.x + py * B.right.y + pz * B.right.z;
      var vy = px * B.up.x + py * B.up.y + pz * B.up.z;
      var sx = cx + (focal * vx) / vz,
        sy = cy - (focal * vy) / vz;
      var lastX = trail[j],
        lastY = trail[j + 1];
      trail[j] = sx;
      trail[j + 1] = sy;
      if (sx < -S || sx > W + S || sy < -S || sy > H + S) continue;
      var ox = sx - cx,
        oy = sy - cy;
      if (ox * ox + oy * oy < R * R * 1.1 && vz > cam.dist) continue;
      var seed = stars[i + 3];
      var near = Math.min(1, 9 / vz);
      var beat = still.matches
        ? 0.7
        : 0.55 + 0.45 * Math.sin((clock / (2500 + seed * 5000)) * 6.2832 + seed * 40);
      var alpha = ((dark ? 0.2 : 0.1) + near * beat * (dark ? 0.75 : 0.4)) * (0.45 + 0.55 * show);
      // A streak: the cells between where the star was and where it is,
      // fading toward the old end.
      if (streak > 0.05 && lastX >= 0) {
        var dx = sx - lastX,
          dy = sy - lastY;
        var len = Math.sqrt(dx * dx + dy * dy);
        var steps = Math.min(40, Math.floor((len * (2 + streak * 6)) / S));
        for (var k = 1; k <= steps; k++) {
          var f = k / (steps + 1);
          ctx.globalAlpha = alpha * (1 - f) * streak;
          ctx.beginPath();
          ctx.arc(
            snapX(sx - dx * f * (2 + streak * 6)),
            snapY(sy - dy * f * (2 + streak * 6)),
            0.6 + near * 0.6,
            0,
            6.2832,
          );
          ctx.fill();
        }
      }
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(snapX(sx), snapY(sy), 0.6 + near * (0.5 + seed * 1.1) * beat, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    var lx = SUN.x * B.right.x + SUN.y * B.right.y + SUN.z * B.right.z;
    var ly = -(SUN.x * B.up.x + SUN.y * B.up.y + SUN.z * B.up.z);
    var lz = -(SUN.x * B.fwd.x + SUN.y * B.fwd.y + SUN.z * B.fwd.z);
    if (R > S * 0.6) {
      var ya = Math.floor((cy - R) / S) * S + S / 2;
      ctx.globalAlpha = 0.35 + 0.65 * show;
      for (var y = ya; y < cy + R; y += S) {
        for (var x = x0 + Math.floor((cx - R - x0) / S) * S; x < cx + R; x += S) {
          var nx = (x - cx) / R,
            ny = (y - cy) / R;
          var q = nx * nx + ny * ny;
          if (q > 1) continue;
          var nz = Math.sqrt(1 - q);
          var ndl = nx * lx + ny * ly + nz * lz;
          var lambert = Math.max(0, (ndl + 0.15) / 1.15);
          var rz = Math.min(1, Math.max(0, 2 * ndl * nz - lz));
          var lit = Math.min(1, 0.04 + 0.86 * lambert + 0.3 * Math.pow(rz, 24));
          var cover = Math.max(0, Math.min(1, ((1 - Math.sqrt(q)) * R) / S + 0.5));
          if (dark) dot(x, y, cover * Math.min(0.7, 0.74 * Math.pow(lit, 1.3)));
          else dot(x, y, cover * Math.max(0.03, (0.4 + 0.6 * nz) * 0.66 * Math.pow(1 - lit, 1.2)));
        }
      }
      ctx.globalAlpha = 1;
    }
    drawGiants(B, cx, cy, focal, R, show);
    drawBelt(B, cx, cy, focal, R, show);
  }

  // One particle: project it, hide it behind the sphere or the hole's
  // shadow, and print it in its lattice cell.
  function particle(B, cx, cy, focal, R, wx, wy, wz, alpha, size, hole) {
    var px = wx - B.pos.x,
      py = wy - B.pos.y,
      pz = wz - B.pos.z;
    var vz = px * B.fwd.x + py * B.fwd.y + pz * B.fwd.z;
    if (vz < 0.5) return;
    var sx = cx + (focal * (px * B.right.x + py * B.right.y + pz * B.right.z)) / vz;
    var sy = cy - (focal * (px * B.up.x + py * B.up.y + pz * B.up.z)) / vz;
    if (sx < 0 || sx > W || sy < 0 || sy > H) return;
    var ox = sx - cx,
      oy = sy - cy;
    if (ox * ox + oy * oy < R * R && vz > cam.dist) return;
    if (hole && vz > hole.z) {
      var hx = sx - hole.x,
        hy = sy - hole.y;
      if (hx * hx + hy * hy < hole.r * hole.r) return;
    }
    var x0 = margin % S;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(
      x0 + Math.round((sx - x0) / S) * S,
      S / 2 + Math.round((sy - S / 2) / S) * S,
      size,
      0,
      6.2832,
    );
    ctx.fill();
  }

  function drawGiants(B, cx, cy, focal, R, show) {
    var t = clock / 1000;
    var level = (dark ? 0.9 : 0.55) * (0.35 + 0.65 * show);
    ctx.fillStyle = inkColour;

    // The galaxy turns once every ten minutes.
    var gf = GAL.f,
      gs = (t * 6.2832) / 600;
    for (var i = 0; i < galaxy.length; i += 3) {
      var a = galaxy[i] + gs,
        r = galaxy[i + 1] * GAL.r;
      var u = Math.cos(a) * r,
        w = Math.sin(a) * r;
      var h = (galaxy[i + 2] - 0.5) * GAL.r * 0.04 * (1 - galaxy[i + 1]);
      var bright = galaxy[i + 1] < 0.18 ? 0.8 : 0.25 + 0.4 * galaxy[i + 2];
      particle(
        B,
        cx,
        cy,
        focal,
        R,
        GAL.c.x + gf.u.x * u + gf.w.x * w + gf.n.x * h,
        GAL.c.y + gf.u.y * u + gf.w.y * w + gf.n.y * h,
        GAL.c.z + gf.u.z * u + gf.w.z * w + gf.n.z * h,
        level * bright * 0.6,
        0.6 + bright * 0.5,
        null,
      );
    }

    // The hole: where its shadow falls on screen.
    var hp = { x: HOLE.c.x - B.pos.x, y: HOLE.c.y - B.pos.y, z: HOLE.c.z - B.pos.z };
    var hz = hp.x * B.fwd.x + hp.y * B.fwd.y + hp.z * B.fwd.z;
    if (hz < 1) return;
    var hole = {
      x: cx + (focal * (hp.x * B.right.x + hp.y * B.right.y + hp.z * B.right.z)) / hz,
      y: cy - (focal * (hp.x * B.up.x + hp.y * B.up.y + hp.z * B.up.z)) / hz,
      r: (focal * HOLE.shadow) / hz,
      z: hz,
    };
    // The disk: each particle circles at a speed that falls off with
    // distance, as in any orbit; inner particles are brighter.
    var f = HOLE.f;
    for (var j = 0; j < disk.length; j += 3) {
      var dr = disk[j + 1];
      var da = disk[j] + t * 0.9 * Math.pow(7 / dr, 1.5);
      var du = Math.cos(da) * dr,
        dw = Math.sin(da) * dr,
        dh = disk[j + 2];
      var heat = Math.pow(7 / dr, 1.3);
      particle(
        B,
        cx,
        cy,
        focal,
        R,
        HOLE.c.x + f.u.x * du + f.w.x * dw + f.n.x * dh,
        HOLE.c.y + f.u.y * du + f.w.y * dw + f.n.y * dh,
        HOLE.c.z + f.u.z * du + f.w.z * dw + f.n.z * dh,
        level * (0.3 + 0.7 * heat),
        0.6 + heat * 1.2,
        hole,
      );
    }
    // The ring of bent light: a thin circle of particles just outside the
    // shadow, always facing the camera, as light round a black hole does.
    var n = Math.max(24, Math.floor((6.2832 * hole.r * 1.12) / S));
    var x0 = margin % S;
    ctx.globalAlpha = level;
    for (var k = 0; k < n; k++) {
      var ra = (k / n) * 6.2832;
      var rx = hole.x + Math.cos(ra) * hole.r * 1.12,
        ry = hole.y + Math.sin(ra) * hole.r * 1.12;
      ctx.beginPath();
      ctx.arc(
        x0 + Math.round((rx - x0) / S) * S,
        S / 2 + Math.round((ry - S / 2) / S) * S,
        1.3,
        0,
        6.2832,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // The belt, drawn after the sphere: a body in front of the sphere prints
  // over it, a body behind the sphere is hidden by it. Inner bodies turn
  // faster than outer ones, as in any orbit.
  function drawBelt(B, cx, cy, focal, R, show) {
    var x0 = margin % S;
    var spin = ((clock / 1000) * 6.2832) / 90;
    ctx.fillStyle = inkColour;
    for (var i = 0; i < belt.length; i += 3) {
      var a = belt[i] + spin * Math.pow(2.2 / belt[i + 1], 1.5);
      var r = belt[i + 1];
      var wx = Math.cos(a) * r,
        wy = belt[i + 2] + Math.cos(a) * 0.22,
        wz = Math.sin(a) * r;
      var px = wx - B.pos.x,
        py = wy - B.pos.y,
        pz = wz - B.pos.z;
      var vz = px * B.fwd.x + py * B.fwd.y + pz * B.fwd.z;
      if (vz < 0.3) continue;
      var sx = cx + (focal * (px * B.right.x + py * B.right.y + pz * B.right.z)) / vz;
      var sy = cy - (focal * (px * B.up.x + py * B.up.y + pz * B.up.z)) / vz;
      var ox = sx - cx,
        oy = sy - cy;
      if (ox * ox + oy * oy < R * R && vz > cam.dist) continue;
      var near = Math.min(1, 2.4 / vz);
      ctx.globalAlpha = (dark ? 0.85 : 0.6) * (0.4 + 0.6 * show);
      ctx.beginPath();
      ctx.arc(
        x0 + Math.round((sx - x0) / S) * S,
        S / 2 + Math.round((sy - S / 2) / S) * S,
        0.7 + near * 1.6,
        0,
        6.2832,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // The theme wipe, on its own canvas above the page. Phase one: dots of the
  // new paper colour grow cell by cell, outward from the origin, until they
  // cover the page. Then the theme changes. Phase two: they shrink away in
  // the same order, uncovering the page in its new colours.
  var GROW = 520,
    HOLD = 60,
    SPREAD = 480;
  function drawWipe() {
    if (!wipe || !vctx) return;
    var t = clock - wipe.t0;
    vctx.clearRect(0, 0, W, H);
    var far = Math.sqrt(
      Math.max(wipe.x, W - wipe.x) * Math.max(wipe.x, W - wipe.x) +
        Math.max(wipe.y, H - wipe.y) * Math.max(wipe.y, H - wipe.y),
    );
    var covering = t < GROW + SPREAD;
    if (!covering && !wipe.applied) {
      wipe.applied = true;
      wipe.apply();
      readTheme();
      drawPaper();
    }
    var t2 = t - GROW - SPREAD - HOLD;
    if (t2 > GROW + SPREAD) {
      vctx.clearRect(0, 0, W, H);
      veil.hidden = true;
      wipe = null;
      return;
    }
    vctx.fillStyle = wipe.colour;
    var x0 = margin % S,
      full = S * 0.75;
    for (var y = S / 2; y < H + S; y += S) {
      for (var x = x0; x < W + S; x += S) {
        var d = Math.sqrt((x - wipe.x) * (x - wipe.x) + (y - wipe.y) * (y - wipe.y)) / far;
        var local = covering ? (t - d * SPREAD) / GROW : 1 - (t2 - d * SPREAD) / GROW;
        local = Math.max(0, Math.min(1, local));
        if (local <= 0) continue;
        vctx.beginPath();
        vctx.arc(x, y, full * ease(local), 0, 6.2832);
        vctx.fill();
      }
    }
  }

  var prevYaw = 0,
    prevDist = 0;
  function frame(t) {
    if (!running) return;
    var dt = last ? Math.min(t - last, 64) : 16;
    last = t;
    clock += dt;
    var s = clock / 1000;
    if (tShot < 1) {
      tShot = Math.min(1, tShot + dt / shotMs);
      blend();
    }
    var wantYaw = 0,
      wantPitch = 0;
    if (pointer.on) {
      // Close up the cursor turns the camera a long way; from far away, a
      // little, so reading pages stay calm.
      var reach = view.show;
      wantYaw = (pointer.x / W - 0.5) * 2.4 * reach;
      wantPitch = (pointer.y / H - 0.5) * 0.9 * reach;
    }
    var e = 1 - Math.pow(0.06, dt / 1000);
    steer.yaw += (wantYaw - steer.yaw) * e;
    steer.pitch += (wantPitch - steer.pitch) * e;
    cam.yaw = -0.7 + (s * 6.2832) / 60 + steer.yaw + view.yaw;
    cam.pitch = Math.max(-1.1, Math.min(1.1, 0.18 + Math.sin(s * 0.21) * 0.22 + steer.pitch));
    cam.dist = view.dist * (1 + 0.16 * Math.sin(s * 0.17) + 0.06 * Math.sin(s * 0.41 + 1));
    // How fast the view is changing, for the streaks.
    var speed =
      (Math.abs(cam.yaw - prevYaw) * 60 + Math.abs(cam.dist - prevDist) * 6) / Math.max(1, dt / 16);
    prevYaw = cam.yaw;
    prevDist = cam.dist;
    draw(Math.max(0, speed - 0.25));
    drawWipe();
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

  window.lumenSpace = {
    shot: function (name) {
      var next = shotFor(name);
      document.documentElement.setAttribute('data-shot', name);
      if (still.matches) {
        from = next;
        to = next;
        tShot = 1;
        blend();
        draw(0);
        return;
      }
      from = {
        ax: view.ax,
        ay: view.ay,
        size: view.size,
        dist: view.dist,
        show: view.show,
        yaw: view.yaw,
      };
      to = next;
      tShot = 0;
    },
    wipe: function (x, y, apply) {
      if (still.matches || !vctx) {
        apply();
        readTheme();
        drawPaper();
        draw(0);
        return;
      }
      // The new paper colour: the opposite theme's paper.
      var colour = dark ? '#FFFFFF' : '#000000';
      veil.hidden = false;
      wipe = { x: x, y: y, t0: clock, apply: apply, applied: false, colour: colour };
    },
  };

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
  document.documentElement.addEventListener('themechange', function () {
    readTheme();
    drawPaper();
  });

  resize();
  start();
})();
