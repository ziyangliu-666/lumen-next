import { useEffect } from 'react';

// The tab's icon as the mark it is: a halftone sphere, drawn on a canvas
// and lit from a direction that moves. While lumen works in this tab the
// light goes round the sphere, so a tab left in the background is seen to be
// busy; otherwise the light leans toward the pointer, as the scene's camera
// does. With reduced motion, or a browser without canvas, the static
// /favicon.svg stays.
//
// The dots are white on a dark tab strip and black on a light one, as the
// SVG's own media query draws them: the icon sits on the browser's chrome,
// not on the page, so it follows the OS and not the page's theme.

const SIZE = 32;
/** Dots across: the SVG mark is 6 by 6; at 32px there is room for 8. */
const GRID = 8;
const CELL = SIZE / GRID;
/** How often a frame is drawn, in ms: enough to read as turning, cheap in a tab bar. */
const FRAME_MS = 80;
/** One turn of the light while working, in ms. */
const TURN_MS = 2400;

let busy = 0;

/**
 * Marks this tab as working while the returned function has not been
 * called. A page calls it for as long as a run it shows goes on.
 */
export function markBusy(): () => void {
  busy += 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    busy -= 1;
  };
}

function draw(context: CanvasRenderingContext2D, angle: number, tilt: number, dark: boolean): void {
  context.clearRect(0, 0, SIZE, SIZE);
  context.fillStyle = dark ? '#ffffff' : '#000000';
  // The light, as a unit vector: round the sphere by `angle`, toward the
  // viewer by `tilt` (0 grazing, 1 head on).
  const lz = tilt;
  const flat = Math.sqrt(1 - lz * lz);
  const lx = Math.cos(angle) * flat;
  const ly = Math.sin(angle) * flat;
  for (let row = 0; row < GRID; row++) {
    for (let column = 0; column < GRID; column++) {
      const x = ((column + 0.5) / GRID) * 2 - 1;
      const y = ((row + 0.5) / GRID) * 2 - 1;
      const r2 = x * x + y * y;
      if (r2 > 1) continue;
      const z = Math.sqrt(1 - r2);
      const lit = Math.max(0, x * lx + y * ly + z * lz);
      // A floor, so the dark side of the sphere still shows its outline.
      const radius = (CELL / 2) * (0.22 + 0.78 * lit);
      context.beginPath();
      context.arc((column + 0.5) * CELL, (row + 0.5) * CELL, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
}

/** Runs the tab icon for the life of the shell. The shell calls it once. */
export function useLiveFavicon(): void {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const context = canvas.getContext('2d');
    if (!link || !context) return;
    const original = { href: link.href, type: link.type };
    const strip = window.matchMedia('(prefers-color-scheme: dark)');

    // Where the light should be, and where it is: it eases toward the
    // pointer, and while busy it turns on its own.
    let target = { angle: -Math.PI * 0.75, tilt: 0.55 };
    let angle = target.angle;
    let tilt = target.tilt;
    let last = '';
    const onPointer = (event: PointerEvent): void => {
      const dx = event.clientX / window.innerWidth - 0.5;
      const dy = event.clientY / window.innerHeight - 0.5;
      target = {
        angle: Math.atan2(dy, dx),
        // Near the middle the light comes from in front; at the edges, from the side.
        tilt: Math.max(0.25, 0.85 - Math.hypot(dx, dy) * 1.2),
      };
    };
    let previous = performance.now();
    const tick = (): void => {
      const now = performance.now();
      const step = now - previous;
      previous = now;
      if (busy > 0) {
        angle += (step / TURN_MS) * Math.PI * 2;
        tilt += (0.35 - tilt) * 0.2;
      } else {
        // The shorter way round to the pointer's side.
        const turn = Math.atan2(Math.sin(target.angle - angle), Math.cos(target.angle - angle));
        // Arrived: nothing to draw until the pointer moves or work starts.
        if (Math.abs(turn) < 0.003 && Math.abs(target.tilt - tilt) < 0.003 && last) return;
        angle += turn * 0.25;
        tilt += (target.tilt - tilt) * 0.25;
      }
      draw(context, angle, tilt, strip.matches);
      const href = canvas.toDataURL('image/png');
      // Only a changed picture is handed to the browser.
      if (href !== last) {
        last = href;
        link.type = 'image/png';
        link.href = href;
      }
    };
    tick();
    // A timer, not animation frames: a tab in the background has no frames,
    // and that is where a turning icon is read.
    const timer = window.setInterval(tick, FRAME_MS);
    window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pointermove', onPointer);
      link.type = original.type;
      link.href = original.href;
    };
  }, []);
}
