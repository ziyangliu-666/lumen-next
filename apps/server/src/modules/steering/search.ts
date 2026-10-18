import type { StepRow } from '@lumen/contracts';

// The literature connectors: the two places a combinatorics question is
// settled before anything is computed. OEIS answers "is this sequence
// already named", arXiv answers "has someone written this up". The readers'
// sandbox has no network, so without these a reader could only guess an
// A-number from memory, and say so.
//
// Each search returns rows for the page (source, query, what came back, as
// the spec's "Searched" table draws them) and a plain listing for the model.

export const SEARCH_SOURCES = ['oeis', 'arxiv'] as const;
export type SearchSource = (typeof SEARCH_SOURCES)[number];

export interface SearchResult {
  readonly rows: readonly StepRow[];
  /** What the model reads back. */
  readonly text: string;
}

/** Results one search returns; enough to recognise a match, short enough to read. */
const LIMIT = 5;
const TIMEOUT_MS = 10_000;

type Fetch = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export async function search(
  source: SearchSource,
  query: string,
  fetchImpl: Fetch = fetch,
  /** Time between arXiv requests; tests pass 0. */
  spacingMs: number = ARXIV_SPACING_MS,
): Promise<SearchResult> {
  return source === 'oeis'
    ? oeis(query, fetchImpl, AbortSignal.timeout(TIMEOUT_MS))
    : arxiv(query, fetchImpl, spacingMs);
}

interface OeisEntry {
  readonly number: number;
  readonly name: string;
  readonly data?: string;
}

async function oeis(query: string, fetchImpl: Fetch, signal: AbortSignal): Promise<SearchResult> {
  const url = `https://oeis.org/search?fmt=json&q=${encodeURIComponent(query)}`;
  const response = await fetchImpl(url, { signal });
  if (!response.ok) throw new Error(`OEIS answered HTTP ${response.status}`);
  const body: unknown = JSON.parse((await response.text()) || 'null');
  // The OEIS answers with a bare list now and with { results } before; a
  // query that matches nothing is null or an empty list.
  const list = (
    Array.isArray(body) ? body : ((body as { results?: unknown } | null)?.results ?? [])
  ) as OeisEntry[];
  const hits = (list ?? []).slice(0, LIMIT);
  if (hits.length === 0) {
    return {
      rows: [{ source: 'OEIS', text: query, result: 'No match', empty: true }],
      text: `OEIS: no sequence matches "${query}".`,
    };
  }
  const id = (n: number): string => `A${String(n).padStart(6, '0')}`;
  return {
    rows: hits.map((hit) => ({
      source: 'OEIS',
      text: `${id(hit.number)}, ${hit.name}`,
      result: 'Match',
      url: `https://oeis.org/${id(hit.number)}`,
    })),
    text: [
      `OEIS: ${hits.length} of ${list.length} matches for "${query}".`,
      // The whole data line, a few hundred characters: cut to 16 terms, a
      // reader could not check the terms it had computed past n = 15.
      ...hits.map((hit) => `${id(hit.number)}: ${hit.name}\n  ${hit.data ?? ''}`),
    ].join('\n'),
  };
}

/**
 * The arXiv query: every word required, in the mathematics archives. A bare
 * "all:<words>" is an OR of the words across every archive, and a search for
 * involution patterns came back with gamma-ray astronomy. With nothing
 * found that way, the words are tried again as an OR, still in mathematics.
 */
export function arxivQuery(query: string, every: boolean): string {
  const words = query
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1)
    .slice(0, 8);
  const terms = words.map((word) => `all:${word}`).join(every ? ' AND ' : ' OR ');
  return `(${terms || `all:${query}`}) AND cat:math.*`;
}

/**
 * Papers one arXiv search returns. More than OEIS's five: a question about
 * the best known result needs the newer papers too, and with every word
 * required a search for the 1324 pattern found four.
 */
const ARXIV_LIMIT = 8;

/**
 * arXiv asks API users for one request every three seconds. A search makes
 * up to three (every word, the synonym, any word), and readers search in
 * parallel: sent at once, they were refused or timed out on staging, every
 * search came back "Unavailable", and the model answered from memory. Each
 * request here waits its turn, has its own timeout, and is tried once more
 * when arXiv says it is busy.
 */
