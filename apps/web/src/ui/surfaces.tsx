import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { ScrollRegion } from '@/ui/scroll-region';

// The two surfaces of an app page. Paper carries the main content: the
// projects list on home, the conversation on session. The grey well, on the
// right out to the screen edge, carries what lumen produced and the side
// actions: new project and latest findings on home; findings, call tree and
// files on session.
//
// Over 1080px (the `split` width) the two stand side by side on the 12-column
// grid: paper on columns 1 to 7, the well on 8 to 12. Below it there are two
// ways to fold, chosen by the page:
// - 'stack': the well follows the paper, and the whole column scrolls (home).
// - 'sheet': the paper takes the width, and the well becomes a sheet over the
//   right side that the page opens and closes (session).
//
// Both fill the space the shell gives them and never scroll the page; the
// regions inside scroll.

type Collapse = 'stack' | 'sheet';

// The `split` width from theme.css, for the one decision made in script.
const SPLIT = '(min-width: 67.5625rem)';

const CollapseContext = React.createContext<Collapse>('stack');

/**
 * Tells the shell that this page fills the screen edge to edge. The shell then
 * drops its own margin and its own scrolling, and the page lays out the space
 * itself. Surfaces is a Bleed; use Bleed directly for a page with one surface,
 * such as the landing.
 */
function Bleed({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-bleed="" className={cn('flex h-full min-h-0 flex-col', className)} {...props} />;
}

function Surfaces({
  collapse = 'stack',
  className,
  ...props
}: React.ComponentProps<'div'> & { collapse?: Collapse }) {
  return (
    <CollapseContext.Provider value={collapse}>
      <div
        data-bleed=""
        data-slot="surfaces"
        data-collapse={collapse}
        className={cn(
          // Positioned, so an absolute child is clipped by this scroller and
          // never makes the page taller than the screen (see ScrollRegion).
          'relative h-full min-h-0 px-margin',
          'split:grid split:grid-cols-12 split:grid-rows-[minmax(0,1fr)] split:gap-x-gutter split:overflow-visible',
          collapse === 'stack'
            ? 'flex flex-col overflow-y-auto'
            : 'grid grid-cols-1 grid-rows-[minmax(0,1fr)]',
          className,
        )}
        {...props}
      />
    </CollapseContext.Provider>
  );
}

/**
 * The paper side. A flex column: put a ScrollRegion in it for the part that
 * scrolls. It is backed by paper at 85 percent, so the scene behind the app
 * shows as a faint depth and never prints a star across the text people read.
 */
function SurfaceMain({ className, ...props }: React.ComponentProps<'div'>) {
  const collapse = React.useContext(CollapseContext);
  return (
    <div
      data-slot="surface-main"
      className={cn(
        'flex min-h-0 min-w-0 flex-col bg-paper/85 split:col-span-7',
        collapse === 'stack' && 'flex-none split:flex-auto',
        className,
      )}
      {...props}
    />
  );
}

interface SurfaceWellProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /** Sheet only: whether the sheet is open below the split width. */
  open?: boolean;
  /** Sheet only: called by the sheet's Close button and by Escape. */
  onClose?: () => void;
  /** Sheet only: the sheet's own name, shown at its head below the split width. */
  title?: React.ReactNode;
  /**
   * Sheet only: show the head (title and Close) at every width, as the
   * region's name. Use it for a well that holds one thing, such as the
   * details of one account, so the page does not repeat the title in a
   * RegionName of its own and hide one of the two by width.
   */
  titled?: boolean;
}

/**
 * The well side. It is one scrolling region, with fades in the well colour.
 * Give it an `aria-label` that names what it holds.
 */
function SurfaceWell({
  open = false,
  onClose,
  title,
  titled = false,
  className,
  children,
  ...props
}: SurfaceWellProps) {
  const collapse = React.useContext(CollapseContext);
  const sheet = collapse === 'sheet';
  const close = React.useRef<HTMLButtonElement | null>(null);

  // An open sheet takes focus and gives it back with Escape, so a keyboard
  // user is never left behind it.
  React.useEffect(() => {
    if (!sheet || !open) return;
    // Over the split width the well is not a sheet but a column beside the
    // paper, so opening it must not pull the focus away from the paper.
    if (!window.matchMedia?.(SPLIT).matches) close.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheet, open, onClose]);

  return (
    <>
      {/* Between 720px and the split width the sheet covers only the right
          of the paper. The paper beside it dims, and a click there closes
          the sheet, so it is clear the paper is not live while it is open. */}
      {sheet && open ? (
        <div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-[19] bg-ink/30 split:hidden dark:bg-paper/60"
        />
      ) : null}
      <ScrollRegion
        as="aside"
        surface="well"
        data-slot="surface-well"
        data-open={sheet ? String(open) : undefined}
        className={cn(
          'bg-well px-margin',
          'split:col-start-8 split:col-end-[-1] split:-mr-margin split:ml-0 split:border-l split:border-rule-minor',
          sheet
            ? cn(
                // A phone gets the whole width, with no edge left over: a 1px
                // strip of the page beside the sheet read as a glitch.
                'fixed inset-y-0 right-0 z-20 w-full border-rule roomy:max-w-[400px] roomy:border-l',
                open ? 'visible translate-x-0' : 'invisible translate-x-full',
                'motion-safe:transition-[translate,visibility] motion-safe:duration-240 motion-safe:ease-[cubic-bezier(0.2,0.7,0.2,1)]',
                'split:visible split:static split:z-auto split:w-auto split:max-w-none split:translate-x-0 split:transition-none',
              )
            : // Stacked, the well grows to the foot of the screen: a short
              // well left a band of paper under it.
              '-mx-margin flex-[1_0_auto]',
          className,
        )}
        {...props}
      >
        {sheet ? (
          <div
            className={cn(
              'sticky top-0 z-[3] mb-4 flex min-h-bar items-center justify-between border-b border-rule bg-well text-lg font-semibold',
              // Over the split width a titled head reads as a RegionName: no
              // rule and no bar height, only the name and Close in a row.
              titled ? 'split:static split:min-h-0 split:border-b-0 split:pt-6' : 'split:hidden',
            )}
          >
            {titled ? <h2>{title}</h2> : <span>{title}</span>}
            <Button ref={close} type="button" variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : null}
        {children}
      </ScrollRegion>
    </>
  );
}

/** The name over a region, at 18px, with an optional count beside it. */
function RegionName({
  count,
  className,
  children,
  ...props
}: React.ComponentProps<'h2'> & { count?: number }) {
  return (
    <h2 className={cn('mb-4 text-lg font-semibold', className)} {...props}>
      {children}
      {count === undefined ? null : (
        <span className="ml-1 font-normal text-ink-2 tabular-nums">{count}</span>
      )}
    </h2>
  );
}

export { Bleed, Surfaces, SurfaceMain, SurfaceWell, RegionName, type Collapse };
