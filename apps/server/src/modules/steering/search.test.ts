import { describe, expect, it } from 'vitest';
import { arxivQuery, search } from './search.js';

const answer =
  (body: string, ok = true) =>
  () =>
    Promise.resolve({ ok, status: ok ? 200 : 503, text: () => Promise.resolve(body) });

describe('steering: the literature connectors', () => {
  it('reads an OEIS match as a row and a listing', async () => {
    const body = JSON.stringify([{ number: 1263, name: 'Narayana triangle', data: '1,1,1,1,3,1' }]);
    const result = await search('oeis', '1,1,1,1,3,1', answer(body));
    expect(result.rows).toEqual([
      { source: 'OEIS', text: 'A001263, Narayana triangle', result: 'Match' },
    ]);
    expect(result.text).toContain('A001263: Narayana triangle');
  });

  it('says so when the OEIS has nothing, which is often the row that matters', async () => {
    const result = await search('oeis', '9,9,9,9', answer('null'));
    expect(result.rows).toEqual([
      { source: 'OEIS', text: '9,9,9,9', result: 'No match', empty: true },
    ]);
  });

  it('reads arXiv entries from the Atom feed', async () => {
    const feed = `<feed><entry><id>http://arxiv.org/abs/math/0212221v2</id><title> Tunnels in Dyck
      paths </title><summary>We study tunnels.</summary></entry></feed>`;
    const result = await search('arxiv', 'Dyck tunnels', answer(feed));
    expect(result.rows).toEqual([
      { source: 'arXiv', text: 'math/0212221, Tunnels in Dyck paths', result: 'Paper' },
    ]);
  });

  it('turns a source that is down into an error the worker can report', async () => {
    await expect(search('arxiv', 'x', answer('', false))).rejects.toThrow('HTTP 503');
  });
});

describe('steering: the arXiv query', () => {
  it('requires every word and stays in mathematics, then falls back to any word', () => {
    expect(arxivQuery('involutions, consecutive pattern!', true)).toBe(
      '(all:involutions AND all:consecutive AND all:pattern) AND cat:math.*',
    );
    expect(arxivQuery('involutions pattern', false)).toBe(
      '(all:involutions OR all:pattern) AND cat:math.*',
    );
  });
});
