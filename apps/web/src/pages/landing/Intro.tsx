// Owner: PENG XUJIAN. Page: Landing.
import { useEffect, useState, type JSX, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { RunState } from '@/ui/run-state';

// What lumen does, shown once to a visitor who is not signed in, before the
// front page: one question worked the way the product works it. The words
// of the page alone ("Now you can do any frontier work") did not say what
// happens after the question is sent. It plays in under ten seconds, in the
// session page's own marks (the turning ring, the moving light, the answer
// written as it comes), and any key, click or Skip ends it. With reduced
// motion it is not played at all.
//
// The run is real mathematics: 321-avoiding involutions of length n are
// counted by binomial(n, floor(n/2)) (Simion and Schmidt, 1985), OEIS A001405.

const SEEN_KEY = 'lumen.intro';

const QUESTION =
  'Is the number of 321-avoiding involutions of length n the central binomial coefficient?';
const COUNTS = [1, 2, 3, 6, 10, 20, 35, 70, 126, 252, 462, 924, 1716, 3432];
const ANSWER =
  'Yes. For every n up to 14 the counts equal binomial(n, ⌊n/2⌋), which is OEIS A001405, and Simion and Schmidt proved it for all n in 1985.';

/** When each part starts, in ms from the start. */
const AT = {
  type: 200,
  typed: 1900,
  search: 2100,
  found: 3100,
  readers: 3400,
  counting: 3800,
  papers: 5400,
  counted: 6000,
  answer: 6300,
  answered: 8500,
  kept: 8700,
  leave: 9800,
  done: 10300,
} as const;

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

/** The part of `text` written by `now`, between `from` and `to`. */
function written(text: string, now: number, from: number, to: number): string {
  if (now <= from) return '';
  if (now >= to) return text;
  return text.slice(0, Math.ceil((text.length * (now - from)) / (to - from)));
}

/** One line of work: the ring while it runs, a dot once done, the light over live words. */
function Line({
  running,
  children,
  className,
}: {
  running: boolean;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <p className={cn('flex items-center gap-2 text-sm motion-safe:animate-rise', className)}>
      <RunState state={running ? 'running' : 'finished'}>{''}</RunState>
      <span className={running ? 'shimmer-text motion-safe:animate-shimmer' : 'text-ink-2'}>
        {children}
      </span>
    </p>
  );
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
    if (now < AT.done) return;
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

  const counted = COUNTS.slice(
    0,
    Math.max(
      0,
      Math.min(
        COUNTS.length,
        Math.floor(((now - AT.counting) / (AT.counted - AT.counting)) * COUNTS.length),
      ),
    ),
  );
  const question = written(QUESTION, now, AT.type, AT.typed);
  const answer = written(ANSWER, now, AT.answer, AT.answered);
  return (
    // A click anywhere skips, as a key does; the button says that it can.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      onClick={() => {
        remember();
        onDone();
      }}
      className={cn(
        'transition-[opacity,translate] duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)]',
        now >= AT.leave && '-translate-y-3 opacity-0',
      )}
    >
      <div aria-hidden="true">
        {/* The question, typed into a field drawn as the page's own. */}
        <div className="min-h-24 border border-rule-major bg-paper px-4 py-3 text-ink">
          {question}
          {now < AT.typed + 300 ? (
            <span className="ml-0.5 inline-block h-[1.1em] w-px translate-y-[0.2em] bg-ink motion-safe:animate-pulse" />
          ) : null}
        </div>
        <div className="mt-6 min-h-64 space-y-3">
          {now >= AT.search ? (
            <Line running={now < AT.found}>
              {now < AT.found ? 'Searching OEIS' : 'Found A001405, a(n) = binomial(n, ⌊n/2⌋)'}
            </Line>
          ) : null}
          {now >= AT.readers ? (
            <div className="space-y-2 motion-safe:animate-rise">
              <Line running={now < AT.counted}>
                {now < AT.counted ? 'Working with 2 readers in parallel' : 'Readers finished'}
              </Line>
              <div className="ml-1.5 space-y-2 border-l border-rule-minor pl-5">
                <Line running={now < AT.counted}>
                  {now < AT.counted ? 'Counting involutions in Python' : 'Counted n = 1 to 14'}
                </Line>
                {counted.length > 0 ? (
                  <p className="font-mono text-xs text-ink-2 tabular-nums">
                    {counted.map((count, index) => (
                      <span key={count} className="motion-safe:animate-rise">
                        {index > 0 ? ', ' : ''}
                        {count}
                      </span>
                    ))}
                  </p>
                ) : null}
                <Line running={now < AT.papers}>
                  {now < AT.papers ? 'Searching arXiv and OpenAlex' : 'Found the 1985 proof'}
                </Line>
              </div>
            </div>
          ) : null}
          {now >= AT.answer ? (
            <p className="pt-2 text-ink motion-safe:animate-rise">
              {answer}
              {now < AT.answered ? (
                <span className="ml-1 inline-block size-[0.55em] rounded-full bg-ink align-middle motion-safe:animate-pulse" />
              ) : null}
            </p>
          ) : null}
          {now >= AT.kept ? (
            <p className="flex items-center gap-2 text-sm text-ink-2 motion-safe:animate-rise">
              <span className="size-2 bg-ink" />
              Kept as a finding
            </p>
          ) : null}
        </div>
      </div>
      <p className="sr-only">
        lumen takes a research question in mathematics, searches the literature, runs the
        computations in parallel, and answers with the evidence.
      </p>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          remember();
          onDone();
        }}
        className="mt-6 text-sm text-ink-2 underline decoration-[1.5px] underline-offset-[0.15em] hover:text-ink"
      >
        Skip
      </button>
    </div>
  );
}
