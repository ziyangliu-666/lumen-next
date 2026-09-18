import { useEffect, useState } from 'react';
import { request, RequestFailure, type Page } from './api';

/** Refetch loaded pages together so polling cannot mix old cursors and new data. */
export function usePages<T>(
  url: string,
  shouldPoll: (items: readonly T[]) => boolean,
): {
  items: readonly T[];
  loading: boolean;
  error: string | null;
  unauthorized: boolean;
  hasMore: boolean;
  refresh: () => void;
  loadMore: () => void;
} {
  const [items, setItems] = useState<readonly T[]>([]);
  const [pages, setPages] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    let busy = false;
    let again = false;
    let poll = false;
    const fetchPages = async (): Promise<void> => {
      if (busy) {
        again = true;
        return;
      }
      if (document.visibilityState === 'hidden') return;
      busy = true;
      window.clearTimeout(timer);
      setLoading(true);
      try {
        let cursor: string | null = null;
        const all: T[] = [];
        for (let i = 0; i < pages; i++) {
          const query = new URLSearchParams({ limit: '20' });
          if (cursor) query.set('cursor', cursor);
          const page: Page<T> = await request(`${url}?${query.toString()}`, {
            signal: controller.signal,
          });
          all.push(...page.items);
          cursor = page.nextCursor;
          if (!cursor) break;
        }
        if (controller.signal.aborted) return;
        setItems(all);
        setHasMore(cursor !== null);
        setError(null);
        setUnauthorized(false);
        poll = shouldPoll(all);
      } catch (failure: unknown) {
        if (controller.signal.aborted) return;
        const auth = failure instanceof RequestFailure && failure.status === 401;
        setUnauthorized(auth);
        if (auth) {
          setItems([]);
          setHasMore(false);
        }
        setError(failure instanceof Error ? failure.message : 'Refresh failed.');
        poll = !auth;
      } finally {
        busy = false;
        if (!controller.signal.aborted) {
          setLoading(false);
          if (again || poll)
            timer = window.setTimeout(
              () => {
                void fetchPages();
              },
              again ? 0 : 5000,
            );
          again = false;
        }
      }
    };
    const refresh = (): void => {
      void fetchPages();
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    // Optional shared-client notification; no second socket or event reducer.
    window.addEventListener('lumen:projects-invalidated', refresh);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('lumen:projects-invalidated', refresh);
    };
  }, [url, pages, revision, shouldPoll]);
  return {
    items,
    loading,
    error,
    unauthorized,
    hasMore,
    refresh: () => setRevision((n) => n + 1),
    loadMore: () => setPages((n) => n + 1),
  };
}
