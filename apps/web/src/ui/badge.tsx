import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Slot } from 'radix-ui';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        // A badge is a label, not a button, so it stays quiet. For a run's
        // state use RunState; for a finding's worth use Verdict.
        default: 'border-ink bg-ink text-paper',
        secondary: 'bg-well text-ink',
        destructive: 'border-ink text-ink',
        outline: 'border-ink text-ink [a&]:hover:bg-well',
        ghost: 'text-ink [a&]:hover:bg-well',
        link: 'text-ink underline-offset-[0.15em] [a&]:hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
