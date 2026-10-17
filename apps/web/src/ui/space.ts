import { fitToViewport, readCanvasTheme, watchThemeClass } from '@/ui/canvas-theme';

/* One scene behind every page: a halftone sphere in a galaxy of stars, the
   sun fixed in the scene, a camera that circles on its own and that the
   cursor steers. It is the landing scene made persistent, so the app never
   cuts from one background to another: each page is a shot of the same
   scene, and changing page moves the camera. The shell mounts it once
   (core/shell).

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

   shot(name) moves the camera to a shot.
   wipe(x, y, apply) runs the theme change from a point and calls apply()
   when the page is covered.

   Rules the loop keeps:
   - The sphere is always round: the camera moves, the sphere does not.
   - Every move eases in and out; nothing snaps.
   - prefers-reduced-motion: shots cut, no streaks, the theme changes at once.
   - Tab hidden: the loop stops. */

export type ShotName = 'landing' | 'home' | 'session' | 'quiet';

export interface Space {
  /** Moves the camera to a shot, eased; with reduced motion, cuts to it. */
  shot(name: ShotName): void;
  /**
   * Runs the theme change from a point on the screen and calls `apply` once
   * the page is covered. With reduced motion, calls it at once.
   */
  wipe(x: number, y: number, apply: () => void): void;
  /** The last place a pointer was seen, or the centre of the screen. */
  pointer(): { x: number; y: number };
  /** Stops the loop and lets go of every listener. */
  destroy(): void;
}

interface Shot {
  ax: number;
  ay: number;
  size: number;
  dist: number;
  show: number;
  yaw: number;
}

interface Vec {
  x: number;
  y: number;
  z: number;
}

interface Basis {
  right: Vec;
  up: Vec;
  fwd: Vec;
  pos: Vec;
}

interface Frame {
  n: Vec;
  u: Vec;
  w: Vec;
}

interface Star {
  x: number;
  y: number;
  z: number;
  seed: number;
  /** Where the star printed on the last frame, for its streak; -1 when off screen. */
  lastX: number;
  lastY: number;
}

/** Angle, radius and height of one orbiting particle (belt and disk). */
interface Orbit {
  a: number;
  r: number;
  h: number;
}

/** Angle, distance from the centre (0 to 1) and a random tone, per galaxy particle. */
interface GalaxyParticle {
  a: number;
  t: number;
  tone: number;
}

interface HoleOnScreen {
  x: number;
  y: number;
  r: number;
  z: number;
}

interface Wipe {
  x: number;
  y: number;
  t0: number;
  apply: () => void;
  applied: boolean;
  colour: string;
}

const TAU = 6.2832;

// Shots: where the sphere stands on screen (fractions of the page), how
// big it is at rest (fraction of the page height), how near the camera is
// (sphere radii), how much the scene shows (1 = full, lower = dimmed for
// reading), and a turn of the camera so each shot sees a different phase.
const SHOTS: Record<ShotName, Shot> = {
  landing: { ax: 0.71, ay: 0.48, size: 0.28, dist: 3.2, show: 1, yaw: 0 },
  home: { ax: 0.86, ay: 0.16, size: 0.07, dist: 9, show: 0.42, yaw: 1.4 },
  session: { ax: 0.9, ay: 0.12, size: 0.05, dist: 12, show: 0.32, yaw: 2.6 },
  quiet: { ax: 0.88, ay: 0.14, size: 0.06, dist: 10, show: 0.36, yaw: -1.2 },
};
const NARROW: Partial<Record<ShotName, Shot>> = {
  landing: { ax: 0.5, ay: 0.2, size: 0.13, dist: 3.2, show: 1, yaw: 0 },
};
const SHOT_MS = 1600;

// The theme wipe: phase one, dots of the new paper colour grow cell by
// cell, outward from the origin, until they cover the page. Then the theme
// changes. Phase two: they shrink away in the same order, uncovering the
// page in its new colours.
const GROW = 520;
const HOLD = 60;
const SPREAD = 480;

