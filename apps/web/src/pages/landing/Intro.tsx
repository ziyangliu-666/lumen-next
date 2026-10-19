// Owner: PENG XUJIAN. Page: Landing.
import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { RunState } from '@/ui/run-state';
import { LOGOS } from './logos';

// What lumen is, played over the whole screen for a first visit and from
// the front page's tag. Each scene is one idea of the product in a few
// words and one picture, drawn the way the front page's sphere is drawn: a
// shape painted, then shown as halftone dots that gather into it. The
// pictures carry the meaning; the words only name it. Labels such as OEIS
// ids or "sandbox" were removed: a first visitor could not read them.
//
//   the mark · a question becomes a project · lumen splits the work, each
//   reader at its own job (reading, computing, checking) with messages
//   going back and forth · papers coming in from every source · jobs from
//   the model platforms to a GPU cluster and the sandbox at once · a second
//   group checking each line, then the proof · the front page
//
// The numbers are real: the bars are a row of the Narayana numbers, which
// count Dyck paths by peaks. About 33 seconds; Skip, Escape or Enter ends
// it. With reduced motion it is not played on its own.

const SEEN_KEY = 'lumen.intro';

/**
 * Delays, 120 ms apart, written out because Tailwind only knows the class
 * names it can read. Important: the animate-* utility is the animation
 * shorthand, which would set a delay back to 0.
 */
const DELAY = [
  '[animation-delay:0ms]!',
  '[animation-delay:120ms]!',
  '[animation-delay:240ms]!',
  '[animation-delay:360ms]!',
  '[animation-delay:480ms]!',
  '[animation-delay:600ms]!',
  '[animation-delay:720ms]!',
  '[animation-delay:840ms]!',
  '[animation-delay:960ms]!',
  '[animation-delay:1080ms]!',
  '[animation-delay:1200ms]!',
  '[animation-delay:1320ms]!',
  '[animation-delay:1440ms]!',
  '[animation-delay:1560ms]!',
  '[animation-delay:1680ms]!',
  '[animation-delay:1800ms]!',
  '[animation-delay:1920ms]!',
  '[animation-delay:2040ms]!',
  '[animation-delay:2160ms]!',
  '[animation-delay:2280ms]!',
  '[animation-delay:2400ms]!',
  '[animation-delay:2520ms]!',
  '[animation-delay:2640ms]!',
  '[animation-delay:2760ms]!',
  '[animation-delay:2880ms]!',
  '[animation-delay:3000ms]!',
  '[animation-delay:3120ms]!',
  '[animation-delay:3240ms]!',
  '[animation-delay:3360ms]!',
  '[animation-delay:3480ms]!',
  '[animation-delay:3600ms]!',
  '[animation-delay:3720ms]!',
  '[animation-delay:3840ms]!',
  '[animation-delay:3960ms]!',
  '[animation-delay:4080ms]!',
  '[animation-delay:4200ms]!',
  '[animation-delay:4320ms]!',
  '[animation-delay:4440ms]!',
  '[animation-delay:4560ms]!',
  '[animation-delay:4680ms]!',
  '[animation-delay:4800ms]!',
  '[animation-delay:4920ms]!',
  '[animation-delay:5040ms]!',
  '[animation-delay:5160ms]!',
  '[animation-delay:5280ms]!',
  '[animation-delay:5400ms]!',
  '[animation-delay:5520ms]!',
  '[animation-delay:5640ms]!',
  '[animation-delay:5760ms]!',
  '[animation-delay:5880ms]!',
  '[animation-delay:6000ms]!',
  '[animation-delay:6120ms]!',
  '[animation-delay:6240ms]!',
  '[animation-delay:6360ms]!',
  '[animation-delay:6480ms]!',
  '[animation-delay:6600ms]!',
];

function delay(ms: number): string {
  return DELAY[Math.min(DELAY.length - 1, Math.round(ms / 120))]!;
}

