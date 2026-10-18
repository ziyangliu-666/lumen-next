import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useLiveFavicon } from './favicon';
import { go } from './router';
import { useNewVersion } from './version';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { LumenMark } from '@/ui/mark';
import { mountSpace, type ShotName, type Space } from '@/ui/space';
import { setThemeTransition, toggleTheme, useTheme, useThemeFollower } from './theme';

// The frame every page sits in: one bar on top with one rule under it, and
// the screen below it. The page never scrolls as a whole; a region inside it
// does. A page renders what goes inside the frame and nothing around it. That
// is what keeps pages written by five people looking like one product.
//
// The bar is the same on every page: the wordmark on the left, then the
// page's breadcrumb, then the page's status (state, spend, budget), then the
// page's actions, then the account. The breadcrumb takes only the width it
// needs and the status follows it at once, so where you are and how the run
// stands read as one group. The free space is between the status and the
// actions, and the actions stand right, beside the account. A page fills its
// three slots with
// <BarCrumb>, <BarStatus> and <BarActions>, from anywhere in its tree, so the
// page keeps its data and the shell keeps the layout.
//
// Under 720px one row has room only for the wordmark, the page's actions and
// the account. The breadcrumb and the status then take a line each, under
// that row and inside the same bar, over the one rule. This is the narrow bar
// of the prototype; a page does not draw its own second line.
//
// Two ways to fill the screen:
// - A page that renders <Bleed> or <Surfaces> (src/ui/surfaces) lays out the
//   whole screen under the bar itself, edge to edge.
// - Any other page gets the margin and a scrolling column, so a page that is
//   not yet built on the two surfaces still reads and scrolls.

interface BarSlots {
  readonly crumb: HTMLElement | null;
  readonly status: HTMLElement | null;
  readonly actions: HTMLElement | null;
}

const BarContext = createContext<BarSlots>({ crumb: null, status: null, actions: null });

/** Puts its children in the bar, after the wordmark: where you are. */
export function BarCrumb({ children }: { children: ReactNode }): JSX.Element | null {
  const { crumb } = useContext(BarContext);
  return crumb ? createPortal(children, crumb) : null;
}

/**
 * Puts its children in the bar, after the breadcrumb: run state, spend,
 * budget. Under 720px they take their own line in the bar.
 */
export function BarStatus({ children }: { children: ReactNode }): JSX.Element | null {
  const { status } = useContext(BarContext);
  return status ? createPortal(children, status) : null;
}

/**
 * Puts its children in the bar, just before the account, on the first row at
 * every width: a control the page needs within reach on a phone too, such as
 * the button that opens the well's sheet.
 */
export function BarActions({ children }: { children: ReactNode }): JSX.Element | null {
  const { actions } = useContext(BarContext);
  return actions ? createPortal(children, actions) : null;
}

/**
 * The breadcrumb of a signed-in page that is not a session: "Projects" alone
 * on the projects page, "Projects / Settings" on any other. Every signed-in
 * page then says where you are in the same place, and Projects is one click
 * away from all of them. Before, settings had an in-page heading, admin a
 * label, and the projects page nothing, and only the account menu led back.
 */
export function PageCrumb({ page }: { page?: string }): JSX.Element {
  return (
    <BarCrumb>
      {page ? (
        <>
          <a href="#/home" className="shrink-0 text-ink-2 hover:text-ink">
            Projects
          </a>
          <span aria-hidden="true" className="text-ink-3">
            /
          </span>
          <h1 className="min-w-0 truncate text-sm font-semibold text-ink">{page}</h1>
        </>
      ) : (
        <h1 className="text-sm font-semibold text-ink">Projects</h1>
      )}
    </BarCrumb>
  );
}

// The scene behind every page (ui/space): one canvas fixed behind
// everything, and a veil canvas above everything for the theme wipe. The
// shell mounts it once and it lives as long as the shell, so a change of page
// never draws a new background: it moves the camera to the next page's shot.
// The landing is the close shot, with the sphere as the image. Home and the
// session are far and dim, so the text over them reads. Every other page is
// the quiet shot.
function shotOf(path: string): ShotName {
  if (path === '/') return 'landing';
  if (path === '/signin') return 'signin';
  if (path === '/home') return 'home';
  if (path === '/session') return 'session';
  return 'quiet';
}

