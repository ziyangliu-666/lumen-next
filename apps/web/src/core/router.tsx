import { useEffect, useState, type JSX } from 'react';

// A tiny hash router. No dependency; pages are wired in main.tsx and nowhere else.
export interface Route {
  readonly path: string;
  readonly render: () => JSX.Element;
}

/** The current path, '/' when the hash is empty. Re-renders on navigation. */
export function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || '/');
  useEffect(() => {
    const on = (): void => setHash(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export function renderRoute(
  routes: readonly Route[],
  path: string,
  fallback: () => JSX.Element,
): JSX.Element {
  const match = routes.find((r) => r.path === path);
  return match ? match.render() : fallback();
}