export const ARXIV_SPACING_MS = 3_000;
const ARXIV_TIMEOUT_MS = 15_000;
let arxivQueue: Promise<unknown> = Promise.resolve();

function arxivTurn<T>(work: () => Promise<T>, spacingMs: number): Promise<T> {
  const run = arxivQueue.then(work);
  arxivQueue = run
    .catch(() => undefined)
    .then(() => new Promise((done) => setTimeout(done, spacingMs)));
  return run;
}

async function arxivFeed(
  query: string,
  fetchImpl: Fetch,
  spacingMs: number = ARXIV_SPACING_MS,
): Promise<string> {
  const url = `https://export.arxiv.org/api/query?max_results=${ARXIV_LIMIT}&search_query=${encodeURIComponent(query)}`;
  for (let attempt = 0; ; attempt++) {
    const response = await arxivTurn(
      () => fetchImpl(url, { signal: AbortSignal.timeout(ARXIV_TIMEOUT_MS) }),
      spacingMs,
    );
    if (response.ok) return response.text();
    const busy = response.status === 429 || response.status === 503;
    if (!busy || attempt > 0) throw new Error(`arXiv answered HTTP ${response.status}`);
  }
}

function blocks(feed: string): string[] {
  return [...feed.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => match[1] ?? '');
}

/**
 * Names the literature uses for the same thing. A query in one is also run
 * in the other: papers on the 1324 pattern's Stanley-Wilf limit call it its
 * growth rate, and a search in the first words missed the 2017 and 2026
 * bounds that the second finds at the top.
 */
const SYNONYMS: readonly (readonly [RegExp, string])[] = [
  [/stanley[\s-]*wilf\s+limits?/iu, 'growth rate'],
];

/** The query in the literature's other words, or null when it has none. */
export function arxivSynonym(query: string): string | null {
  for (const [name, other] of SYNONYMS) {
    if (name.test(query)) return query.replace(name, other);
  }
  return null;
}

async function arxiv(query: string, fetchImpl: Fetch, spacingMs: number): Promise<SearchResult> {
  // Papers with every word first, then with every word of the synonym query;
  // when they are fewer than the limit, the list is filled with papers that
  // have any of the words.
  // The first request decides: if it fails, the search failed. A later one
  // that fails only leaves out what it would have added.
  const more = (q: string): Promise<string[]> =>
    arxivFeed(q, fetchImpl, spacingMs).then(blocks, () => []);
  const other = arxivSynonym(query);
  const every = [
    ...blocks(await arxivFeed(arxivQuery(query, true), fetchImpl, spacingMs)),
    ...(other ? await more(arxivQuery(other, true)) : []),
  ];
  const any = every.length < ARXIV_LIMIT ? await more(arxivQuery(query, false)) : [];
  const seen = new Set<string>();
  const entries = [...every, ...any]
    .map((block) => {
      const field = (tag: string): string =>
        (block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? '')
          .replace(/\s+/g, ' ')
          .trim();
      const id = field('id')
        .replace(/^https?:\/\/arxiv\.org\/abs\//, '')
        .replace(/v\d+$/, '');
      // The year, so the model can tell the newest result from an old one: it
      // called a 2012 bound the newest.
      const year = field('published').slice(0, 4);
      return { id, year, title: field('title'), summary: field('summary').slice(0, 300) };
    })
    .filter((entry) => entry.id && !seen.has(entry.id) && seen.add(entry.id))
    .slice(0, ARXIV_LIMIT);
  if (entries.length === 0) {
    return {
      rows: [{ source: 'arXiv', text: query, result: 'Nothing', empty: true }],
      text: `arXiv: no paper matches "${query}".`,
    };
  }
  return {
    rows: entries.map((entry) => ({
      source: 'arXiv',
      text: `${entry.id}${entry.year ? ` (${entry.year})` : ''}, ${entry.title}`,
      result: 'Paper',
      url: `https://arxiv.org/abs/${entry.id}`,
    })),
    text: [
      `arXiv: ${entries.length} papers for "${query}".`,
      ...entries.map(
        (entry) =>
          `${entry.id}${entry.year ? ` (${entry.year})` : ''}: ${entry.title}\n  ${entry.summary}`,
      ),
    ].join('\n'),
  };
}