/**
 * Every link to a page of this app moves inside the document (router `go`),
 * so the scene stays mounted and its camera moves to the next shot. A link
 * that changed the query, such as Sign up (?mode=signup#/signin), loaded the
 * document again, and the scene started over with no move. A link that opens
 * elsewhere, in a new tab, or with a modifier key is left to the browser.
 */
function useLinksInPage(): void {
  useEffect(() => {
    const on = (event: MouseEvent): void => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;
      const next = new URL(link.href, window.location.href);
      if (next.origin !== window.location.origin || next.pathname !== window.location.pathname) {
        return;
      }
      // Only links to a page (#/…); a plain anchor on the page stays one.
      if (!next.hash.startsWith('#/')) return;
      event.preventDefault();
      go(next.href);
    };
    document.addEventListener('click', on);
    return () => document.removeEventListener('click', on);
  }, []);
}

/**
 * A file dropped outside the field is not opened by the browser in place of
 * the app, which lost the page and any draft. The field takes drops itself
 * (ui/composer) and handles them before this.
 */
function useNoStrayDrops(): void {
  useEffect(() => {
    const on = (event: DragEvent): void => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    };
    window.addEventListener('dragover', on);
    window.addEventListener('drop', on);
    return () => {
      window.removeEventListener('dragover', on);
      window.removeEventListener('drop', on);
    };
  }, []);
}

/**
 * Light or dark, in the bar on every page. The key D did the same, but no
 * one could find it. The icon is the theme it changes to, as in most apps.
 */
