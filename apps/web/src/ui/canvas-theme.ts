// What the canvas scene (ui/space) needs from the theme. A canvas cannot use a
// Tailwind class, so it reads the same CSS variables the classes read, and
// redraws when <html> changes class (light or dark) or the screen changes
// size (the margin narrows under 720px).

export interface CanvasTheme {
  readonly ink: string;
  readonly paper: string;
  readonly margin: number;
  readonly dark: boolean;
}

export function readCanvasTheme(): CanvasTheme {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const dark = root.classList.contains('dark');
  return {
    ink: css.getPropertyValue('--ink').trim() || (dark ? 'white' : 'black'),
    paper: css.getPropertyValue('--paper').trim() || (dark ? 'black' : 'white'),
    margin: parseFloat(css.getPropertyValue('--margin')) || 40,
    dark,
  };
}

/** Calls `onChange` when the theme class on <html> changes. Returns the stop function. */
export function watchThemeClass(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

/** Sizes a canvas to the viewport at the device pixel ratio, at most 2. */
export function fitToViewport(canvases: readonly HTMLCanvasElement[]): {
  width: number;
  height: number;
  dpr: number;
} {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  for (const canvas of canvases) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  return { width, height, dpr };
}