/** Whether the intro plays on its own: once, signed out (the caller's), and not with reduced motion. */
export function introWanted(): boolean {
  try {
    if (localStorage.getItem(SEEN_KEY)) return false;
  } catch {
    return false;
  }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function remember(): void {
  try {
    localStorage.setItem(SEEN_KEY, 'seen');
  } catch {
    // A browser that keeps nothing sees the intro again; that is all.
  }
}

/** Words that come up out of a blur, one after another, from `at` ms. */
function Words({
  text,
  at = 0,
  className,
}: {
  text: string;
  at?: number;
  className?: string | undefined;
}): JSX.Element {
  const words = text.split(' ');
  return (
    <span className={cn('block', className)}>
      {words.map((word, index) => (
        <span
          key={index}
          className={cn(
            'inline-block whitespace-pre motion-safe:animate-intro-word',
            delay(at + index * 80),
          )}
        >
          {index < words.length - 1 ? `${word} ` : word}
        </span>
      ))}
    </span>
  );
}

/** The part of `text` typed by `t`, between `from` and `to`. */
function typed(text: string, t: number, from: number, to: number): string {
  if (t <= from) return '';
  if (t >= to) return text;
  return text.slice(0, Math.ceil((text.length * (t - from)) / (to - from)));
}

const ease = (x: number): number => {
  const c = Math.min(1, Math.max(0, x));
  return 1 - (1 - c) ** 3;
};

// The pictures. A painter draws white shapes, their opacity the strength
// of the dots, in the stage's own pixels; `Halftone` shows them as dots.

type Painter = (context: CanvasRenderingContext2D, t: number, w: number, h: number) => void;

/** A lit sphere, the mark: brightest where the light comes from. */
function sphere(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  light: number,
  strength = 1,
): void {
  const lx = x + Math.cos(light) * r * 0.45;
  const ly = y + Math.sin(light) * r * 0.45;
  const glow = context.createRadialGradient(lx, ly, r * 0.05, x, y, r);
  glow.addColorStop(0, `rgba(255,255,255,${strength})`);
  glow.addColorStop(0.55, `rgba(255,255,255,${0.5 * strength})`);
  glow.addColorStop(1, `rgba(255,255,255,${0.12 * strength})`);
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y, r, 0, Math.PI * 2);
  context.fill();
}

function line(
  context: CanvasRenderingContext2D,
  from: [number, number],
  to: [number, number],
  width: number,
  alpha: number,
): void {
  context.strokeStyle = `rgba(255,255,255,${alpha})`;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(...from);
  context.lineTo(...to);
  context.stroke();
}

/** Clears a box, so a sheet drawn there hides what lies behind it. */
function occlude(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  context.save();
  context.globalCompositeOperation = 'destination-out';
  context.fillStyle = '#000';
  context.fillRect(x, y, w, h);
  context.restore();
}

/**
 * A page of a paper, as a PDF of one looks: a folded corner, a centred
 * title and authors, an abstract, two columns of text and a figure. `scan`
 * (0 to 1) is how far down it has been read: those lines are brighter.
 */
function paper(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  scan: number | null,
  strength = 1,
): void {
  const fold = w * 0.16;
  context.save();
  context.globalAlpha = strength;
  context.strokeStyle = 'rgba(255,255,255,0.7)';
  context.lineWidth = Math.max(3, w * 0.02);
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + w - fold, y);
  context.lineTo(x + w, y + fold);
  context.lineTo(x + w, y + h);
  context.lineTo(x, y + h);
  context.closePath();
  context.moveTo(x + w - fold, y);
  context.lineTo(x + w - fold, y + fold);
  context.lineTo(x + w, y + fold);
  context.stroke();
  const bar = (bx: number, by: number, bw: number, bh: number, base: number): void => {
    const read = scan !== null && by < y + scan * h;
    context.fillStyle = `rgba(255,255,255,${read ? 1 : base})`;
    context.fillRect(bx, by, bw, bh);
  };
  const t = h * 0.028;
  bar(x + w * 0.18, y + h * 0.08, w * 0.56, t * 1.6, 0.95);
  bar(x + w * 0.3, y + h * 0.15, w * 0.4, t * 0.8, 0.5);
  for (let row = 0; row < 3; row++)
    bar(x + w * 0.16, y + h * (0.23 + row * 0.045), w * 0.68, t, 0.6);
  const col = (w * 0.76) / 2 - w * 0.03;
  for (let side = 0; side < 2; side++) {
    const cx = x + w * 0.12 + side * (col + w * 0.06);
    const rows = side === 0 ? 8 : 4;
    for (let row = 0; row < rows; row++) {
      bar(cx, y + h * (0.42 + row * 0.06), row % 4 === 3 ? col * 0.6 : col, t, 0.42);
    }
    if (side === 1) {
      // The figure: a box with a rising curve.
      const fx = cx;
      const fy = y + h * 0.66;
      context.strokeStyle = `rgba(255,255,255,${scan !== null && fy < y + scan * h ? 1 : 0.55})`;
      context.lineWidth = Math.max(2, w * 0.012);
      context.strokeRect(fx, fy, col, h * 0.22);
      context.beginPath();
      for (let k = 0; k <= 12; k++) {
        const px = fx + (col * k) / 12;
        const py = fy + h * 0.2 - h * 0.17 * (k / 12) ** 2;
        if (k === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.stroke();
    }
  }
  if (scan !== null && scan > 0 && scan < 1) {
    const sy = y + scan * h;
    const band = context.createLinearGradient(0, sy - h * 0.1, 0, sy);
    band.addColorStop(0, 'rgba(255,255,255,0)');
    band.addColorStop(1, 'rgba(255,255,255,0.5)');
    context.fillStyle = band;
    context.fillRect(x, sy - h * 0.1, w, h * 0.1);
  }
  context.restore();
}

/** A stack of papers: the edges of two behind, then the page on top. */
function stack(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  scan: number | null,
): void {
  const step = w * 0.07;
  for (let back = 2; back >= 1; back--) {
    context.strokeStyle = `rgba(255,255,255,${0.5 - back * 0.12})`;
    context.lineWidth = Math.max(3, w * 0.02);
    context.strokeRect(x + back * step, y - back * step, w, h);
  }
  occlude(context, x - 2, y - 2, w + 4, h + 4);
  paper(context, x, y, w, h, scan);
}

/** A ring for a service's mark (the mark itself is drawn over it, sharp). */
function badge(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  t: number,
): void {
  context.strokeStyle = 'rgba(255,255,255,0.75)';
  context.lineWidth = 3;
  context.beginPath();
  context.arc(x, y, r, 0, Math.PI * 2);
  context.stroke();
  // A wider ring that breathes: the service is live.
  const breathe = 0.5 + 0.5 * Math.sin(t / 420 + x);
  context.strokeStyle = `rgba(255,255,255,${0.12 + 0.2 * breathe})`;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x, y, r * (1.25 + 0.12 * breathe), 0, Math.PI * 2);
  context.stroke();
}