function ThemeButton(): JSX.Element {
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme (D)`}
      onClick={toggleTheme}
      className="grid size-8 place-items-center text-ink-2 hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" className="size-[18px]">
        {next === 'light' ? (
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none">
            <circle cx="10" cy="10" r="3.5" />
            <path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3 6 14M14 6l1.3-1.3" />
          </g>
        ) : (
          <path
            d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
            fill="none"
          />
        )}
      </svg>
    </button>
  );
}

function Scene({ shot }: { shot: ShotName }): JSX.Element {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const veil = useRef<HTMLCanvasElement | null>(null);
  const space = useRef<Space | null>(null);
  // The shot the scene opens on. Later shots arrive by the effect below, as
  // camera moves.
  const [initial] = useState(shot);

  useEffect(() => {
    if (!canvas.current) return;
    const scene = mountSpace(canvas.current, veil.current, initial);
    space.current = scene;
    // A theme toggle starts the wipe where the pointer last was: the key D
    // has no point of its own, and the cursor is where the person looks.
    const release = setThemeTransition((apply) => {
      const at = scene.pointer();
      scene.wipe(at.x, at.y, apply);
    });
    return () => {
      release();
      scene.destroy();
      space.current = null;
    };
  }, [initial]);

  useEffect(() => {
    space.current?.shot(shot);
  }, [shot]);

  return (
    <>
      <canvas
        ref={canvas}
        aria-hidden="true"
        data-slot="space"
        className="pointer-events-none fixed inset-0 -z-10 size-full"
      />
      <canvas
        ref={veil}
        aria-hidden="true"
        hidden
        data-slot="space-veil"
        className="pointer-events-none fixed inset-0 z-[100] size-full"
      />
    </>
  );
}

// Public pages lead back to the landing; app pages lead to the projects.
const PUBLIC = new Set(['/', '/signin']);

// The grid of the bar, as named areas. Over 720px it is one row. Under it the
// first row keeps the wordmark, the actions and the account, and the
// breadcrumb and the status each take a row of their own. An empty slot is
// display: none, so its row has no height.
const BAR = cn(
  'grid flex-none items-center gap-x-6 px-margin text-sm',
  'min-h-bar grid-cols-[auto_minmax(0,max-content)_auto_minmax(0,1fr)_auto]',
  "[grid-template-areas:'mark_crumb_status_actions_account']",
  'max-roomy:grid-cols-[auto_minmax(0,1fr)_auto_auto] max-roomy:grid-rows-[var(--bar-h)_auto_auto] max-roomy:gap-x-4',
  "max-roomy:[grid-template-areas:'mark_._actions_account'_'crumb_crumb_crumb_crumb'_'status_status_status_status']",
);

export function AppShell({
  path,
  children,
  accountActions,
}: {
  path: string;
  children: ReactNode;
  accountActions?: ReactNode;
}): JSX.Element {
  useThemeFollower();
  useLinksInPage();
  useNoStrayDrops();
  useLiveFavicon();
  const fresh = useNewVersion();
  const [crumb, setCrumb] = useState<HTMLElement | null>(null);
  const [status, setStatus] = useState<HTMLElement | null>(null);
  const [actions, setActions] = useState<HTMLElement | null>(null);
  // The wordmark is the front page from everywhere, signed in or not: the
  // breadcrumb's Projects is the way to the projects, and the front page
  // shows the account in the corner once someone is signed in.
  const home = '#/';
  // The landing and sign-in have one surface and no regions for a rule to
  // separate, so the prototype draws their bar without one, the same on
  // both, because they are one flow. Every other page keeps it.
  const ruled = !PUBLIC.has(path);
  // The sign-in page is where the account slot would send the reader, so
  // the slot would only repeat the page.
  const account = path === '/signin' ? null : accountActions;

  return (
    <BarContext.Provider value={{ crumb, status, actions }}>
      <Scene shot={shotOf(path)} />
      <div className="flex h-svh flex-col overflow-hidden">
        {/* The bar is clear, as in the prototype: the scene runs on behind
            it and its rule, so the bar reads as a line printed on the scene
            and not as a band laid over it. */}
        {/* Quiet, so the scene's particles step back from the bar's text: the
            run state and spend read over a clear sky (ui/space). */}
        <header data-quiet="" className={cn(BAR, ruled ? 'border-b border-rule' : 'border-b-0')}>
          <a
            href={home}
            className="inline-flex shrink-0 items-center gap-2 self-center text-base font-bold tracking-[-0.03em] text-ink [grid-area:mark] hover:no-underline"
          >
            <LumenMark />
            lumen
          </a>
          <nav
            ref={setCrumb}
            aria-label="Breadcrumb"
            // A project is named by its first question, which can be a whole
            // sentence. The breadcrumb stops at a share of the bar and the
            // title truncates, so the state beside it stays in reach.
            className="flex min-w-0 items-baseline gap-2 text-ink-2 [grid-area:crumb] empty:hidden max-roomy:pb-2 roomy:max-w-[38vw]"
          />
          <div
            ref={setStatus}
            className="flex min-w-0 items-baseline gap-4 whitespace-nowrap tabular-nums [grid-area:status] empty:hidden max-roomy:flex-wrap max-roomy:items-center max-roomy:gap-y-2 max-roomy:pb-3"
          />
          <div
            ref={setActions}
            className="flex shrink-0 items-center gap-4 justify-self-end [grid-area:actions] empty:hidden"
          />
          <div className="flex shrink-0 items-center gap-4 [grid-area:account]">
            {fresh ? (
              <Button size="sm" variant="link" onClick={() => window.location.reload()}>
                Reload for the new version
              </Button>
            ) : null}
            <ThemeButton />
            {account}
          </div>
        </header>
        <main
          className={cn(
            'relative flex min-h-0 flex-1 flex-col overflow-y-auto px-margin py-6',
            'has-[>[data-bleed]]:overflow-hidden has-[>[data-bleed]]:p-0',
          )}
        >
          {children}
        </main>
      </div>
    </BarContext.Provider>
  );
}

// Title, one line of context, and the actions that belong to the page. For a
// page that is a single column (settings, sign in). A page on the two
// surfaces (home, session, admin) names its regions with RegionName instead,
// and puts where it is in the bar with BarCrumb. `className` replaces the
// space under the header when the block under it brings its own.
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('mb-6 flex items-start justify-between gap-4', className)}>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        {description ? <p className="text-sm text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
