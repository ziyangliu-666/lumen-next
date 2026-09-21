import { describe, expect, it } from 'vitest';
import { retryDelay } from './retry';

describe('project refresh retries', () => {
  it('backs off transient failures and stops after five retries', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((attempt) => retryDelay(attempt, 503))).toEqual([
      5000,
      10000,
      20000,
      40000,
      60000,
      null,
      null,
    ]);
  });
  it('does not retry authentication or permanent client errors', () => {
    for (const status of [400, 401, 403, 404, 409, 422]) expect(retryDelay(1, status)).toBeNull();
  });
  it('allows bounded retries for network failures, timeouts and rate limits', () => {
    for (const status of [undefined, 408, 429, 500, 502]) {
      expect(retryDelay(1, status)).toBe(5000);
      expect(retryDelay(6, status)).toBeNull();
    }
  });
});
