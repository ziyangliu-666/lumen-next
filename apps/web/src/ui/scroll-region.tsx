import * as React from 'react';
import { cn } from '@/lib/utils';

// A region that scrolls inside the one screen. It fades at an edge where more
// content is hidden, and only there, so a fade always means "there is more".
//
// The fade is a band in the region's own surface colour, pinned to the edge
// with position: sticky. It is not a mask, because a mask would also clear
// the region's background and show what lies behind it (the scene, ui/space).
//
// The region keeps no block padding of its own: a sticky fade sits inside the
// padding, so padding would lift the fade into the middle of the content. Put
// the space at the ends on the children.
//
// The region is positioned (relative), so it is the containing block of any
// absolute child, such as an sr-only label. Without that, an sr-only span far
// down a long list was laid out against the page, made the whole page taller
// than the screen, and a scrollIntoView then scrolled the page itself: the bar
// went off a phone screen and a blank band showed under the content.

type Surface = 'paper' | 'well';

const SURFACE: Record<Surface, string> = {
  paper: '[--scroll-surface:var(--paper)]',
  well: '[--scroll-surface:var(--well)]',
};

interface ScrollRegionProps extends React.HTMLAttributes<HTMLElement> {
  /** The surface the region sits on; the fades are drawn in it. */
  surface?: Surface;
  /**
   * 'bottom' opens the region at its end and keeps it there while new content
   * arrives, as long as the reader has not scrolled up. Use it for a
   * conversation that grows at the foot.
   */
  anchor?: 'top' | 'bottom';
  /** The element to render: div by default, section or aside for a landmark. */
  as?: 'div' | 'section' | 'aside' | 'nav';
  ref?: React.Ref<HTMLElement>;
}

function ScrollRegion({
  surface = 'paper',
  anchor = 'top',
  as: Tag = 'div',
  className,
  children,
  ref,
  ...props
}: ScrollRegionProps) {
  const own = React.useRef<HTMLElement | null>(null);
  const [above, setAbove] = React.useState(false);
  const [below, setBelow] = React.useState(false);
  // Whether the reader is at the end. Only then does new content pull the
  // region down; a reader who scrolled up to read stays where they are.
  const pinned = React.useRef(anchor === 'bottom');

  const setRef = React.useCallback(
    (node: HTMLElement | null) => {
      own.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.RefObject<HTMLElement | null>).current = node;
    },
    [ref],
  );

  React.useEffect(() => {
    const el = own.current;
    if (!el) return;
    const measure = (): void => {
      const end = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      setAbove(el.scrollTop > 2);
      setBelow(!end);
      if (anchor === 'bottom') pinned.current = end;
    };
    const follow = (): void => {
      if (anchor === 'bottom' && pinned.current) el.scrollTop = el.scrollHeight;
      measure();
    };
    if (anchor === 'bottom') el.scrollTop = el.scrollHeight;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    // Content that grows or a screen that resizes changes what is hidden.
    const resize = new ResizeObserver(follow);
    resize.observe(el);
    const mutate = new MutationObserver(follow);
    mutate.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener('scroll', measure);
      resize.disconnect();
      mutate.disconnect();
    };
  }, [anchor]);

  const edge = 'pointer-events-none sticky z-[2] block h-6 transition-opacity duration-120';
  const Element = Tag as React.ElementType;
  return (
    <Element
      ref={setRef}
      data-slot="scroll-region"
      className={cn(
        'relative min-h-0 [scrollbar-width:thin] overflow-y-auto',
        SURFACE[surface],
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          edge,
          'top-0 -mb-6 bg-linear-to-b from-(--scroll-surface) to-transparent',
          above ? 'opacity-100' : 'opacity-0',
        )}
      />
      {children}
      <span
        aria-hidden="true"
        className={cn(
          edge,
          'bottom-0 -mt-6 bg-linear-to-t from-(--scroll-surface) to-transparent',
          below ? 'opacity-100' : 'opacity-0',
        )}
      />
    </Element>
  );
}

export { ScrollRegion, type ScrollRegionProps };