/** A small page in flight: a sheet with three lines. */
function sheet(context: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const w = s;
  const h = s * 1.3;
  occlude(context, x - w / 2, y - h / 2, w, h);
  context.strokeStyle = 'rgba(255,255,255,0.95)';
  context.lineWidth = 2.5;
  context.strokeRect(x - w / 2, y - h / 2, w, h);
  context.fillStyle = 'rgba(255,255,255,0.8)';
  for (let k = 0; k < 3; k++)
    context.fillRect(x - w * 0.32, y - h * 0.28 + k * h * 0.22, w * 0.64, h * 0.07);
}

/** A GPU: a die in a package with pins on every side, as full as it is busy. */
function chip(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  load: number,
): void {
  const half = s / 2;
  context.strokeStyle = 'rgba(255,255,255,0.8)';
  context.lineWidth = 2.5;
  context.strokeRect(x - half, y - half, s, s);
  for (let k = 1; k <= 4; k++) {
    const at = -half + (k * s) / 5;
    line(context, [x + at, y - half], [x + at, y - half - s * 0.14], 2, 0.7);
    line(context, [x + at, y + half], [x + at, y + half + s * 0.14], 2, 0.7);
    line(context, [x - half, y + at], [x - half - s * 0.14, y + at], 2, 0.7);
    line(context, [x + half, y + at], [x + half + s * 0.14, y + at], 2, 0.7);
  }
  context.fillStyle = `rgba(255,255,255,${0.25 + 0.75 * load})`;
  context.fillRect(x - half * 0.55, y - half * 0.55, s * 0.55, s * 0.55);
}

/** Where the sources sit in the reading scene (height fractions), with their names. */
const SOURCES: readonly (readonly [string, number])[] = [
  ['arXiv', 0.1],
  ['OEIS', 0.3],
  ['OpenAlex', 0.5],
  ['Semantic Scholar', 0.7],
  ['Journals', 0.9],
];

/** The model platforms in the computing scene. */
const MODELS: readonly (readonly [string, number])[] = [
  ['OpenAI', 0.2],
  ['Anthropic', 0.5],
  ['DeepSeek', 0.8],
];

const ORB_LIGHT = (t: number): number => -2.3 + t / 900;

/** A dot travelling along a line, there and back, for messages between tasks. */
function packet(
  context: CanvasRenderingContext2D,
  from: [number, number],
  to: [number, number],
  phase: number,
  r: number,
): void {
  const p = phase % 1;
  const along = p < 0.5 ? p * 2 : 2 - p * 2;
  context.fillStyle = 'rgba(255,255,255,1)';
  context.beginPath();
  context.arc(
    from[0] + (to[0] - from[0]) * along,
    from[1] + (to[1] - from[1]) * along,
    r,
    0,
    Math.PI * 2,
  );
  context.fill();
}

