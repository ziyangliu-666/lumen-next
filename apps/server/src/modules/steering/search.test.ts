import { describe, expect, it } from 'vitest';
import { arxivQuery, arxivSynonym, search } from './search.js';

const answer =
  (body: string, ok = true) =>
  () =>
    Promise.resolve({ ok, status: ok ? 200 : 503, text: () => Promise.resolve(body) });

describe('steering: the literature connectors', () => {
  it('reads an OEIS match as a row and a listing', async () => {
    const body = JSON.stringify([{ number: 1263, name: 'Narayana triangle', data: '1,1,1,1,3,1' }]);
    const result = await search('oeis', '1,1,1,1,3,1', answer(body));
    expect(result.rows).toEqual([
      {
        source: 'OEIS',
        text: 'A001263, Narayana triangle',
        result: 'Match',
        url: 'https://oeis.org/A001263',
      },
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
      {
        source: 'arXiv',
        text: 'math/0212221, Tunnels in Dyck paths',
        result: 'Paper',
        url: 'https://arxiv.org/abs/math/0212221',
      },
    ]);
  });

  it('fills a short list of every-word papers with any-word ones, without repeats', async () => {
    const entry = (id: string): string =>
      `<entry><id>http://arxiv.org/abs/${id}v1</id><title>T ${id}</title><summary>s</summary></entry>`;
    const feeds = [
      `<feed>${entry('1111.5736')}</feed>`,
      `<feed>${entry('math/0502504')}${entry('1111.5736')}</feed>`,
    ];
    const fetchImpl = () =>
      Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(feeds.shift() ?? '') });
    const result = await search('arxiv', '1324 bounds', fetchImpl);
    expect(result.rows.map((row) => row.text)).toEqual([
      '1111.5736, T 1111.5736',
      'math/0502504, T math/0502504',
    ]);
  });

  it('gives each paper its year when the feed has one', async () => {
    const feed = `<feed><entry><id>http://arxiv.org/abs/1711.10325v3</id><published>2017-11-28T00:00:00Z</published><title>New bounds for 1324</title><summary>s</summary></entry></feed>`;
    const result = await search('arxiv', '1324 bounds', answer(feed));
    expect(result.rows[0]?.text).toBe('1711.10325 (2017), New bounds for 1324');
    expect(result.text).toContain('1711.10325 (2017): New bounds for 1324');
  });

  it('turns a source that is down into an error the worker can report', async () => {
    await expect(search('arxiv', 'x', answer('', false))).rejects.toThrow('HTTP 503');
  });
});

describe('steering: the arXiv synonyms', () => {
  it('also searches "growth rate" for a Stanley-Wilf limit, and nothing else for other words', () => {
    expect(arxivSynonym('Stanley-Wilf limit 1324-avoiding permutations')).toBe(
      'growth rate 1324-avoiding permutations',
    );
    expect(arxivSynonym('lower bound Stanley Wilf limits of 1324')).toBe(
      'lower bound growth rate of 1324',
    );
    expect(arxivSynonym('Dyck paths by peaks')).toBeNull();
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
