import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Slot } from 'radix-ui';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 border border-transparent text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none aria-invalid:border-signal [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Solid ink: the one primary action on a screen. Hover underlines
        // the words and keeps the ink. A grey fill on hover read as
        // disabled: "Stop now?" looked switched off while it waited for its
        // second click.
        default:
          'border-ink bg-ink text-paper decoration-[1.5px] underline-offset-[0.15em] hover:underline',
        // Raster has one red and it means "waits on you", so a destructive
        // action is solid ink like any primary one. Its words say what it
        // does; the confirm step (AlertDialog) carries the weight.
        destructive:
          'border-ink bg-ink text-paper decoration-[1.5px] underline-offset-[0.15em] hover:underline',
        // An ink outline that fills on hover: Stop, Findings, New project.
        outline: 'border-ink bg-transparent text-ink hover:bg-ink hover:text-paper',
        secondary: 'bg-well text-ink hover:bg-rule-minor',
        ghost: 'text-ink hover:bg-well',
        link: 'h-auto! border-0 px-0! text-ink decoration-[1.5px] underline-offset-[0.15em] hover:underline',
      },
      // One disabled look for every button: a grey outline and grey words,
      // never a filled block. A half-transparent ink fill read as a grey
      // primary action ("Add USD 5 in test mode").
      disabledLook: {
        boxed: 'disabled:border-rule-major disabled:bg-transparent disabled:text-ink-3',
        bare: 'disabled:text-ink-3',
      },
      size: {
        default: 'h-10 px-4 has-[>svg]:px-3',
        xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 gap-1.5 px-4 has-[>svg]:px-3',
        lg: 'h-11 px-6 has-[>svg]:px-4',
        icon: 'size-10',
        'icon-xs': "size-6 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        'icon-lg': 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const BARE = new Set(['ghost', 'link']);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(
        buttonVariants({
          variant,
          size,
          disabledLook: BARE.has(variant ?? 'default') ? 'bare' : 'boxed',
          className,
        }),
      )}
      {...props}
    />
  );
}

export { Button, buttonVariants };
