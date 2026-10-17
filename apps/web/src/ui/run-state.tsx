import * as React from 'react';
import { cn } from '@/lib/utils';

// Run state: is something happening, and does it need you. Every state is a
// circle and a word, so the rule is one rule. Circles are runs; squares are
// findings (Verdict).
// - waiting: a red dot. The one place red appears: it waits on you.
// - running: an ink ring with a gap that turns, the common mark for "in
//   progress". With reduced motion it stands still; the gap still sets it
//   apart from a finished dot.
// - finished: a grey dot. Settled, so it is quiet.
// - stopped: a grey ring. It ended before its work did.

type Run = 'waiting' | 'running' | 'finished' | 'stopped';

const WORD: Record<Run, string> = {
  waiting: 'Waiting on you',
  running: 'Running',
  finished: 'Finished',
  stopped: 'Stopped',
};

const TONE: Record<Run, string> = {
  waiting: 'text-signal',
  running: 'text-ink',
  finished: 'text-ink-2',
  stopped: 'text-ink-2',
};

const MARK: Record<Run, string> = {
  waiting: 'size-2 border-[1.5px] border-current bg-current',
  running:
    // The track is the mark's own colour, faint, not a rule colour: a rule
    // colour vanished on one surface and showed on the other, so the lead's
    // ring (on a selected row) and a reader's ring (on the well) looked like
    // two marks.
    'size-[11px] border-2 border-current/20 border-t-current border-r-current motion-safe:animate-turn',
  finished: 'size-2 border-[1.5px] border-current bg-current',
  stopped: 'size-2 border-[1.5px] border-current',
};

/**
 * A run's state as a circle and a word. `children` replaces the default word
 * ("Waiting on you", "Running", "Finished", "Stopped") when the page has a
 * more exact one, for example "Waiting on your approval".
 */
function RunState({
  state,
  children,
  className,
  ...props
}: React.ComponentProps<'span'> & { state: Run }) {
  return (
    <span
      data-slot="run-state"
      data-state={state}
      className={cn(
        'inline-flex items-center gap-2 text-sm font-medium whitespace-nowrap',
        TONE[state],
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className={cn('shrink-0 rounded-full', MARK[state])} />
      {children ?? WORD[state]}
    </span>
  );
}

export { RunState, type Run };