const PAINT: Record<string, Painter> = {
  mark: (context, t, w, h) => sphere(context, w / 2, h / 2, Math.min(w, h) * 0.36, ORB_LIGHT(t)),
  split: (context, t, w, h) => {
    const lead: [number, number] = [w / 2, h * 0.11];
    const out = ease((t - 400) / 1000);
    const xs = [0.18, 0.5, 0.82];
    const ry = h * 0.36;
    const readers = xs.map((at): [number, number] => [
      lead[0] + (w * at - lead[0]) * out,
      lead[1] + (ry - lead[1]) * out,
    ]);
    for (const [index, spot] of readers.entries()) {
      if (out < 0.02) continue;
      line(context, lead, spot, 3, 0.45);
      // Messages both ways, once the readers are out.
      if (out > 0.95) {
        packet(context, lead, spot, t / 1300 + index * 0.37, h * 0.012);
        packet(context, lead, spot, t / 1700 + index * 0.21 + 0.5, h * 0.009);
      }
    }
    for (const [index, spot] of readers.entries()) {
      sphere(context, spot[0], spot[1], h * 0.05, ORB_LIGHT(t) + index * 1.4, 0.95);
    }
    sphere(context, lead[0], lead[1], h * 0.075, ORB_LIGHT(t));

    // Each reader's own work, in a panel under it, once it has arrived.
    const work = (t - 1500) / 1000;
    if (work <= 0) return;
    const pw = w * 0.26;
    const ph = h * 0.44;
    const py = h * 0.5;
    const show = ease(work);
    context.globalAlpha = show;
    for (const at of xs) {
      line(context, [w * at, ry + h * 0.06], [w * at, py], 2, 0.35);
      context.strokeStyle = 'rgba(255,255,255,0.45)';
      context.lineWidth = 3;
      context.strokeRect(w * at - pw / 2, py, pw, ph);
    }
    const into = t - 1500;

    // 1: reads, a stack of papers it scans, the next page coming up.
    {
      const x = w * xs[0]! - pw / 2;
      const scan = (into / 1800) % 1;
      stack(context, x + pw * 0.2, py + ph * 0.16, pw * 0.5, ph * 0.72, scan);
    }
    // 2: computes, lines of code being written, a run's progress under them.
    {
      const x = w * xs[1]! - pw / 2 + pw * 0.1;
      const lengths = [0.5, 0.72, 0.38, 0.64, 0.8, 0.44, 0.58];
      const written = Math.floor(into / 260) % (lengths.length + 3);
      for (const [row, length] of lengths.entries()) {
        if (row >= written) break;
        const indent = row === 2 || row === 3 || row === 5 ? 0.12 : 0;
        context.fillStyle = `rgba(255,255,255,${row === written - 1 ? 1 : 0.6})`;
        context.fillRect(
          x + pw * 0.8 * indent,
          py + ph * (0.12 + row * 0.09),
          pw * 0.8 * (length - indent),
          ph * 0.035,
        );
      }
      if (Math.floor(into / 400) % 2 === 0) {
        context.fillStyle = 'rgba(255,255,255,1)';
        context.fillRect(
          x,
          py + ph * (0.12 + Math.min(written, lengths.length - 1) * 0.09),
          pw * 0.04,
          ph * 0.05,
        );
      }
      const run = (into / 2600) % 1;
      context.strokeStyle = 'rgba(255,255,255,0.6)';
      context.lineWidth = 2;
      context.strokeRect(x, py + ph * 0.82, pw * 0.8, ph * 0.07);
      context.fillStyle = 'rgba(255,255,255,0.95)';
      context.fillRect(x, py + ph * 0.82, pw * 0.8 * run, ph * 0.07);
    }
    // 3: checks, a grid of cases lit one by one, a tick for each row done.
    {
      const x = w * xs[2]! - pw / 2 + pw * 0.12;
      const n = 6;
      const cell = (pw * 0.62) / n;
      const lit = Math.floor(into / 70) % (n * n + 8);
      for (let k = 0; k < n * n; k++) {
        const i = k % n;
        const j = Math.floor(k / n);
        const on = k < lit;
        context.fillStyle = `rgba(255,255,255,${on ? (k === lit - 1 ? 1 : 0.75) : 0.18})`;
        context.fillRect(
          x + i * cell + cell * 0.12,
          py + ph * 0.12 + j * cell + cell * 0.12,
          cell * 0.76,
          cell * 0.76,
        );
        if (i === n - 1 && on) {
          // The row is checked.
          const cx = x + n * cell + cell * 0.35;
          const cy = py + ph * 0.12 + j * cell + cell * 0.5;
          context.strokeStyle = 'rgba(255,255,255,1)';
          context.lineWidth = 3;
          context.beginPath();
          context.moveTo(cx - cell * 0.25, cy);
          context.lineTo(cx - cell * 0.05, cy + cell * 0.2);
          context.lineTo(cx + cell * 0.3, cy - cell * 0.25);
          context.stroke();
        }
      }
    }
    context.globalAlpha = 1;
  },
  read: (context, t, w, h) => {
    // Papers come in from every source to the reader, which stacks and
    // reads them.
    const sources = SOURCES.map(([, sy]): [number, number] => [w * 0.1, h * sy]);
    for (const [x, y] of sources) badge(context, x, y, h * 0.072, t);
    const reader: [number, number] = [w * 0.5, h * 0.5];
    const flights = 18;
    let absorbed = 0;
    for (let k = 0; k < flights; k++) {
      const from = sources[k % sources.length]!;
      const p = (t - 400 - k * 190) / 900;
      if (p >= 1) {
        absorbed += 1;
        continue;
      }
      if (p <= 0) continue;
      const e = ease(p);
      // Along a curve that bows toward the middle.
      const mx = (from[0] + reader[0]) / 2;
      const my = (from[1] + reader[1]) / 2 + (from[1] < reader[1] ? -h * 0.08 : h * 0.08);
      const x = (1 - e) ** 2 * from[0] + 2 * (1 - e) * e * mx + e ** 2 * reader[0];
      const y = (1 - e) ** 2 * from[1] + 2 * (1 - e) * e * my + e ** 2 * reader[1];
      sheet(context, x, y, h * 0.06 * (1 - e * 0.4));
    }
    for (const from of sources) line(context, [from[0] + h * 0.075, from[1]], reader, 1.5, 0.18);
    sphere(context, reader[0], reader[1], h * 0.08, ORB_LIGHT(t));
    // The pile grows with what has come in, and the top page is read.
    const pw = h * 0.42;
    const ph = h * 0.58;
    const px = w * 0.72;
    const py = h * 0.22;
    line(context, [reader[0] + h * 0.09, reader[1]], [px - w * 0.01, reader[1]], 3, 0.5);
    const behind = Math.min(4, Math.floor(absorbed / 4));
    for (let back = behind; back >= 1; back--) {
      context.strokeStyle = `rgba(255,255,255,${0.55 - back * 0.08})`;
      context.lineWidth = 3;
      context.strokeRect(px + back * pw * 0.06, py - back * pw * 0.06, pw, ph);
    }
    occlude(context, px - 2, py - 2, pw + 4, ph + 4);
    paper(context, px, py, pw, ph, absorbed > 0 ? ((t - 1300) / 1400) % 1 : null);
  },
  math: (context, t, w, h) => {
    // Models on the left send jobs to every GPU and to the sandbox at
    // once; the chips' loads move, the run's progress fills.
    const models = MODELS.map(([, my]): [number, number] => [w * 0.12, h * my]);
    for (const [x, y] of models) badge(context, x, y, h * 0.088, t);
    const cols = 4;
    const rows = 3;
    const gx = w * 0.42;
    const gy = h * 0.1;
    const cell = Math.min((w * 0.4) / cols, (h * 0.5) / rows);
    const targets: [number, number][] = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const cx = gx + i * cell + cell / 2;
        const cy = gy + j * cell + cell / 2;
        const load = 0.35 + 0.65 * Math.abs(Math.sin(t / 380 + i * 1.7 + j * 2.3));
        chip(context, cx, cy, cell * 0.62, load);
        targets.push([cx - cell * 0.31, cy]);
      }
    }
    // The sandbox: a terminal box with lines being written.
    const sx = w * 0.42;
    const sy = h * 0.68;
    const sw = cell * cols;
    const sh = h * 0.22;
    context.strokeStyle = 'rgba(255,255,255,0.7)';
    context.lineWidth = 3;
    context.strokeRect(sx, sy, sw, sh);
    const lines = Math.floor(t / 220) % 6;
    for (let k = 0; k < lines; k++) {
      context.fillStyle = `rgba(255,255,255,${k === lines - 1 ? 1 : 0.55})`;
      context.fillRect(
        sx + sw * 0.05,
        sy + sh * (0.18 + k * 0.13),
        sw * (0.3 + ((k * 37) % 50) / 100),
        sh * 0.06,
      );
    }
    targets.push([sx, sy + sh / 2]);
    // Jobs out, many at once.
    for (const [m, from] of models.entries()) {
      for (const [k, to] of targets.entries()) {
        const start: [number, number] = [from[0] + h * 0.09, from[1]];
        line(context, start, to, 1.5, 0.2);
        // Two jobs on every line, out of step, so the traffic never stops.
        for (const offset of [0, 0.5]) {
          const phase = (t / 650 + k * 0.17 + m * 0.31 + offset) % 1;
          packet(context, start, to, phase / 2, h * 0.012);
        }
      }
    }
    // The run as a whole.
    const run = ease(t / 4600);
    context.strokeStyle = 'rgba(255,255,255,0.6)';
    context.lineWidth = 2;
    context.strokeRect(w * 0.42, h * 0.94, sw, h * 0.03);
    context.fillStyle = 'rgba(255,255,255,1)';
    context.fillRect(w * 0.42, h * 0.94, sw * run, h * 0.03);
  },
  proof: (context, t, w, h) => {
    // A second group checks the result, a line each, before it is shown.
    const pw = h * 0.56;
    const ph = h * 0.8;
    const x = w / 2 - pw / 2;
    const y = h * 0.1;
    paper(context, x, y, pw, ph, null, 0.6);
    const checkers: [number, number][] = [
      [w * 0.16, h * 0.25],
      [w * 0.16, h * 0.72],
      [w * 0.84, h * 0.25],
      [w * 0.84, h * 0.72],
    ];
    const rows = [0.23, 0.32, 0.45, 0.57, 0.69, 0.81];
    const done = Math.min(rows.length, Math.floor(Math.max(0, t - 500) / 480));
    for (const [index, at] of checkers.entries()) {
      sphere(context, at[0], at[1], h * 0.055, ORB_LIGHT(t) + index, 0.9);
      // Each looks at the next line not yet checked, in turn.
      const row = rows[Math.min(rows.length - 1, done + (index % 2))]!;
      const target: [number, number] = [at[0] < w / 2 ? x : x + pw, y + ph * row];
      if (done < rows.length) line(context, at, target, 2, 0.5);
    }
    for (let k = 0; k < done; k++) {
      const cy = y + ph * rows[k]!;
      const cx = x + pw + h * 0.05;
      context.strokeStyle = 'rgba(255,255,255,1)';
      context.lineWidth = 4;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(cx - h * 0.02, cy);
      context.lineTo(cx, cy + h * 0.02);
      context.lineTo(cx + h * 0.035, cy - h * 0.025);
      context.stroke();
    }
    // All checked: the proof, stamped.
    const stamp = ease((t - 500 - rows.length * 480) / 700);
    if (stamp > 0) {
      const a: [number, number] = [w / 2 - h * 0.17, h * 0.52];
      const b: [number, number] = [w / 2 - h * 0.04, h * 0.65];
      const c: [number, number] = [w / 2 + h * 0.2, h * 0.32];
      occlude(
        context,
        a[0] - h * 0.05,
        c[1] - h * 0.05,
        c[0] - a[0] + h * 0.1,
        b[1] - c[1] + h * 0.1,
      );
      context.strokeStyle = 'rgba(255,255,255,1)';
      context.lineWidth = h * 0.06;
      context.lineJoin = 'round';
      context.beginPath();
      context.moveTo(...a);
      const first = Math.min(1, stamp * 2);
      context.lineTo(a[0] + (b[0] - a[0]) * first, a[1] + (b[1] - a[1]) * first);
      if (stamp > 0.5) {
        const second = (stamp - 0.5) * 2;
        context.lineTo(b[0] + (c[0] - b[0]) * second, b[1] + (c[1] - b[1]) * second);
      }
      context.stroke();
    }
  },
};

