import { useEffect, useState } from 'react';
import { request, RequestFailure } from '@/core/api';
import type { Page } from './api';
import { retryDelay } from './retry';

/** Refetch loaded pages together so polling cannot mix old cursors and new data. */
export function usePages<T>(
  url: string,
  pollDelay: (items: readonly T[]) => number | null,
): {
  items: readonly T[];
  loading: boolean;
  error: string | null;
  unauthorized: boolean;
  paused: boolean;
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
  const [paused, setPaused] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    let busy = false;
    let again = false;
    let delay: number | null = null;
    let failures = 0;
    let retryAt = 0;
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
        failures = 0;
        setPaused(false);
        delay = pollDelay(all);
      } catch (failure: unknown) {
        if (controller.signal.aborted) return;
        const auth = failure instanceof RequestFailure && failure.status === 401;
        setUnauthorized(auth);
        if (auth) {
          setItems([]);
          setHasMore(false);
        }
        setError(failure instanceof Error ? failure.message : 'Refresh failed.');
        failures++;
        delay = retryDelay(
          failures,
          failure instanceof RequestFailure ? failure.status : undefined,
        );
        setPaused(delay === null);
      } finally {
        busy = false;
        if (!controller.signal.aborted) {
          setLoading(false);
          if ((again && failures === 0) || delay !== null) {
            retryAt = Date.now() + (delay ?? 0);
            timer = window.setTimeout(
              () => {
                void fetchPages();
              },
              again && failures === 0 ? 0 : delay!,
            );
          }
          again = false;
        }
      }
    };
    const refresh = (): void => {
      // Focus must not bypass backoff or restart an exhausted retry budget.
      if (failures === 0 || (delay !== null && Date.now() >= retryAt)) void fetchPages();
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [url, pages, revision, pollDelay]);
  return {
    items,
    loading,
    error,
    unauthorized,
    paused,
    hasMore,
    refresh: () => setRevision((n) => n + 1),
    loadMore: () => setPages((n) => n + 1),
  };
}
