import { useEffect, useState, type JSX } from 'react';

// A tiny hash router. No dependency; pages are wired here and nowhere else.
export interface Route {
  readonly path: string;
  readonly render: () => JSX.Element;
}

export function useRoute(routes: readonly Route[], fallback: () => JSX.Element): JSX.Element {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || '/');
  useEffect(() => {
    const on = (): void => setHash(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const match = routes.find((r) => r.path === hash);
  return match ? match.render() : fallback();
}