/**
 * A picture as halftone dots: the painter draws at a twelfth of the size,
 * and each of its pixels is one dot, as large as the pixel is strong. The
 * dots come in from the middle out, each at its own moment, over `gather` ms.
 */
function Halftone({
  paint,
  t,
  className,
  step = 9,
  gather = 900,
}: {
  paint: Painter;
  t: number;
  className?: string | undefined;
  step?: number;
  gather?: number;
}): JSX.Element {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const low = useRef<HTMLCanvasElement | null>(null);
  const order = useRef<Float32Array | null>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext('2d');
    if (!context) return;
    const w = element.clientWidth;
    const h = element.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    if (element.width !== w * ratio) {
      element.width = w * ratio;
      element.height = h * ratio;
    }
    const cols = Math.ceil(w / step);
    const rows = Math.ceil(h / step);
    low.current ??= document.createElement('canvas');
    const small = low.current;
    small.width = cols;
    small.height = rows;
    const paper = small.getContext('2d', { willReadFrequently: true });
    if (!paper) return;
    if (order.current?.length !== cols * rows) {
      // Each dot's moment: nearer the middle first, with some scatter.
      const moments = new Float32Array(cols * rows);
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const d = Math.hypot(i / cols - 0.5, j / rows - 0.5) * 1.4;
          const scatter = (((Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1) + 1) % 1;
          moments[j * cols + i] = Math.min(1, d * 0.6 + scatter * 0.4);
        }
      }
      order.current = moments;
    }
    paper.setTransform(1, 0, 0, 1, 0, 0);
    paper.clearRect(0, 0, cols, rows);
    paper.setTransform(1 / step, 0, 0, 1 / step, 0, 0);
    paint(paper, t, w, h);
    const pixels = paper.getImageData(0, 0, cols, rows).data;
    const ink =
      getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#fff';
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, w, h);
    context.fillStyle = ink;
    const shown = t / gather;
    const moments = order.current;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const strength = pixels[(j * cols + i) * 4 + 3]! / 255;
        if (strength < 0.04) continue;
        const moment = moments[j * cols + i]!;
        if (shown < moment) continue;
        // A dot that has just arrived is still small.
        const arrive = Math.min(1, (shown - moment) * 4);
        const r = (step / 2) * Math.sqrt(strength) * 0.92 * arrive;
        context.beginPath();
        context.arc(i * step + step / 2, j * step + step / 2, r, 0, Math.PI * 2);
        context.fill();
      }
    }
  });
  return <canvas ref={canvas} aria-hidden="true" className={cn('block', className)} />;
}