function norm(v: Vec): Vec {
  const l = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function seeded(start: number): () => number {
  let seed = start;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

function axes(normal: Vec): Frame {
  const n = norm(normal);
  const a = Math.abs(n.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const u = norm({ x: a.y * n.z - a.z * n.y, y: a.z * n.x - a.x * n.z, z: a.x * n.y - a.y * n.x });
  const w = { x: n.y * u.z - n.z * u.y, y: n.z * u.x - n.x * u.z, z: n.x * u.y - n.y * u.x };
  return { n, u, w };
}

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const SUN = norm({ x: 0.85, y: 0.35, z: 0.4 });

// The belt: angle, distance from the sphere and height, per body. Seeded.
const BELT: readonly Orbit[] = (() => {
  const rnd = seeded(5);
  return Array.from({ length: 520 }, () => ({
    a: rnd() * TAU,
    r: 1.9 + rnd() * 0.9,
    h: (rnd() - 0.5) * 0.12,
  }));
})();

// The giants, as particle clouds. Positions are in sphere radii.
// The black hole: behind the sphere from the landing shot, tilted so the
// disk is seen nearly edge-on from most of the orbit.
const HOLE = { c: { x: -40, y: -5, z: -48 }, shadow: 5, f: axes({ x: 0.2, y: 1, z: 0.35 }) };
const DISK: readonly Orbit[] = (() => {
  const rnd = seeded(23);
  return Array.from({ length: 5200 }, () => {
    // More particles near the inside, where the disk is hottest.
    const r = 7 + Math.pow(rnd(), 1.8) * 22;
    return { a: rnd() * TAU, r, h: (rnd() - 0.5) * 0.5 * (r / 12) };
  });
})();
// The galaxy: far, large, seen from above its plane.
const GAL = { c: { x: 170, y: -20, z: 300 }, r: 160, f: axes({ x: -0.45, y: -0.8, z: -0.6 }) };
const GALAXY: readonly GalaxyParticle[] = (() => {
  const rnd = seeded(41);
  return Array.from({ length: 6000 }, () => {
    const core = rnd() < 0.28;
    const t = core ? Math.pow(rnd(), 2) * 0.18 : 0.08 + rnd() * 0.92;
    // Two logarithmic arms, with scatter that grows outward.
    const arm = rnd() < 0.5 ? 0 : Math.PI;
    const a = core ? rnd() * TAU : arm + Math.log(t) * 2.4 + (rnd() - 0.5) * (0.35 + t * 0.6);
    return { a, t, tone: rnd() };
  });
})();

// Stars in a shell round the sphere: most in a tilted band, the galaxy.
// Seeded, so the sky is the same sky on every load.
function seedStars(): Star[] {
  const rnd = seeded(11);
  const gauss = (): number => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(TAU * rnd());
  const tilt = 0.5;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  return Array.from({ length: 1400 }, () => {
    const a = rnd() * TAU;
    const y = rnd() < 0.65 ? gauss() * 0.12 : rnd() * 2 - 1;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const dist = 6 + rnd() * 14;
    return {
      x: (x * ct + y * st) * dist,
      y: (y * ct - x * st) * dist,
      z: z * dist,
      seed: rnd(),
      lastX: -1,
      lastY: -1,
    };
  });
}

const IDLE: Space = {
  shot: () => undefined,
  wipe: (_x, _y, apply) => apply(),
  pointer: () => ({ x: 0, y: 0 }),
  destroy: () => undefined,
};

/**
 * Mounts the scene on `canvas`, with `veil` (a canvas above the page) for the
 * theme wipe. Without a 2D context, as in a test, it returns a scene that
 * does nothing and applies a theme change at once.
 */
export function mountSpace(
  canvas: HTMLCanvasElement,
  veil: HTMLCanvasElement | null,
  initial: ShotName,
): Space {
  const context = canvas.getContext('2d');
  const paper = document.createElement('canvas');
  const paperContext = paper.getContext('2d');
  if (!context || !paperContext) return IDLE;
  const ctx: CanvasRenderingContext2D = context;
  const pctx: CanvasRenderingContext2D = paperContext;
  const vctx = veil?.getContext('2d') ?? null;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');

  let W = 0;
  let H = 0;
  let S = 8;
  let theme = readCanvasTheme();
  let running = false;
  let frameId = 0;
  let last = 0;
  let clock = 0;

  let shotName: ShotName = initial;
  let from: Shot | null = null;
  let to: Shot | null = null;
  let tShot = 1;
  const view: Shot = { ax: 0, ay: 0, size: 0, dist: 3.2, show: 1, yaw: 0 };

  const cam = { yaw: -0.7, pitch: 0.18, dist: 3.2 };
  const steer = { yaw: 0, pitch: 0 };
  const pointer = { x: 0, y: 0, on: false };
  // Where the theme wipe starts: the last pointer seen, of any kind, since a
  // tap on a phone is a place too. The steering pointer above ignores touch.
  const seen = { x: -1, y: -1 };
  const stars = seedStars();
  let wipe: Wipe | null = null;
  let prevYaw = 0;
  let prevDist = 0;

  const x0 = (): number => theme.margin % S;
  const snapX = (x: number): number => x0() + Math.round((x - x0()) / S) * S;
  const snapY = (y: number): number => S / 2 + Math.round((y - S / 2) / S) * S;

  function shotFor(name: ShotName): Shot {
    const narrow = W < 720;
    return (narrow ? NARROW[name] : undefined) ?? SHOTS[name];
  }

  // The shot in between two shots, by the eased clock of the move.
  function blend(): void {
    if (!from || !to) return;
    const k = ease(Math.min(1, tShot));
    view.ax = from.ax + (to.ax - from.ax) * k;
    view.ay = from.ay + (to.ay - from.ay) * k;
    view.size = from.size + (to.size - from.size) * k;
    view.dist = from.dist + (to.dist - from.dist) * k;
    view.show = from.show + (to.show - from.show) * k;
    view.yaw = from.yaw + (to.yaw - from.yaw) * k;
  }

  function resize(): void {
    ({ width: W, height: H } = fitToViewport(veil ? [canvas, paper, veil] : [canvas, paper]));
    theme = readCanvasTheme();
    S = W < 720 ? 7 : 8;
    // A shot at rest is taken again for the new width, so turning a phone
    // or narrowing a window past 720px moves the sphere where that width
    // wants it. A move in flight keeps its target and lands as it is.
    if (!to || tShot >= 1) {
      to = shotFor(shotName);
      from = to;
      tShot = 1;
    }
    blend();
    drawPaper();
    draw(0);
  }

  function drawPaper(): void {
    pctx.clearRect(0, 0, W, H);
    pctx.fillStyle = theme.ink;
    pctx.globalAlpha = theme.dark ? 0.12 : 0.09;
    pctx.beginPath();
    for (let y = S / 2; y < H; y += S) {
      for (let x = x0(); x < W; x += S) {
        pctx.moveTo(x + 0.55, y);
        pctx.arc(x, y, 0.55, 0, TAU);
      }
    }
    pctx.fill();
    pctx.globalAlpha = 1;
  }

  function dot(x: number, y: number, ink: number): void {
    const rad = S * 0.56 * Math.sqrt(ink);
    if (rad < 0.55) return;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, TAU);
    ctx.fill();
  }

  function basis(): Basis {
    const cy = Math.cos(cam.yaw);
    const sy = Math.sin(cam.yaw);
    const cp = Math.cos(cam.pitch);
    const sp = Math.sin(cam.pitch);
    const fwd = { x: -sy * cp, y: -sp, z: -cy * cp };
    const right = { x: cy, y: 0, z: -sy };
    const up = {
      x: right.y * fwd.z - right.z * fwd.y,
      y: right.z * fwd.x - right.x * fwd.z,
      z: right.x * fwd.y - right.y * fwd.x,
    };
    return {
      right,
      up,
      fwd,
      pos: { x: -fwd.x * cam.dist, y: -fwd.y * cam.dist, z: -fwd.z * cam.dist },
    };
  }

  function draw(speed: number): void {
    const dark = theme.dark;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(paper, 0, 0, W, H);
    ctx.fillStyle = theme.ink;
    const B = basis();
    const cx = view.ax * W;
    const cy = view.ay * H;
    const restR = view.size * H;
    const focal = restR * Math.sqrt(view.dist * view.dist - 1);
    const R = focal / Math.sqrt(cam.dist * cam.dist - 1);
    const show = view.show;
    // Streaks only while the camera moves fast; their length follows speed.
    const streak = still.matches ? 0 : Math.min(1, speed);

    for (const star of stars) {
      const px = star.x - B.pos.x;
      const py = star.y - B.pos.y;
      const pz = star.z - B.pos.z;
      const vz = px * B.fwd.x + py * B.fwd.y + pz * B.fwd.z;
      if (vz < 0.5) {
        star.lastX = -1;
        continue;
      }
      const vx = px * B.right.x + py * B.right.y + pz * B.right.z;
      const vy = px * B.up.x + py * B.up.y + pz * B.up.z;
      const sx = cx + (focal * vx) / vz;
      const sy = cy - (focal * vy) / vz;
      const lastX = star.lastX;
      const lastY = star.lastY;
      star.lastX = sx;
      star.lastY = sy;
      if (sx < -S || sx > W + S || sy < -S || sy > H + S) continue;
      const ox = sx - cx;
      const oy = sy - cy;
      if (ox * ox + oy * oy < R * R * 1.1 && vz > cam.dist) continue;
      const seed = star.seed;
      const near = Math.min(1, 9 / vz);
      const beat = still.matches
        ? 0.7
        : 0.55 + 0.45 * Math.sin((clock / (2500 + seed * 5000)) * TAU + seed * 40);
      // Reading shots dim the stars hard: they are depth, not content.
      const alpha = ((dark ? 0.2 : 0.1) + near * beat * (dark ? 0.75 : 0.4)) * (0.15 + 0.85 * show);
      // A streak: the cells between where the star was and where it is,
      // fading toward the old end.
      if (streak > 0.05 && lastX >= 0) {
        const dx = sx - lastX;
        const dy = sy - lastY;
        const len = Math.sqrt(dx * dx + dy * dy);
        const reach = 2 + streak * 6;
        const steps = Math.min(40, Math.floor((len * reach) / S));
        for (let k = 1; k <= steps; k++) {
          const f = k / (steps + 1);
          ctx.globalAlpha = alpha * (1 - f) * streak;
          ctx.beginPath();
          ctx.arc(snapX(sx - dx * f * reach), snapY(sy - dy * f * reach), 0.6 + near * 0.6, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(
        snapX(sx),
        snapY(sy),
        0.6 + near * (0.5 + seed * 1.1) * beat * (0.4 + 0.6 * show),
        0,
        TAU,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const lx = SUN.x * B.right.x + SUN.y * B.right.y + SUN.z * B.right.z;
    const ly = -(SUN.x * B.up.x + SUN.y * B.up.y + SUN.z * B.up.z);
    const lz = -(SUN.x * B.fwd.x + SUN.y * B.fwd.y + SUN.z * B.fwd.z);
    if (R > S * 0.6) {
      const ya = Math.floor((cy - R) / S) * S + S / 2;
      const xa = x0() + Math.floor((cx - R - x0()) / S) * S;
      ctx.globalAlpha = 0.35 + 0.65 * show;
      for (let y = ya; y < cy + R; y += S) {
        for (let x = xa; x < cx + R; x += S) {
          const nx = (x - cx) / R;
          const ny = (y - cy) / R;
          const q = nx * nx + ny * ny;
          if (q > 1) continue;
          const nz = Math.sqrt(1 - q);
          const ndl = nx * lx + ny * ly + nz * lz;
          const lambert = Math.max(0, (ndl + 0.15) / 1.15);
          const rz = Math.min(1, Math.max(0, 2 * ndl * nz - lz));
          const lit = Math.min(1, 0.04 + 0.86 * lambert + 0.3 * Math.pow(rz, 24));
          const cover = Math.max(0, Math.min(1, ((1 - Math.sqrt(q)) * R) / S + 0.5));
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
  function particle(
    B: Basis,
    cx: number,
    cy: number,
    focal: number,
    R: number,
    wx: number,
    wy: number,
    wz: number,
    alpha: number,
    size: number,
    hole: HoleOnScreen | null,
  ): void {
    const px = wx - B.pos.x;
    const py = wy - B.pos.y;
    const pz = wz - B.pos.z;
    const vz = px * B.fwd.x + py * B.fwd.y + pz * B.fwd.z;
    if (vz < 0.5) return;
    const sx = cx + (focal * (px * B.right.x + py * B.right.y + pz * B.right.z)) / vz;
    const sy = cy - (focal * (px * B.up.x + py * B.up.y + pz * B.up.z)) / vz;
    if (sx < 0 || sx > W || sy < 0 || sy > H) return;
    const ox = sx - cx;
    const oy = sy - cy;
    if (ox * ox + oy * oy < R * R && vz > cam.dist) return;
    if (hole && vz > hole.z) {
      const hx = sx - hole.x;
      const hy = sy - hole.y;
      if (hx * hx + hy * hy < hole.r * hole.r) return;
    }
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(snapX(sx), snapY(sy), size, 0, TAU);
    ctx.fill();
  }

  function drawGiants(
    B: Basis,
    cx: number,
    cy: number,
    focal: number,
    R: number,
    show: number,
  ): void {
    const t = clock / 1000;
    const level = (theme.dark ? 0.9 : 0.55) * (0.35 + 0.65 * show);
    ctx.fillStyle = theme.ink;

    // The galaxy turns once every ten minutes.
    const gf = GAL.f;
    const gs = (t * TAU) / 600;
    for (const g of GALAXY) {
      const a = g.a + gs;
      const r = g.t * GAL.r;
      const u = Math.cos(a) * r;
      const w = Math.sin(a) * r;
      const h = (g.tone - 0.5) * GAL.r * 0.04 * (1 - g.t);
      const bright = g.t < 0.18 ? 0.8 : 0.25 + 0.4 * g.tone;
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
    const hp = { x: HOLE.c.x - B.pos.x, y: HOLE.c.y - B.pos.y, z: HOLE.c.z - B.pos.z };
    const hz = hp.x * B.fwd.x + hp.y * B.fwd.y + hp.z * B.fwd.z;
    if (hz < 1) return;
    const hole: HoleOnScreen = {
      x: cx + (focal * (hp.x * B.right.x + hp.y * B.right.y + hp.z * B.right.z)) / hz,
      y: cy - (focal * (hp.x * B.up.x + hp.y * B.up.y + hp.z * B.up.z)) / hz,
      r: (focal * HOLE.shadow) / hz,
      z: hz,
    };
    // The disk: each particle circles at a speed that falls off with
    // distance, as in any orbit; inner particles are brighter.
    const f = HOLE.f;
    for (const d of DISK) {
      const da = d.a + t * 0.9 * Math.pow(7 / d.r, 1.5);
      const du = Math.cos(da) * d.r;
      const dw = Math.sin(da) * d.r;
      const heat = Math.pow(7 / d.r, 1.3);
      particle(
        B,
        cx,
        cy,
        focal,
        R,
        HOLE.c.x + f.u.x * du + f.w.x * dw + f.n.x * d.h,
        HOLE.c.y + f.u.y * du + f.w.y * dw + f.n.y * d.h,
        HOLE.c.z + f.u.z * du + f.w.z * dw + f.n.z * d.h,
        level * (0.3 + 0.7 * heat),
        0.6 + heat * 1.2,
        hole,
      );
    }
    // The ring of bent light: a thin circle of particles just outside the
    // shadow, always facing the camera, as light round a black hole does.
    const n = Math.max(24, Math.floor((TAU * hole.r * 1.12) / S));
    ctx.globalAlpha = level;
    for (let k = 0; k < n; k++) {
      const ra = (k / n) * TAU;
      const rx = hole.x + Math.cos(ra) * hole.r * 1.12;
      const ry = hole.y + Math.sin(ra) * hole.r * 1.12;
      ctx.beginPath();
      ctx.arc(snapX(rx), snapY(ry), 1.3, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // The belt, drawn after the sphere: a body in front of the sphere prints
  // over it, a body behind the sphere is hidden by it. Inner bodies turn
  // faster than outer ones, as in any orbit.
  function drawBelt(
    B: Basis,
    cx: number,
    cy: number,
    focal: number,
    R: number,
    show: number,
  ): void {
    const spin = ((clock / 1000) * TAU) / 90;
    ctx.fillStyle = theme.ink;
    const base = (theme.dark ? 0.85 : 0.6) * (0.4 + 0.6 * show);
    for (const body of BELT) {
      const a = body.a + spin * Math.pow(2.2 / body.r, 1.5);
      const wx = Math.cos(a) * body.r;
      const wy = body.h + Math.cos(a) * 0.22;
      const wz = Math.sin(a) * body.r;
      const px = wx - B.pos.x;
      const py = wy - B.pos.y;
      const pz = wz - B.pos.z;
      const vz = px * B.fwd.x + py * B.fwd.y + pz * B.fwd.z;
      if (vz < 0.3) continue;
      const sx = cx + (focal * (px * B.right.x + py * B.right.y + pz * B.right.z)) / vz;
      const sy = cy - (focal * (px * B.up.x + py * B.up.y + pz * B.up.z)) / vz;
      const ox = sx - cx;
      const oy = sy - cy;
      if (ox * ox + oy * oy < R * R && vz > cam.dist) continue;
      const near = Math.min(1, 2.4 / vz);
      ctx.globalAlpha = base;
      ctx.beginPath();
      ctx.arc(snapX(sx), snapY(sy), 0.7 + near * 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWipe(): void {
    if (!wipe || !vctx || !veil) return;
    const t = clock - wipe.t0;
    vctx.clearRect(0, 0, W, H);
    const fx = Math.max(wipe.x, W - wipe.x);
    const fy = Math.max(wipe.y, H - wipe.y);
    const far = Math.sqrt(fx * fx + fy * fy);
    const covering = t < GROW + SPREAD;
    if (!covering && !wipe.applied) {
      wipe.applied = true;
      wipe.apply();
      theme = readCanvasTheme();
      drawPaper();
    }
    const t2 = t - GROW - SPREAD - HOLD;
    if (t2 > GROW + SPREAD) {
      vctx.clearRect(0, 0, W, H);
      veil.hidden = true;
      wipe = null;
      return;
    }
    vctx.fillStyle = wipe.colour;
    const full = S * 0.75;
    // Every dot of the wipe has one colour and no alpha, so they go in one
    // path and one fill. A dot that has grown to full size covers its whole
    // cell (its radius is over half the cell's diagonal), so a run of full
    // cells along a row is one rectangle. While the page is covered, a dot
    // per cell (some 20,000 at 1440 by 900) halved the frame rate.
    vctx.beginPath();
    const half = S / 2;
    for (let y = half; y < H + S; y += S) {
      let run = -1;
      let x = x0();
      for (; x < W + S; x += S) {
        const d = Math.sqrt((x - wipe.x) * (x - wipe.x) + (y - wipe.y) * (y - wipe.y)) / far;
        const local = Math.max(
          0,
          Math.min(1, covering ? (t - d * SPREAD) / GROW : 1 - (t2 - d * SPREAD) / GROW),
        );
        if (local >= 1) {
          if (run < 0) run = x;
          continue;
        }
        if (run >= 0) {
          vctx.rect(run - half, y - half, x - run, S);
          run = -1;
        }
        if (local <= 0) continue;
        const r = full * ease(local);
        vctx.moveTo(x + r, y);
        vctx.arc(x, y, r, 0, TAU);
      }
      if (run >= 0) vctx.rect(run - half, y - half, x - run, S);
    }
    vctx.fill();
  }

  function frame(t: number): void {
    if (!running) return;
    const dt = last ? Math.min(t - last, 64) : 16;
    last = t;
    clock += dt;
    const s = clock / 1000;
    if (tShot < 1) {
      tShot = Math.min(1, tShot + dt / SHOT_MS);
      blend();
    }
    let wantYaw = 0;
    let wantPitch = 0;
    if (pointer.on) {
      // Close up the cursor turns the camera a long way; from far away, a
      // little, so reading pages stay calm.
      const reach = view.show;
      wantYaw = (pointer.x / W - 0.5) * 2.4 * reach;
      wantPitch = (pointer.y / H - 0.5) * 0.9 * reach;
    }
    const e = 1 - Math.pow(0.06, dt / 1000);
    steer.yaw += (wantYaw - steer.yaw) * e;
    steer.pitch += (wantPitch - steer.pitch) * e;
    cam.yaw = -0.7 + (s * TAU) / 60 + steer.yaw + view.yaw;
    cam.pitch = Math.max(-1.1, Math.min(1.1, 0.18 + Math.sin(s * 0.21) * 0.22 + steer.pitch));
    cam.dist = view.dist * (1 + 0.16 * Math.sin(s * 0.17) + 0.06 * Math.sin(s * 0.41 + 1));
    // How fast the view is changing, for the streaks.
    const speed =
      (Math.abs(cam.yaw - prevYaw) * 60 + Math.abs(cam.dist - prevDist) * 6) / Math.max(1, dt / 16);
    prevYaw = cam.yaw;
    prevDist = cam.dist;
    draw(Math.max(0, speed - 0.25));
    drawWipe();
    frameId = requestAnimationFrame(frame);
  }

  function start(): void {
    if (running || still.matches || document.hidden) return;
    running = true;
    last = 0;
    frameId = requestAnimationFrame(frame);
  }

  function stop(): void {
    running = false;
    cancelAnimationFrame(frameId);
  }

  // The theme changed without the wipe (the OS setting, another tab, or the
  // wipe's own apply): read the colours again and, when the loop is not
  // running to do it, print one frame.
  function onTheme(): void {
    theme = readCanvasTheme();
    drawPaper();
    if (!running) draw(0);
  }

  const onMove = (event: PointerEvent): void => {
    seen.x = event.clientX;
    seen.y = event.clientY;
    if (event.pointerType === 'touch') return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.on = true;
  };
  const onDown = (event: PointerEvent): void => {
    seen.x = event.clientX;
    seen.y = event.clientY;
  };
  const onLeave = (): void => {
    pointer.on = false;
  };
  const onVisibility = (): void => {
    if (document.hidden) stop();
    else start();
  };
  const onStill = (): void => {
    if (still.matches) {
      stop();
      resize();
    } else start();
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  document.addEventListener('visibilitychange', onVisibility);
  still.addEventListener('change', onStill);
  window.addEventListener('resize', resize);
  const unwatch = watchThemeClass(onTheme);

  resize();
  start();

  return {
    shot(name) {
      shotName = name;
      const next = shotFor(name);
      if (still.matches) {
        from = next;
        to = next;
        tShot = 1;
        blend();
        draw(0);
        return;
      }
      if (next === to) return;
      from = { ...view };
      to = next;
      tShot = 0;
    },
    wipe(x, y, apply) {
      if (still.matches || !vctx || !veil || !running) {
        apply();
        onTheme();
        return;
      }
      // A second change while one is still covering the page: finish the
      // first at once, so no change is lost, and start the next from here.
      if (wipe && !wipe.applied) {
        wipe.applied = true;
        wipe.apply();
        theme = readCanvasTheme();
        drawPaper();
      }
      // The new paper colour is the opposite theme's paper, and in Raster
      // that is exactly this theme's ink: black on white, white on black.
      veil.hidden = false;
      wipe = { x, y, t0: clock, apply, applied: false, colour: theme.ink };
    },
    pointer() {
      return seen.x < 0 ? { x: W / 2, y: H / 2 } : { x: seen.x, y: seen.y };
    },
    destroy() {
      stop();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      still.removeEventListener('change', onStill);
      window.removeEventListener('resize', resize);
      unwatch();
      if (wipe && !wipe.applied) wipe.apply();
      wipe = null;
      if (veil) veil.hidden = true;
    },
  };
}
