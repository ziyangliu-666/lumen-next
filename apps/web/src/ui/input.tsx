import * as React from 'react';
import { cn } from '@/lib/utils';

// A field's focus mark lies over its own border (offset -1px), so a focused
// field reads as one heavier box. The 2px gap of the page-wide focus mark
// drew a second box around the border on a field, which read as a rendering
// fault on a phone. Buttons keep the gap: they have no border of their own
// to thicken. The textarea, the select trigger and the composer do the same.
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-10 w-full min-w-0 border border-ink bg-transparent px-3 py-1 text-base text-ink outline-none selection:bg-ink selection:text-paper file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink placeholder:text-ink-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ink',
        'aria-invalid:border-signal',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
