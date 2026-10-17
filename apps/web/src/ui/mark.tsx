import * as React from 'react';
import { cn } from '@/lib/utils';

// The lumen mark: the landing's lit sphere printed small, as a 6 by 6 halftone
// screen. Dot area carries the tone, the same rule as the landing image, so the
// mark and the image read as one object. It takes the text colour.
//
// The two screens are the ones in public/favicon.svg, so the mark in the bar
// and the icon in the tab are one drawing. In light the dots are ink, so dot
// area is shadow. In dark the dots are light on black, so dot area is the
// light a point returns, the same rule as the dark landing. Printing the
// light screen in white instead would show the sphere's negative.

type Dot = readonly [number, number, number];

// One row of the screen per line, so the table reads as the mark it draws.
// prettier-ignore
const LIGHT: readonly Dot[] = [
  [1.5, 0.5, 0.195], [2.5, 0.5, 0.183], [3.5, 0.5, 0.249], [4.5, 0.5, 0.368],
  [0.5, 1.5, 0.202], [1.5, 1.5, 0.142], [2.5, 1.5, 0.169], [3.5, 1.5, 0.237], [4.5, 1.5, 0.328], [5.5, 1.5, 0.465],
  [0.5, 2.5, 0.197], [1.5, 2.5, 0.176], [2.5, 2.5, 0.211], [3.5, 2.5, 0.274], [4.5, 2.5, 0.355], [5.5, 2.5, 0.462],
  [0.5, 3.5, 0.267], [1.5, 3.5, 0.249], [2.5, 3.5, 0.28], [3.5, 3.5, 0.335], [4.5, 3.5, 0.408], [5.5, 3.5, 0.469],
  [0.5, 4.5, 0.388], [1.5, 4.5, 0.343], [2.5, 4.5, 0.365], [3.5, 4.5, 0.413], [4.5, 4.5, 0.469], [5.5, 4.5, 0.469],
  [1.5, 5.5, 0.469], [2.5, 5.5, 0.469], [3.5, 5.5, 0.469], [4.5, 5.5, 0.469],
];

// prettier-ignore
const DARK: readonly Dot[] = [
  [1.5, 0.5, 0.443], [2.5, 0.5, 0.451], [3.5, 0.5, 0.401], [4.5, 0.5, 0.278],
  [0.5, 1.5, 0.438], [1.5, 1.5, 0.474], [2.5, 1.5, 0.461], [3.5, 1.5, 0.411], [4.5, 1.5, 0.325], [5.5, 1.5, 0.145],
  [0.5, 2.5, 0.441], [1.5, 2.5, 0.456], [2.5, 2.5, 0.431], [3.5, 2.5, 0.379], [4.5, 2.5, 0.295], [5.5, 2.5, 0.148],
  [0.5, 3.5, 0.385], [1.5, 3.5, 0.401], [2.5, 3.5, 0.374], [3.5, 3.5, 0.318], [4.5, 3.5, 0.226], [5.5, 3.5, 0.141],
  [0.5, 4.5, 0.254], [1.5, 4.5, 0.308], [2.5, 4.5, 0.283], [3.5, 4.5, 0.219], [4.5, 4.5, 0.141], [5.5, 4.5, 0.141],
  [1.5, 5.5, 0.141], [2.5, 5.5, 0.141], [3.5, 5.5, 0.141], [4.5, 5.5, 0.141],
];

function LumenMark({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 6 6"
      aria-hidden="true"
      focusable="false"
      className={cn('size-[18px] shrink-0 fill-current', className)}
      {...props}
    >
      <g className="dark:hidden">
        {LIGHT.map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
        ))}
      </g>
      <g className="hidden dark:inline">
        {DARK.map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
        ))}
      </g>
    </svg>
  );
}

export { LumenMark };
