// Owner: PENG XUJIAN. Page: Landing.
import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { RunState } from '@/ui/run-state';

// What lumen is, played over the whole screen for a first visit and on
// request from the front page ("Watch the intro"). The screen starts as
// paper (black by default, white in the light theme) with the scene's
// halftone dots coming up behind the words, then eight scenes, each one
// idea of the product's own model in a few words and a moving piece of the
// product drawn as the product draws it:
//
//   welcome · a question becomes a project · the lead fans out to readers ·
//   they search the literature · experiments run in the sandbox · on the
//   model you choose · a finding with its evidence · the front page.
//
// The mathematics is real: Dyck paths of semilength n with k peaks are
// counted by the Narayana numbers (OEIS A001263). About 25 seconds; Skip,
// Escape or Enter ends it. With reduced motion it is not played on its own.

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

/** One piece of a scene, coming up at `at` ms. */
function In({
  at,
  pop = false,
  className,
  children,
}: {
  at: number;
  pop?: boolean;
  className?: string | undefined;
  children: ReactNode;
}): JSX.Element {
  return (
    <div
      className={cn(
        pop ? 'motion-safe:animate-intro-pop' : 'motion-safe:animate-intro-word',
        delay(at),
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The part of `text` typed by `t`, between `from` and `to`. */
function typed(text: string, t: number, from: number, to: number): string {
  if (t <= from) return '';
  if (t >= to) return text;
  return text.slice(0, Math.ceil((text.length * (t - from)) / (to - from)));
}

const CHIP = 'border border-rule-major bg-well px-2.5 py-1 font-mono text-sm text-ink';

const QUESTION = 'How many Dyck paths of semilength n have exactly k peaks?';
const NARAYANA = ['1', '1 1', '1 3 1', '1 6 6 1', '1 10 20 10 1', '1 15 50 50 15 1'];
const MODELS = ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4.1'];

interface Scene {
  readonly ms: number;
  readonly caption?: string;
  readonly draw: (t: number) => ReactNode;
}

const SCENES: readonly Scene[] = [
  {
    ms: 3800,
    draw: () => (
      <div className="text-center">
        <p className="text-[clamp(3rem,7vw,6.5rem)] leading-[0.98] font-medium tracking-[-0.045em] text-ink">
          <Words text="Welcome to lumen" />
        </p>
        <In at={900} className="mt-6">
          <p className="text-[clamp(1.125rem,1.6vw,1.5rem)] text-ink-2">
            An AI that does research on its own.
          </p>
        </In>
      </div>
    ),
  },
  {
    ms: 3400,
    caption: 'Start with a question.',
    draw: (t) => (
      <div className="grid w-[min(36rem,88vw)] gap-4">
        <In at={300}>
          <div className="min-h-20 border border-ink bg-paper px-4 py-3 text-left text-lg text-ink">
            {typed(QUESTION, t, 600, 1900)}
            {t < 2000 ? (
              <span className="ml-0.5 inline-block h-[1.1em] w-px translate-y-[0.2em] bg-ink motion-safe:animate-pulse" />
            ) : null}
          </div>
        </In>
        <In at={2100}>
          <div className="flex items-center justify-between border-t border-rule-minor pt-4 text-left">
            <span>
              <span className="block text-xs text-ink-2">Project</span>
              <span className="text-lg font-semibold text-ink">Dyck paths by peaks</span>
            </span>
            <RunState state="running">Running</RunState>
          </div>
        </In>
      </div>
    ),
  },
  {
    ms: 3800,
    caption: 'lumen leads. Readers fan out.',
    draw: () => (
      <div className="relative w-[44rem] max-w-[92vw]">
        <In at={200} pop className="mx-auto w-fit">
          <span className="flex items-center gap-2 border border-ink bg-paper px-4 py-2 text-lg font-semibold text-ink">
            <RunState state="running">{''}</RunState>
            lumen
          </span>
        </In>
        {/* The call tree's lines, drawn from the lead to each reader. */}
        {/* Drawn in the stage's own pixels (44rem wide, 64px high), so the
            lines keep their width and end at the middle of each reader:
            the columns are a third of the width less the 12px gaps. */}
        <svg aria-hidden="true" viewBox="0 0 704 64" className="block h-16 w-full text-rule-major">
          {['M352 0 C352 36 113 28 113 64', 'M352 0 L352 64', 'M352 0 C352 36 591 28 591 64'].map(
            (path, index) => (
              <path
                key={path}
                d={path}
                pathLength={100}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeDasharray="100"
                className={cn('motion-safe:animate-intro-line', delay(500 + index * 120))}
              />
            ),
          )}
        </svg>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['reader 1', 'Counting paths to n = 12'],
            ['reader 2', 'Searching arXiv'],
            ['reader 3', 'Checking OEIS'],
          ].map(([who, what], index) => (
            <In key={who} at={1000 + index * 160} pop>
              <span className="grid gap-1 border border-rule-major bg-well px-3 py-2 text-left">
                <span className="flex items-center gap-2 text-sm font-medium text-ink">
                  <RunState state="running">{''}</RunState>
                  {who}
                </span>
                <span className="shimmer-text text-sm motion-safe:animate-shimmer">{what}</span>
              </span>
            </In>
          ))}
        </div>
      </div>
    ),
  },
  {
    ms: 3200,
    caption: 'Every source, searched.',
    draw: () => (
      <div className="flex max-w-[44rem] flex-wrap justify-center gap-2">
        {[
          'OEIS  A001263',
          'OEIS  A000108',
          'arXiv  Narayana numbers, Dyck peaks',
          'OpenAlex  Dyck path statistics',
          'OEIS  A001006',
        ].map((chip, index) => (
          <In key={chip} at={300 + index * 180}>
            <span className={cn(CHIP, 'whitespace-pre')}>{chip}</span>
          </In>
        ))}
      </div>
    ),
  },
  {
    ms: 3600,
    caption: 'Experiments, run for real.',
    draw: (t) => (
      <In at={200} className="w-[min(30rem,88vw)]">
        <div className="border border-rule-major bg-well text-left">
          <div className="flex items-center justify-between border-b border-rule-minor px-3 py-1.5 text-xs text-ink-2">
            <span>sandbox</span>
            <span>no network</span>
          </div>
          <div className="min-h-52 px-4 py-3 font-mono text-sm leading-relaxed text-ink tabular-nums">
            <p>{`$ ${typed('python peaks.py --n 6', t, 400, 1100)}`}</p>
            {/* The Narayana triangle, a row at a time, centred as it is drawn. */}
            {NARAYANA.map((row, index) =>
              t > 1300 + index * 260 ? (
                <p key={row} className="text-center whitespace-pre motion-safe:animate-rise">
                  {row}
                </p>
              ) : null,
            )}
          </div>
        </div>
      </In>
    ),
  },
  {
    ms: 3000,
    caption: 'On the model you choose.',
    draw: (t) => {
      const at = Math.min(MODELS.length - 1, Math.floor(Math.max(0, t - 500) / 520));
      return (
        <In at={200}>
          <span className="inline-flex h-12 items-center gap-3 overflow-hidden border border-ink bg-paper px-5 text-xl text-ink">
            {/* Keyed by the name, so each one rises in as the last goes. */}
            <span key={at} className="font-mono motion-safe:animate-rise">
              {MODELS[at]}
            </span>
            <span aria-hidden="true" className="text-ink-2">
              ⌄
            </span>
          </span>
        </In>
      );
    },
  },
  {
    ms: 3600,
    caption: 'Then it shows you the evidence.',
    draw: () => (
      <In at={300} className="w-[min(32rem,88vw)]">
        <div className="border border-rule-major bg-well px-5 py-4 text-left">
          <p className="flex items-start gap-3 text-lg font-semibold text-ink">
            <In at={900} pop className="mt-2 shrink-0">
              <span aria-hidden="true" className="block size-2.5 bg-ink" />
            </In>
            Dyck paths by peaks are the Narayana numbers
          </p>
          <p className="mt-1 pl-5.5 text-ink-2">Rows n = 1 to 12 match OEIS A001263.</p>
          <p className="mt-3 pl-5.5 text-sm text-ink-2">Recorded by reader 3</p>
        </div>
      </In>
    ),
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

/** How long the intro plays, in whole seconds, for the tag that replays it. */
export const INTRO_SECONDS = Math.round(TOTAL / 1000);

function sceneAt(now: number): number {
  let end = 0;
  for (let index = 0; index < SCENES.length; index++) {
    end += SCENES[index]!.ms;
    if (now < end) return index;
  }
  return SCENES.length - 1;
}

/**
 * The scene's halftone dots behind the words: a grid whose dots swell in a
 * slow wave from the middle and fade toward the edges, in the ink colour at
 * a low strength, so the words stay first.
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
      // The dots come up over the first two seconds.
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
          const r = 2.6 * wave * fade * rise;
          if (r < 0.25) continue;
          context.globalAlpha = 0.16 + 0.22 * wave * fade;
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
        lumen is an AI that does research in mathematics on its own. You start with a question,
        which becomes a project. lumen leads and hands parts of the work to readers, who search the
        literature and run experiments in a sandbox, on the model you choose. Then it shows you the
        evidence.
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
  '[animation-duration:3800ms]!',
  '[animation-duration:3400ms]!',
  '[animation-duration:3800ms]!',
  '[animation-duration:3200ms]!',
  '[animation-duration:3600ms]!',
  '[animation-duration:3000ms]!',
  '[animation-duration:3600ms]!',
  '[animation-duration:2600ms]!',
];
