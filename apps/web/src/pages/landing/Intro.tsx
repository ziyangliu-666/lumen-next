// Owner: PENG XUJIAN. Page: Landing.
import { useEffect, useState, type JSX, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { RunState } from '@/ui/run-state';

// What lumen is, shown once to a visitor who is not signed in, before the
// front page: an AI that does research on its own, said in six short
// scenes of large type over the scene's sphere. Each scene names one thing
// lumen does and shows one real piece of it: the papers it reads, the
// numbers it computes, the readers working at once, the claim it checks.
// The first version played a small copy of the session page, and at that
// size it read as a screenshot, not as what the product is.
//
// About twelve seconds. Any key, a click or Skip ends it, it plays once,
// and with reduced motion it is not played at all. The mathematics is
// real: the Catalan numbers count Dyck paths (OEIS A000108).

const SEEN_KEY = 'lumen.intro';

/**
 * Delays for the words of a line, so they come up one after another.
 * Important, here and below: the animate-* utility is the animation
 * shorthand, which set the delay and the length back to their defaults.
 */
const WORD = [
  '[animation-delay:0ms]!',
  '[animation-delay:70ms]!',
  '[animation-delay:140ms]!',
  '[animation-delay:210ms]!',
  '[animation-delay:280ms]!',
  '[animation-delay:350ms]!',
  '[animation-delay:420ms]!',
  '[animation-delay:490ms]!',
];

/** Delays for the pieces under a line, after its words. */
const PIECE = [
  '[animation-delay:520ms]!',
  '[animation-delay:640ms]!',
  '[animation-delay:760ms]!',
  '[animation-delay:880ms]!',
  '[animation-delay:1000ms]!',
  '[animation-delay:1120ms]!',
  '[animation-delay:1240ms]!',
  '[animation-delay:1360ms]!',
  '[animation-delay:1480ms]!',
];

/** Words that come up out of a blur, one after another. */
function Words({ text, className }: { text: string; className?: string | undefined }): JSX.Element {
  const words = text.split(' ');
  return (
    <span className={cn('block', className)}>
      {words.map((word, index) => (
        <span
          key={index}
          className={cn(
            'inline-block whitespace-pre motion-safe:animate-intro-word',
            WORD[Math.min(index, WORD.length - 1)],
          )}
        >
          {index < words.length - 1 ? `${word} ` : word}
        </span>
      ))}
    </span>
  );
}

function Piece({
  at,
  spaced = false,
  children,
}: {
  at: number;
  /** A space after it, as in a list of numbers: an inline block drops its own. */
  spaced?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <span
      className={cn('inline-block motion-safe:animate-intro-word', PIECE[at], spaced && 'mr-[1ch]')}
    >
      {children}
    </span>
  );
}

const CATALAN = [1, 1, 2, 5, 14, 42, 132, 429, 1430];

interface Scene {
  readonly lines: readonly string[];
  /** How long it shows, in ms; `out` and `fill` say the same time as classes. */
  readonly ms: number;
  readonly out: string;
  readonly fill: string;
  readonly piece?: ReactNode;
}

const SCENES: readonly Scene[] = [
  {
    lines: ['An AI that does research', 'on its own.'],
    ms: 2600,
    out: '[animation-delay:2240ms]!',
    fill: '[animation-duration:2600ms]!',
    piece: (
      <Piece at={4}>
        <span className="text-lg text-ink-2">
          You ask the question. lumen does the work, end to end.
        </span>
      </Piece>
    ),
  },
  {
    lines: ['It reads the literature.'],
    ms: 2000,
    out: '[animation-delay:1640ms]!',
    fill: '[animation-duration:2000ms]!',
    piece: (
      <span className="flex flex-wrap gap-2">
        {['arXiv:1711.10325', 'OEIS A000108', 'arXiv:2408.15075', 'OEIS A001006'].map(
          (id, index) => (
            <Piece key={id} at={index}>
              <span className="border border-rule-major bg-well px-2 py-1 font-mono text-sm text-ink">
                {id}
              </span>
            </Piece>
          ),
        )}
      </span>
    ),
  },
  {
    lines: ['It runs the computations.'],
    ms: 2000,
    out: '[animation-delay:1640ms]!',
    fill: '[animation-duration:2000ms]!',
    piece: (
      <span className="font-mono text-2xl text-ink tabular-nums">
        {CATALAN.map((count, index) => (
          <Piece key={index} at={index} spaced={index < CATALAN.length - 1}>
            {index < CATALAN.length - 1 ? `${count},` : `${count} …`}
          </Piece>
        ))}
      </span>
    ),
  },
  {
    lines: ['Many at once.'],
    ms: 2200,
    out: '[animation-delay:1840ms]!',
    fill: '[animation-duration:2200ms]!',
    piece: (
      <span className="grid gap-2">
        {[
          ['reader 1', 'Counting Dyck paths to n = 14'],
          ['reader 2', 'Searching arXiv and OpenAlex'],
          ['reader 3', 'Checking the terms against OEIS'],
        ].map(([who, what], index) => (
          <Piece key={who} at={index}>
            <span className="flex items-center gap-3 text-lg">
              <RunState state="running">{''}</RunState>
              <span className="w-20 text-ink-2">{who}</span>
              <span className="shimmer-text motion-safe:animate-shimmer">{what}</span>
            </span>
          </Piece>
        ))}
      </span>
    ),
  },
  {
    lines: ['It checks every claim.'],
    ms: 2000,
    out: '[animation-delay:1640ms]!',
    fill: '[animation-duration:2000ms]!',
    piece: (
      <Piece at={1}>
        <span className="flex items-center gap-3 text-lg text-ink">
          <span aria-hidden="true" className="size-2.5 bg-ink" />
          Matches OEIS A000108 for every n up to 14
        </span>
      </Piece>
    ),
  },
  {
    lines: ['And shows you', 'the evidence.'],
    ms: 1800,
    out: '[animation-delay:1440ms]!',
    fill: '[animation-duration:1800ms]!',
  },
];

const TOTAL = SCENES.reduce((sum, scene) => sum + scene.ms, 0);

/** Whether the intro should play: signed out is the caller's; here, once, and not with reduced motion. */
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

/** The scene shown at `now` ms, or -1 once all have played. */
function sceneAt(now: number): number {
  let end = 0;
  for (let index = 0; index < SCENES.length; index++) {
    end += SCENES[index]!.ms;
    if (now < end) return index;
  }
  return -1;
}

export function Intro({ onDone }: { onDone: () => void }): JSX.Element {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(at) {
      setNow(at - start);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (now < TOTAL) return;
    remember();
    onDone();
  }, [now, onDone]);
  useEffect(() => {
    const skip = (): void => {
      remember();
      onDone();
    };
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [onDone]);

  const at = sceneAt(now);
  const scene = SCENES[Math.max(0, at)]!;
  return (
    // A click anywhere skips, as a key does; the button says that it can.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      onClick={() => {
        remember();
        onDone();
      }}
      className="flex min-h-[26rem] flex-col"
    >
      <p className="sr-only">
        lumen is an AI that does research in mathematics on its own: it reads the literature, runs
        the computations, many at once, checks every claim, and shows you the evidence.
      </p>
      {/* Keyed by the scene, so each one comes up fresh and leaves on its
          own clock. */}
      <div key={at} aria-hidden="true" className={cn('motion-safe:animate-intro-out', scene.out)}>
        <p className="text-[clamp(2.5rem,4.6vw,4.25rem)] leading-[1.02] font-medium tracking-[-0.035em] text-ink">
          {scene.lines.map((line, index) => (
            <Words key={line} text={line} className={index > 0 ? 'text-ink-2' : undefined} />
          ))}
        </p>
        {scene.piece ? <div className="mt-8">{scene.piece}</div> : null}
      </div>
      <div className="mt-auto flex items-center gap-6 pt-10">
        {/* One step per scene: those shown are full, the one showing fills. */}
        <div aria-hidden="true" className="flex flex-1 gap-1.5">
          {SCENES.map((step, index) => (
            <span key={index} className="h-0.5 flex-1 overflow-hidden bg-rule-minor">
              {index < at || at === -1 ? (
                <span className="block h-full bg-ink" />
              ) : index === at ? (
                <span
                  className={cn(
                    'block h-full origin-left bg-ink motion-safe:animate-intro-fill',
                    step.fill,
                  )}
                />
              ) : null}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            remember();
            onDone();
          }}
          className="text-sm text-ink-2 underline decoration-[1.5px] underline-offset-[0.15em] hover:text-ink"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
