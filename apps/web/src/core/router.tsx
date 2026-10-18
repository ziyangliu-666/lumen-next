import { Fragment, useEffect, useState, type JSX } from 'react';
import { flushSync } from 'react-dom';

// A tiny hash router. No dependency; pages are wired in main.tsx and nowhere else.
export interface Route {
  readonly path: string;
  readonly render: () => JSX.Element;
}

/** The current path, '/' when the hash is empty. Re-renders on navigation. */
export function useHash(): string {
  const read = (): { path: string; search: string } => ({
    path: window.location.hash.slice(1) || '/',
    search: window.location.search,
  });
  const [where, setWhere] = useState(read);
  useEffect(() => {
    // The query as well: moving between sessions changes only ?session=.
    const on = (): void => setWhere(read());
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  return where.path;
}

export function renderRoute(
  routes: readonly Route[],
  path: string,
  fallback: () => JSX.Element,
): JSX.Element {
  const match = routes.find((r) => r.path === path);
  // A page mounts afresh for another session: it reads the query once, on
  // mount. Other query changes (?task=) keep it mounted.
  const session = new URLSearchParams(window.location.search).get('session') ?? '';
  return <Fragment key={session}>{match ? match.render() : fallback()}</Fragment>;
}

// The name the opening title and the session's breadcrumb share for the one
// frame of the flight. It is set on the two elements only while a transition
// runs: a name left on an element would join any later transition, and two
// elements with one name make the browser skip the whole transition.
const FLIGHT = 'project-title';
// How long the flight waits for the next page to draw its target. The
// browser holds the old frame while it waits, so this is also the longest a
// click can look frozen. The session draws its title after one request.
const LANDING_MS = 600;

function motionAllowed(): boolean {
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Resolves when an element marked `data-flight-target` is in the page, or after LANDING_MS. */
function flightTarget(): Promise<HTMLElement | null> {
  const find = (): HTMLElement | null =>
    document.querySelector<HTMLElement>('[data-flight-target]');
  const now = find();
  if (now) return Promise.resolve(now);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const found = find();
      if (!found) return;
      done(found);
    });
    const timer = window.setTimeout(() => done(null), LANDING_MS);
    function done(found: HTMLElement | null): void {
      observer.disconnect();
      window.clearTimeout(timer);
      resolve(found);
    }
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

/**
 * Goes to `url` inside this document when only the query and the hash
 * change, so the shell and its scene stay mounted and the camera moves to the
 * next shot; any other address loads as before. The page at the new hash
 * mounts fresh and reads the query, exactly as after a full load.
 *
 * With `flight`, the element flies into the next page's element marked
 * `data-flight-target` (the session's breadcrumb title), by a view
 * transition. Only where the browser has view transitions and motion is
 * allowed; elsewhere, and if the target does not appear in time, the
 * navigation is the same without the flight.
 */
export function go(url: string, flight?: HTMLElement | null): void {
  const here = new URL(window.location.href);
  const next = new URL(url, here);
  if (
    next.origin !== here.origin ||
    next.pathname !== here.pathname ||
    (next.hash === here.hash && next.search === here.search)
  ) {
    // A different document, or the same page again: keep the full load, so a
    // page that reads the query on mount still sees the new one.
    window.location.assign(next.href);
    return;
  }
  const change = (): void => {
    window.history.pushState(null, '', next.href);
    // pushState fires no event, and useHash listens for hashchange. flushSync
    // draws the next page now, inside the transition's update.
    flushSync(() => {
      window.dispatchEvent(
        new HashChangeEvent('hashchange', { oldURL: here.href, newURL: next.href }),
      );
    });
  };
  if (!flight || typeof document.startViewTransition !== 'function' || !motionAllowed()) {
    change();
    return;
  }
  flight.style.setProperty('view-transition-name', FLIGHT);
  let target: HTMLElement | null = null;
  const transition = document.startViewTransition(async () => {
    flight.style.removeProperty('view-transition-name');
    change();
    target = await flightTarget();
    target?.style.setProperty('view-transition-name', FLIGHT);
  });
  const clear = (): void => {
    flight.style.removeProperty('view-transition-name');
    target?.style.removeProperty('view-transition-name');
  };
  // A skipped or failed transition still ran the update, so the page has
  // moved; only the names are left to clear.
  transition.finished.then(clear, clear);
}
