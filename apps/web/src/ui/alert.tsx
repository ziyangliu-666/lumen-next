import * as React from 'react';
import { cn } from '@/lib/utils';

// A message about the page itself: something failed, or something is not
// available here. One pattern for every page, so an error never reads as a
// line of help text. Reviews found eight messages across sign-in, home,
// settings and admin that were plain body text, some of them raw server
// strings in lower case.
//
// The look: a 2px ink rule on the left, on the well, a short title in
// semibold and one sentence under it. The rule is ink and not red, because
// red means "waits on you" and nothing else. An alert that does ask the
// person to act inside a run is a RunState, not this.
//
// `role` is 'alert' for a failure the person just caused or must notice, and
// 'status' for a standing fact about the server ("not available here").

interface AlertProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  title: React.ReactNode;
  /** A control that can fix it, such as Retry. Leave out when nothing can. */
  action?: React.ReactNode;
}

function Alert({ title, action, role = 'alert', className, children, ...props }: AlertProps) {
  return (
    <div
      data-slot="alert"
      role={role}
      className={cn(
        'flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-l-2 border-ink bg-well py-3 pr-4 pl-4 text-sm text-ink',
        className,
      )}
      {...props}
    >
      <div className="grid max-w-prose min-w-0 gap-1">
        <p className="font-semibold">{title}</p>
        {children ? <div className="text-ink-2">{children}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export { Alert, type AlertProps };
