import { describe, expect, it } from 'vitest';
import { retryDelay } from './retry';

describe('project refresh retries', () => {
  it('backs off transient failures and stops on the fifth consecutive failure', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((attempt) => retryDelay(attempt, 503))).toEqual([
      5000,
      10000,
      20000,
      40000,
      null,
      null,
      null,
    ]);
  });
  it('does not retry authentication failures', () => {
    expect(retryDelay(1, 401)).toBeNull();
  });
  it('allows bounded retries for network failures, timeouts and rate limits', () => {
    for (const status of [undefined, 400, 403, 404, 408, 409, 422, 429, 500, 502]) {
      expect(retryDelay(1, status)).toBe(5000);
      expect(retryDelay(5, status)).toBeNull();
    }
  });
});