/** A drawing with names set over it, at the same fractions the painter draws at. */
function Stage({
  paint,
  t,
  children,
}: {
  paint: Painter;
  t: number;
  children?: ReactNode;
}): JSX.Element {
  return (
    <div className="relative h-[min(26rem,48vh)] w-[min(48rem,94vw)]">
      <Halftone paint={paint} t={t} step={6} className="size-full" />
      {children}
    </div>
  );
}

/**
 * A service's own mark over the drawing, as the service draws it: as dots
 * at this size it could not be told apart. It pops in at `at` ms.
 */
function Mark({
  logo,
  className,
  at = 500,
}: {
  logo: keyof typeof LOGOS;
  className: string;
  at?: number;
}): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={LOGOS[logo].name}
      className={cn(
        'absolute size-[clamp(1.5rem,2.8vw,2.125rem)] -translate-x-1/2 -translate-y-1/2 fill-current text-ink motion-safe:animate-intro-pop',
        delay(at),
        className,
      )}
    >
      <path d={LOGOS[logo].path} />
    </svg>
  );
}

const QUESTION = 'How many Dyck paths of semilength n have exactly k peaks?';

interface Scene {
  readonly ms: number;
  readonly caption?: string;
  readonly draw: (t: number) => ReactNode;
}

const SCENES: readonly Scene[] = [
  {
    ms: 4000,
    draw: (t) => (
      <div className="grid justify-items-center gap-8">
        <Halftone paint={PAINT.mark!} t={t} gather={1400} className="size-[min(16rem,32vh)]" />
        <div className="text-center">
          <p className="text-[clamp(3rem,6.5vw,6rem)] leading-[0.98] font-medium tracking-[-0.045em] text-ink">
            <Words text="Welcome to lumen" at={500} />
          </p>
          <p className="mt-4 text-[clamp(1.125rem,1.6vw,1.5rem)] text-ink-2">
            <Words text="An AI that does research on its own." at={1200} />
          </p>
        </div>
      </div>
    ),
  },
  {
    ms: 3800,
    caption: 'Ask a question.',
    draw: (t) => {
      // The question, typed; then the same box becomes the project, named
      // by its title, and stays.
      const named = t > 2100;
      return (
        <div
          className={cn(
            'w-[min(36rem,88vw)] overflow-hidden border border-ink bg-paper px-5 text-left transition-[height,padding] duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)]',
            named ? 'h-16 py-0' : 'h-24 py-4',
          )}
        >
          {named ? (
            <div className="flex h-full items-center justify-between gap-4 motion-safe:animate-intro-word">
              <span className="text-xl font-semibold text-ink">Dyck paths by peaks</span>
              <RunState state="running">{''}</RunState>
            </div>
          ) : (
            <p className="text-lg text-ink">
              {typed(QUESTION, t, 400, 1800)}
              <span className="ml-0.5 inline-block h-[1.1em] w-px translate-y-[0.2em] bg-ink motion-safe:animate-pulse" />
            </p>
          )}
        </div>
      );
    },
  },
  {
    ms: 6500,
    caption: 'lumen splits the work.',
    draw: (t) => (
      <div className="grid w-[min(48rem,94vw)] gap-3">
        <Halftone paint={PAINT.split!} t={t} step={6} className="h-[min(26rem,48vh)] w-full" />
        {/* One word under each reader's panel: what that work is. */}
        <div
          className={cn(
            'grid grid-cols-3 text-center text-sm text-ink-2 motion-safe:animate-intro-word',
            delay(1900),
          )}
        >
          <span>reads</span>
          <span>computes</span>
          <span>checks</span>
        </div>
      </div>
    ),
  },
  {
    ms: 5200,
    caption: 'It reads papers from everywhere.',
    draw: (t) => (
      <Stage paint={PAINT.read!} t={t}>
        {/* Each source's mark in its ring (SOURCES). */}
        <Mark logo="arxiv" className="top-[10%] left-[10%]" at={300} />
        <Mark logo="semanticscholar" className="top-[30%] left-[10%]" at={420} />
        <Mark logo="googlescholar" className="top-[50%] left-[10%]" at={540} />
        <Mark logo="ieee" className="top-[70%] left-[10%]" at={660} />
        <Mark logo="acm" className="top-[90%] left-[10%]" at={780} />
      </Stage>
    ),
  },
  {
    ms: 5200,
    caption: 'It runs the math, all at once.',
    draw: (t) => (
      <Stage paint={PAINT.math!} t={t}>
        {/* Each model platform's mark in its ring (MODELS); the GPUs'
            maker over the chips; Docker, which runs the sandbox, in it. */}
        <Mark logo="openai" className="top-[20%] left-[12%]" at={300} />
        <Mark logo="anthropic" className="top-[50%] left-[12%]" at={420} />
        <Mark logo="deepseek" className="top-[80%] left-[12%]" at={540} />
        <Mark logo="nvidia" className="top-[4%] left-[44%]" at={700} />
        <Mark logo="docker" className="top-[75%] left-[74%]" at={820} />
      </Stage>
    ),
  },
  {
    ms: 5000,
    caption: 'Every claim is checked again.',
    draw: (t) => <Stage paint={PAINT.proof!} t={t} />,
  },
  {
    ms: 2600,
    draw: () => (
      <p className="text-center text-[clamp(2.5rem,5.5vw,5rem)] leading-[1] font-medium tracking-[-0.04em] text-ink">
        <Words text="Now you can do any" />
        <Words text="frontier work." at={300} />
        <Words text="Just start." at={700} className="text-ink-2" />
      </p>
    ),
  },
];

