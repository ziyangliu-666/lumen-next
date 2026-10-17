import * as React from 'react';
import { cn } from '@/lib/utils';

// One named part of a single-column page (settings, account): an 18px
// heading, an optional line of context, the actions that belong to it, then
// its content. A rule over the heading separates it from the section before,
// so a long page reads as a column of ruled sections and not as a stack of
// cards. The first section of a column has no rule, because whatever sits
// over it (the page header, the tabs) already closes the space.

interface SectionProps extends Omit<React.ComponentProps<'section'>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Controls for the whole section, for example Refresh. They sit right of the heading. */
  actions?: React.ReactNode;
  /** Marks the section as loading for a screen reader. */
  busy?: boolean;
}

function Section({
  title,
  description,
  actions,
  busy,
  className,
  children,
  ...props
}: SectionProps) {
  const id = React.useId();
  return (
    <section
      data-slot="section"
      aria-labelledby={id}
      aria-busy={busy}
      className={cn('grid gap-4 border-t border-rule pt-6 first:border-t-0 first:pt-0', className)}
      {...props}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid max-w-prose gap-1">
          <h2 id={id} className="text-lg font-semibold text-ink">
            {title}
          </h2>
          {description ? <p className="text-sm text-ink-2">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** A label over its field: the pair reads as one unit, apart from the next pair. */
function Field({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="field" className={cn('grid gap-2', className)} {...props} />;
}

export { Section, Field, type SectionProps };
