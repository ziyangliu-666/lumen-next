import * as React from 'react';
import { cn } from '@/lib/utils';

// Verdict: what a finding is worth. A square mark and a word, never a box, so
// a verdict reads as a label and not as a button. Squares are findings;
// circles are runs (RunState). The verdict sits after the claim it qualifies,
// because the claim is the content.
// - open: a hollow square. It is the one that still needs work.
// - confirmed: a filled square.
// - dropped: a dash, and the claim beside it is struck (claimClassName).

type VerdictKind = 'open' | 'confirmed' | 'dropped';

const WORD: Record<VerdictKind, string> = {
  open: 'Open question',
  confirmed: 'Confirmed',
  dropped: 'Dropped',
};

const MARK: Record<VerdictKind, string> = {
  open: 'h-2 border-[1.5px]',
  confirmed: 'h-2 border-[1.5px] bg-current',
  dropped: 'h-0 border-t-[1.5px]',
};

function Verdict({
  verdict,
  children,
  className,
  ...props
}: React.ComponentProps<'span'> & { verdict: VerdictKind }) {
  return (
    <span
      data-slot="verdict"
      data-verdict={verdict}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap text-ink',
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className={cn('w-2 shrink-0 border-current', MARK[verdict])} />
      {children ?? WORD[verdict]}
    </span>
  );
}

/** The classes for the claim a verdict qualifies: a dropped claim is struck. */
function claimClassName(verdict: VerdictKind): string {
  return verdict === 'dropped' ? 'text-ink-2 line-through decoration-1' : '';
}

export { Verdict, claimClassName, type VerdictKind };