const TOTAL = SCENES.reduce((sum, scene) => sum + scene.ms, 0);

function sceneAt(now: number): number {
  let end = 0;
  for (let index = 0; index < SCENES.length; index++) {
    end += SCENES[index]!.ms;
    if (now < end) return index;
  }
  return SCENES.length - 1;
}

/**
 * The halftone dots behind everything: a grid that swells in a slow wave
 * from the middle and fades toward the edges, faint, so the scene is first.
 */
function DotField(): JSX.Element {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ink =
      getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#fff';
    let frame = 0;
    const start = performance.now();
    const draw = (at: number): void => {
      const ratio = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (element.width !== width * ratio) {
        element.width = width * ratio;
        element.height = height * ratio;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = ink;
      const t = (at - start) / 1000;
      const rise = Math.min(1, t / 2);
      const gap = 22;
      const cx = width / 2;
      const cy = height / 2;
      const far = Math.hypot(cx, cy);
      for (let y = gap / 2; y < height; y += gap) {
        for (let x = gap / 2; x < width; x += gap) {
          const d = Math.hypot(x - cx, y - cy) / far;
          const wave = 0.5 + 0.5 * Math.sin(d * 9 - t * 1.1);
          const fade = Math.max(0, 1 - d * 1.15);
          const r = 2.2 * wave * fade * rise;
          if (r < 0.25) continue;
          context.globalAlpha = 0.12 + 0.18 * wave * fade;
          context.beginPath();
          context.arc(x, y, r, 0, Math.PI * 2);
          context.fill();
        }
      }
      if (!still) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
    />
  );
}

/**
 * The mark as a small live sphere, for the tag that replays the intro: its
 * light turns slowly, as the tab's icon does while lumen works.
 */
export function IntroOrb({ className }: { className?: string | undefined }): JSX.Element {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setT(5000);
      return;
    }
    const start = performance.now() - 5000;
    let frame = requestAnimationFrame(function tick(at) {
      setT(at - start);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return <Halftone paint={PAINT.mark!} t={t} step={3} className={className} />;
}

export function Intro({ onDone }: { onDone: () => void }): JSX.Element {
  const [now, setNow] = useState(0);
  // Leaving: the screen fades to the page under it, then onDone.
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(at) {
      setNow(at - start);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const leave = (): void => {
    remember();
    setLeaving(true);
  };
  useEffect(() => {
    if (now < TOTAL || leaving) return;
    remember();
    setLeaving(true);
  }, [now, leaving]);
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onDone, 700);
    return () => window.clearTimeout(timer);
  }, [leaving, onDone]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' || event.key === 'Enter') leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const at = sceneAt(now);
  const scene = SCENES[at]!;
  const into = now - SCENES.slice(0, at).reduce((sum, step) => sum + step.ms, 0);
  const screen = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="What lumen is"
      className={cn(
        'fixed inset-0 z-[80] overflow-hidden bg-paper text-ink transition-opacity duration-700 ease-out',
        leaving && 'pointer-events-none opacity-0',
      )}
    >
      <DotField />
      <p className="sr-only">
        lumen is an AI that does research in mathematics on its own. You ask a question, and it
        becomes a project. lumen splits the work among readers, who read the papers from every
        source, run the math on many machines at once, and check every claim again. Then it shows
        you the proof.
      </p>
      {/* Keyed by the scene: each comes up fresh, and goes on its own
          clock just before the next. */}
      <div
        key={at}
        aria-hidden="true"
        className={cn(
          'relative flex h-full flex-col items-center justify-center gap-10 px-6',
          at < SCENES.length - 1 && 'motion-safe:animate-intro-out',
          delay(scene.ms - 400),
        )}
      >
        {scene.caption ? (
          <p className="text-center text-[clamp(1.75rem,3.2vw,3rem)] leading-[1.05] font-medium tracking-[-0.03em] text-ink">
            <Words text={scene.caption} />
          </p>
        ) : null}
        {scene.draw(into)}
      </div>
      <div className="absolute inset-x-0 bottom-8 flex items-center justify-center gap-6 px-6">
        <div aria-hidden="true" className="flex w-[min(20rem,60vw)] gap-1.5">
          {SCENES.map((step, index) => (
            <span key={index} className="h-0.5 flex-1 overflow-hidden bg-rule-minor">
              {index < at ? (
                <span className="block h-full bg-ink" />
              ) : index === at ? (
                <span
                  key={at}
                  className={cn(
                    'block h-full origin-left bg-ink motion-safe:animate-intro-fill',
                    FILL[index],
                  )}
                />
              ) : null}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={leave}
          className="text-sm text-ink-2 underline decoration-[1.5px] underline-offset-[0.15em] hover:text-ink"
        >
          Skip
        </button>
      </div>
    </div>
  );
  // Over everything, the bar included. Rendered in place where there is no
  // document (a test renders it to a string).
  return typeof document === 'undefined' ? screen : createPortal(screen, document.body);
}

/** Each scene's length as a class, for its step of the progress. */
const FILL = [
  '[animation-duration:4000ms]!',
  '[animation-duration:3800ms]!',
  '[animation-duration:6500ms]!',
  '[animation-duration:5200ms]!',
  '[animation-duration:5200ms]!',
  '[animation-duration:5000ms]!',
  '[animation-duration:2600ms]!',
];
